import { NextRequest } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { SaasApiError, ok, parseBody, requireSaasMember, saasHandler } from "@/lib/saas/account";
import { runCheckout } from "@/lib/saas/billing";

const checkoutSchema = z.object({
    idempotencyKey: z.string().regex(/^[a-zA-Z0-9-]{16,64}$/, "Clé de paiement invalide."),
    plan: z.enum(["INDEPENDANT", "SMALL_BUSINESS", "MEDIUM_BUSINESS"]),
    cycle: z.enum(["MONTHLY", "ANNUAL"]),
    extraSeats: z.number().int().min(0),
    includeSetup: z.boolean(),
    threeDsConfirmed: z.boolean().optional(),
    card: z.object({
        number: z.string().max(30),
        expiry: z.string().max(7),
        cvc: z.string().max(4),
        holder: z.string().max(80),
    }),
});

function serialize(payment: { id: string; status: string; totalCents: number; invoiceNumber: string | null; failureMessage: string | null }) {
    return {
        id: payment.id,
        status: payment.status,
        totalCents: payment.totalCents,
        invoiceNumber: payment.invoiceNumber,
        failureMessage: payment.failureMessage,
    };
}

export const POST = saasHandler(async (request: NextRequest) => {
    const ctx = await requireSaasMember({ admin: true });
    const body = await parseBody(request, checkoutSchema);

    let outcome;
    try {
        outcome = await runCheckout(ctx, body);
    } catch (err) {
        // Two requests with the same key raced: the loser returns the winner's result.
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
            const existing = await prisma.saasPayment.findUnique({ where: { idempotencyKey: body.idempotencyKey } });
            if (existing && existing.accountId === ctx.account.id) {
                outcome = { status: existing.status === "SUCCEEDED" ? "succeeded" : "failed", payment: existing } as const;
            }
        }
        if (!outcome) throw err;
    }

    if (outcome.status === "requires_3ds") {
        throw new SaasApiError(outcome.message, 402, "requires_3ds");
    }
    if (outcome.status === "failed") {
        return Response.json(
            { success: false, error: outcome.payment.failureMessage ?? "Paiement refusé.", code: outcome.payment.failureCode, data: serialize(outcome.payment) },
            { status: 402 }
        );
    }
    return ok({
        payment: serialize(outcome.payment),
        next: ctx.account.onboardingCompletedAt ? "/espace" : "/espace/onboarding",
    });
});
