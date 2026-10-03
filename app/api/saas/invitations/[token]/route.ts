import { NextRequest } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/geo-ip";
import { checkRateLimit } from "@/lib/rate-limit";
import { createSaasSession } from "@/lib/saas/session";
import { SaasApiError, logAccountEvent, ok, parseBody, saasHandler, sha256 } from "@/lib/saas/account";
import { passwordSchema } from "@/lib/saas/validation";

async function findInvite(token: string) {
    if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return null;
    const member = await prisma.saasMember.findUnique({
        where: { inviteTokenHash: sha256(token) },
        include: { account: { select: { name: true, planCode: true, status: true } } },
    });
    if (!member || member.status !== "INVITED") return null;
    if (!member.inviteExpiresAt || member.inviteExpiresAt.getTime() < Date.now()) return null;
    return member;
}

export const GET = saasHandler(async (_request: NextRequest, { params }: { params: Promise<{ token: string }> }) => {
    const { token } = await params;
    const invite = await findInvite(token);
    if (!invite) throw new SaasApiError("Invitation invalide ou expirée. Demandez un nouveau lien.", 404);
    return ok({ email: invite.email, name: invite.name, role: invite.role, accountName: invite.account.name });
});

const acceptSchema = z.object({
    name: z.string().trim().min(2, "Votre nom est requis.").max(80),
    password: passwordSchema,
});

export const POST = saasHandler(async (request: NextRequest, { params }: { params: Promise<{ token: string }> }) => {
    const ip = getClientIp(request) ?? "unknown";
    if (!checkRateLimit(`saas-invite:${ip}`, 10, 15 * 60 * 1000).allowed) {
        throw new SaasApiError("Trop de tentatives. Réessayez plus tard.", 429);
    }
    const { token } = await params;
    const body = await parseBody(request, acceptSchema);
    const invite = await findInvite(token);
    if (!invite) throw new SaasApiError("Invitation invalide ou expirée. Demandez un nouveau lien.", 404);

    const passwordHash = await bcrypt.hash(body.password, 12);
    // Conditional on the token hash: a link can only be redeemed once.
    const res = await prisma.saasMember.updateMany({
        where: { id: invite.id, status: "INVITED", inviteTokenHash: invite.inviteTokenHash },
        data: {
            name: body.name,
            passwordHash,
            status: "ACTIVE",
            inviteTokenHash: null,
            inviteExpiresAt: null,
            lastLoginAt: new Date(),
        },
    });
    if (res.count === 0) throw new SaasApiError("Cette invitation a déjà été utilisée.", 409);

    await logAccountEvent(invite.accountId, invite.id, "member.joined", { role: invite.role });
    await createSaasSession({ id: invite.id, accountId: invite.accountId, sessionVersion: invite.sessionVersion });
    return ok({ next: invite.role === "CLIENT_VIEWER" ? "/espace" : "/espace/onboarding" });
});
