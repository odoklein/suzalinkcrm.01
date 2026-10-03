import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { SaasApiError, logAccountEvent, ok, requireSaasMember, saasHandler } from "@/lib/saas/account";

export const DELETE = saasHandler(async (_request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { account, member } = await requireSaasMember({ admin: true });
    const { id } = await params;
    const res = await prisma.saasApiKey.updateMany({
        where: { id, accountId: account.id, revokedAt: null },
        data: { revokedAt: new Date() },
    });
    if (res.count === 0) throw new SaasApiError("Clé introuvable ou déjà révoquée.", 404);
    await logAccountEvent(account.id, member.id, "api_key.revoked", { id });
    return ok({ id });
});
