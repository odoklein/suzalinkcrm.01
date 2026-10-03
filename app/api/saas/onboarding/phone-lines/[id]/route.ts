import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { SaasApiError, logAccountEvent, ok, requireSaasMember, saasHandler } from "@/lib/saas/account";

export const DELETE = saasHandler(async (_request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { account, member } = await requireSaasMember({ admin: true, productAccess: true });
    const { id } = await params;
    const res = await prisma.saasPhoneLine.deleteMany({ where: { id, accountId: account.id } });
    if (res.count === 0) throw new SaasApiError("Ligne introuvable.", 404);
    await logAccountEvent(account.id, member.id, "phone_line.removed", { id });
    return ok({ id });
});
