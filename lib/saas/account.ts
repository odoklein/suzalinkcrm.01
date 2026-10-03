// ============================================
// SAAS ACCOUNT SERVICE — status, usage/quotas, events and the route guard
// shared by every /api/saas handler.
// ============================================

import { NextResponse } from "next/server";
import { randomBytes, createHash } from "crypto";
import type { Prisma, SaasAccount, SaasMemberRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSaasSession, type SaasSessionMember } from "./session";
import { effectiveQuotas, PlanValidationError, type PlanCode } from "./plans";

export class SaasApiError extends Error {
    constructor(
        message: string,
        public status = 400,
        public code?: string
    ) {
        super(message);
    }
}

export const ADMIN_ROLES: SaasMemberRole[] = ["OWNER", "ADMIN"];

export function isAdmin(role: SaasMemberRole) {
    return ADMIN_ROLES.includes(role);
}

/**
 * Trials expire lazily: the first read after trialEndsAt flips the status.
 * Returns the up-to-date account.
 */
export async function refreshAccountStatus<T extends SaasAccount>(account: T): Promise<T> {
    if (account.status === "TRIALING" && account.trialEndsAt && account.trialEndsAt.getTime() <= Date.now()) {
        // Conditional update: a payment landing at the same moment wins.
        const res = await prisma.saasAccount.updateMany({
            where: { id: account.id, status: "TRIALING" },
            data: { status: "TRIAL_EXPIRED" },
        });
        if (res.count > 0) {
            await logAccountEvent(account.id, null, "trial.expired");
            return { ...account, status: "TRIAL_EXPIRED" };
        }
        const fresh = await prisma.saasAccount.findUnique({ where: { id: account.id } });
        return { ...account, ...fresh };
    }
    // A cancelled subscription stays usable until the end of the paid period.
    if (
        account.status === "ACTIVE" &&
        account.canceledAt &&
        account.currentPeriodEnd &&
        account.currentPeriodEnd.getTime() <= Date.now()
    ) {
        const res = await prisma.saasAccount.updateMany({
            where: { id: account.id, status: "ACTIVE", canceledAt: { not: null } },
            data: { status: "CANCELED" },
        });
        if (res.count > 0) {
            await logAccountEvent(account.id, null, "subscription.ended");
            return { ...account, status: "CANCELED" };
        }
    }
    return account;
}

/** Can the account use the product (onboarding, settings)? */
export function hasProductAccess(account: Pick<SaasAccount, "status">) {
    return account.status === "TRIALING" || account.status === "ACTIVE";
}

export function trialDaysLeft(account: Pick<SaasAccount, "status" | "trialEndsAt">, now = Date.now()) {
    if (account.status !== "TRIALING" || !account.trialEndsAt) return null;
    return Math.max(0, Math.ceil((account.trialEndsAt.getTime() - now) / 86_400_000));
}

export async function logAccountEvent(
    accountId: string,
    actorId: string | null,
    type: string,
    details?: Prisma.InputJsonValue,
    tx: Prisma.TransactionClient = prisma
) {
    try {
        await tx.saasAccountEvent.create({ data: { accountId, actorId, type, details } });
    } catch (err) {
        // The event log must never break the action it records.
        console.error("[saas] failed to log event", type, err);
    }
}

export async function getAccountUsage(accountId: string) {
    const [seats, workspaces, phoneLines, contacts] = await Promise.all([
        prisma.saasMember.count({ where: { accountId, status: { not: "DISABLED" }, role: { not: "CLIENT_VIEWER" } } }),
        prisma.saasWorkspace.count({ where: { accountId } }),
        prisma.saasPhoneLine.count({ where: { accountId } }),
        prisma.saasContactImport.aggregate({ where: { accountId }, _sum: { validCount: true } }),
    ]);
    return { seats, workspaces, phoneLines, contacts: contacts._sum.validCount ?? 0 };
}

export function quotasFor(account: Pick<SaasAccount, "planCode" | "extraSeats" | "status">) {
    return effectiveQuotas(account.planCode as PlanCode, {
        extraSeats: account.extraSeats,
        trialing: account.status === "TRIALING",
    });
}

/** Throws a 402-style error when adding `adding` units would exceed the quota. */
export function assertQuota(label: string, used: number, adding: number, limit: number | null) {
    if (limit === null) return;
    if (used + adding > limit) {
        throw new SaasApiError(
            `Limite atteinte : ${label} (${used}/${limit}). ${
                label === "sièges" ? "Ajoutez des sièges ou passez à l'offre supérieure." : "Passez à l'offre supérieure (ou activez l'abonnement si vous êtes en essai)."
            }`,
            402,
            "quota_exceeded"
        );
    }
}

export function slugify(input: string) {
    const base = input
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 40);
    return base || "compte";
}

export async function uniqueSlug(name: string) {
    const base = slugify(name);
    for (let i = 0; i < 5; i++) {
        const candidate = i === 0 ? base : `${base}-${randomBytes(2).toString("hex")}`;
        const exists = await prisma.saasAccount.findUnique({ where: { slug: candidate }, select: { id: true } });
        if (!exists) return candidate;
    }
    return `${base}-${randomBytes(4).toString("hex")}`;
}

export function sha256(value: string) {
    return createHash("sha256").update(value).digest("hex");
}

export function randomToken(bytes = 32) {
    return randomBytes(bytes).toString("base64url");
}

// --------------------------------------------
// Route guard
// --------------------------------------------

interface GuardOptions {
    /** Owner/admin only. */
    admin?: boolean;
    /** Account must be trialing or paid (not waiting for payment / expired). */
    productAccess?: boolean;
}

export interface SaasContext {
    member: SaasSessionMember;
    account: SaasSessionMember["account"];
}

export async function requireSaasMember(opts: GuardOptions = {}): Promise<SaasContext> {
    const member = await getSaasSession();
    if (!member) throw new SaasApiError("Session expirée, reconnectez-vous.", 401, "unauthenticated");
    const account = await refreshAccountStatus(member.account);
    if (opts.admin && !isAdmin(member.role)) {
        throw new SaasApiError("Réservé aux administrateurs du compte.", 403, "forbidden");
    }
    if (opts.productAccess && !hasProductAccess(account)) {
        throw new SaasApiError(
            account.status === "TRIAL_EXPIRED"
                ? "Votre essai est terminé. Activez votre abonnement pour continuer."
                : "Finalisez votre paiement pour accéder à votre espace.",
            402,
            "payment_required"
        );
    }
    return { member: { ...member, account }, account };
}

/** Wraps a handler: SaasApiError → JSON with its status, anything else → 500. */
export function saasHandler<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
    return async (...args: A): Promise<Response> => {
        try {
            return await fn(...args);
        } catch (err) {
            if (err instanceof SaasApiError) {
                return NextResponse.json({ success: false, error: err.message, code: err.code }, { status: err.status });
            }
            if (err instanceof PlanValidationError) {
                return NextResponse.json({ success: false, error: err.message }, { status: 400 });
            }
            console.error("[saas] unhandled error", err);
            return NextResponse.json({ success: false, error: "Erreur interne, réessayez." }, { status: 500 });
        }
    };
}

export function ok<T>(data: T, status = 200) {
    return NextResponse.json({ success: true, data }, { status });
}

/** Parse a JSON body with a zod-like schema, throwing a readable 400. */
export async function parseBody<T>(
    request: Request,
    schema: { safeParse: (v: unknown) => { success: true; data: T } | { success: false; error: { issues: { message: string }[] } } }
): Promise<T> {
    let raw: unknown;
    try {
        raw = await request.json();
    } catch {
        throw new SaasApiError("Requête invalide.");
    }
    const parsed = schema.safeParse(raw);
    if (!parsed.success) throw new SaasApiError(parsed.error.issues[0]?.message ?? "Données invalides.");
    return parsed.data;
}
