import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { SaasApiError, logAccountEvent, ok, requireSaasMember, saasHandler } from "@/lib/saas/account";

/**
 * "Tester la connexion": checks whether the provider has already called the
 * line's webhook (real setup), otherwise simulates the provider's test ping so
 * trials can finish onboarding before their telecom admin wires it up.
 */
export const POST = saasHandler(async (_request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { account, member } = await requireSaasMember({ admin: true, productAccess: true });
    const { id } = await params;
    const line = await prisma.saasPhoneLine.findFirst({ where: { id, accountId: account.id } });
    if (!line) throw new SaasApiError("Ligne introuvable.", 404);

    const receivedRealEvent = Boolean(line.lastEventAt);
    const now = new Date();
    await prisma.saasPhoneLine.update({
        where: { id: line.id },
        data: { verifiedAt: line.verifiedAt ?? now, lastEventAt: line.lastEventAt ?? now },
    });
    await logAccountEvent(account.id, member.id, "phone_line.verified", { id: line.id, simulated: !receivedRealEvent });
    return ok({ verified: true, simulated: !receivedRealEvent });
});
