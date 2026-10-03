// ============================================
// SAAS BILLING — mock checkout. Amounts come from computeQuote(), the card
// outcome from chargeMockCard(); every attempt (success or decline) is
// recorded once per idempotency key.
// ============================================

import { randomBytes } from "crypto";
import type { Prisma, SaasPayment } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { SaasApiError, getAccountUsage, logAccountEvent, type SaasContext } from "./account";
import { chargeMockCard, validateCard, type CardInput } from "./mock-card";
import { PLANS, computeQuote, effectiveQuotas, type BillingCycle, type PlanCode } from "./plans";

export interface CheckoutInput {
    idempotencyKey: string;
    plan: PlanCode;
    cycle: BillingCycle;
    extraSeats: number;
    includeSetup: boolean;
    card: CardInput;
    threeDsConfirmed?: boolean;
}

export type CheckoutOutcome =
    | { status: "succeeded"; payment: SaasPayment }
    | { status: "failed"; payment: SaasPayment }
    | { status: "requires_3ds"; message: string };

function invoiceNumber(now = new Date()) {
    const ym = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
    return `CP-${ym}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

/** A plan change must fit what the account already uses (seats, workspaces, lines). */
export async function assertUsageFitsPlan(accountId: string, plan: PlanCode, extraSeats: number) {
    const usage = await getAccountUsage(accountId);
    const q = effectiveQuotas(plan, { extraSeats, trialing: false });
    const problems: string[] = [];
    if (usage.seats > q.seats) problems.push(`${usage.seats} membres actifs pour ${q.seats} sièges`);
    if (q.workspaces !== null && usage.workspaces > q.workspaces) problems.push(`${usage.workspaces} workspaces pour ${q.workspaces} autorisés`);
    if (q.phoneLines !== null && usage.phoneLines > q.phoneLines) problems.push(`${usage.phoneLines} lignes pour ${q.phoneLines} autorisées`);
    if (usage.contacts > q.contacts) problems.push(`${usage.contacts} contacts pour ${q.contacts} autorisés`);
    if (problems.length > 0) {
        throw new SaasApiError(
            `L'offre ${PLANS[plan].name} ne couvre pas votre usage actuel : ${problems.join(", ")}.`,
            409,
            "plan_too_small"
        );
    }
}

export async function runCheckout(ctx: SaasContext, input: CheckoutInput): Promise<CheckoutOutcome> {
    const { account, member } = ctx;

    // Same key replayed (double click, network retry): return the first result.
    const previous = await prisma.saasPayment.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (previous) {
        if (previous.accountId !== account.id) throw new SaasApiError("Clé de paiement invalide.", 409);
        return { status: previous.status === "SUCCEEDED" ? "succeeded" : "failed", payment: previous };
    }

    if (account.status === "ACTIVE" && !account.canceledAt && account.planCode === input.plan && account.billingCycle === input.cycle && account.extraSeats === input.extraSeats) {
        throw new SaasApiError("Votre abonnement est déjà actif avec ces paramètres.", 409, "already_active");
    }

    const cardErrors = validateCard(input.card);
    const firstError = Object.values(cardErrors)[0];
    if (firstError) throw new SaasApiError(firstError, 422, "invalid_card");

    const quote = computeQuote({
        plan: input.plan,
        cycle: input.cycle,
        extraSeats: input.extraSeats,
        // The setup fee is charged at most once per account.
        includeSetup: input.includeSetup && !(await hasPaidSetup(account.id)),
    });
    await assertUsageFitsPlan(account.id, input.plan, quote.extraSeats);

    const charge = chargeMockCard(input.card, { threeDsConfirmed: input.threeDsConfirmed });
    if (!charge.ok && charge.code === "requires_3ds") {
        return { status: "requires_3ds", message: charge.message };
    }

    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setUTCMonth(periodEnd.getUTCMonth() + quote.months);

    const base = {
        accountId: account.id,
        idempotencyKey: input.idempotencyKey,
        subtotalCents: quote.subtotalCents,
        vatCents: quote.vatCents,
        totalCents: quote.totalCents,
        planCode: quote.plan,
        billingCycle: quote.cycle,
        extraSeats: quote.extraSeats,
        includesSetup: quote.includeSetup,
        lines: quote.lines as unknown as Prisma.InputJsonValue,
        cardBrand: charge.brand,
        cardLast4: charge.last4,
        cardholderName: input.card.holder.trim().slice(0, 80),
    };

    if (!charge.ok) {
        const payment = await prisma.saasPayment.create({
            data: { ...base, status: "FAILED", failureCode: charge.code, failureMessage: charge.message },
        });
        await logAccountEvent(account.id, member.id, "payment.failed", { code: charge.code, totalCents: quote.totalCents });
        return { status: "failed", payment };
    }

    const payment = await prisma.$transaction(async (tx) => {
        const payment = await tx.saasPayment.create({
            data: { ...base, status: "SUCCEEDED", invoiceNumber: invoiceNumber(now), periodStart: now, periodEnd },
        });
        await tx.saasAccount.update({
            where: { id: account.id },
            data: {
                status: "ACTIVE",
                planCode: quote.plan,
                billingCycle: quote.cycle,
                extraSeats: quote.extraSeats,
                currentPeriodEnd: periodEnd,
                canceledAt: null,
                ...(quote.includeSetup ? { setupServiceRequested: true } : {}),
            },
        });
        await logAccountEvent(
            account.id,
            member.id,
            "payment.succeeded",
            { paymentId: payment.id, plan: quote.plan, cycle: quote.cycle, totalCents: quote.totalCents, fromStatus: account.status },
            tx
        );
        return payment;
    });
    return { status: "succeeded", payment };
}

async function hasPaidSetup(accountId: string) {
    const count = await prisma.saasPayment.count({ where: { accountId, status: "SUCCEEDED", includesSetup: true } });
    return count > 0;
}
