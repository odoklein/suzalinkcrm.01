import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { brandUrl } from "@/lib/brand";
import {
    SaasApiError,
    logAccountEvent,
    ok,
    randomToken,
    requireSaasMember,
    saasHandler,
    sha256,
} from "@/lib/saas/account";
import { INVITE_TTL_DAYS } from "@/lib/saas/onboarding-service";

async function findTarget(accountId: string, id: string) {
    const target = await prisma.saasMember.findFirst({ where: { id, accountId } });
    if (!target) throw new SaasApiError("Membre introuvable.", 404);
    if (target.role === "OWNER") throw new SaasApiError("Le propriétaire du compte ne peut pas être modifié ici.", 403);
    return target;
}

/** Revoke a pending invitation, or disable an active member (frees the seat). */
export const DELETE = saasHandler(async (_request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { account, member } = await requireSaasMember({ admin: true });
    const { id } = await params;
    const target = await findTarget(account.id, id);
    if (target.id === member.id) throw new SaasApiError("Vous ne pouvez pas vous retirer vous-même.", 403);

    if (target.status === "INVITED") {
        await prisma.saasMember.delete({ where: { id: target.id } });
        await logAccountEvent(account.id, member.id, "member.invite_revoked", { email: target.email });
    } else {
        await prisma.saasMember.update({
            where: { id: target.id },
            data: { status: "DISABLED", sessionVersion: { increment: 1 } },
        });
        await logAccountEvent(account.id, member.id, "member.disabled", { email: target.email });
    }
    return ok({ id });
});

/** Regenerate an invitation link (the previous one stops working). */
export const POST = saasHandler(async (_request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { account, member } = await requireSaasMember({ admin: true, productAccess: true });
    const { id } = await params;
    const target = await findTarget(account.id, id);
    if (target.status !== "INVITED") throw new SaasApiError("Ce membre a déjà activé son compte.", 409);

    const token = randomToken();
    await prisma.saasMember.update({
        where: { id: target.id },
        data: {
            inviteTokenHash: sha256(token),
            inviteExpiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 86_400_000),
        },
    });
    await logAccountEvent(account.id, member.id, "member.invite_renewed", { email: target.email });
    return ok({ url: brandUrl(`/espace/invitation/${token}`) });
});
