import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { SaasApiError, logAccountEvent, ok, parseBody, requireSaasMember, saasHandler } from "@/lib/saas/account";

export const dynamic = "force-dynamic";

export const GET = saasHandler(async () => {
    const { account } = await requireSaasMember({ admin: true });
    const payments = await prisma.saasPayment.findMany({
        where: { accountId: account.id },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
            id: true,
            status: true,
            totalCents: true,
            subtotalCents: true,
            vatCents: true,
            planCode: true,
            billingCycle: true,
            extraSeats: true,
            includesSetup: true,
            lines: true,
            cardBrand: true,
            cardLast4: true,
            failureMessage: true,
            invoiceNumber: true,
            periodStart: true,
            periodEnd: true,
            createdAt: true,
        },
    });
    const hasPaidSetup = payments.some((p) => p.status === "SUCCEEDED" && p.includesSetup);
    return ok({ payments, hasPaidSetup });
});

const actionSchema = z.object({ action: z.enum(["cancel", "resume"]) });

export const POST = saasHandler(async (request: NextRequest) => {
    const { account, member } = await requireSaasMember({ admin: true });
    const { action } = await parseBody(request, actionSchema);
    if (account.status !== "ACTIVE") {
        throw new SaasApiError("Aucun abonnement actif à modifier.", 409);
    }
    if (action === "cancel") {
        if (account.canceledAt) throw new SaasApiError("L'abonnement est déjà résilié.", 409);
        await prisma.saasAccount.update({ where: { id: account.id }, data: { canceledAt: new Date() } });
        await logAccountEvent(account.id, member.id, "subscription.canceled", { effectiveAt: account.currentPeriodEnd });
    } else {
        if (!account.canceledAt) throw new SaasApiError("L'abonnement n'est pas résilié.", 409);
        await prisma.saasAccount.update({ where: { id: account.id }, data: { canceledAt: null } });
        await logAccountEvent(account.id, member.id, "subscription.resumed");
    }
    return ok({ action });
});
