import { NextRequest } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/geo-ip";
import { checkRateLimit, resetRateLimit } from "@/lib/rate-limit";
import { createSaasSession } from "@/lib/saas/session";
import {
    SaasApiError,
    hasProductAccess,
    logAccountEvent,
    ok,
    parseBody,
    refreshAccountStatus,
    saasHandler,
} from "@/lib/saas/account";
import { emailSchema } from "@/lib/saas/validation";

const loginSchema = z.object({
    email: emailSchema,
    password: z.string().min(1, "Mot de passe requis.").max(128),
});

// Compared against when the email is unknown, so both paths cost one bcrypt.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 12);

export const POST = saasHandler(async (request: NextRequest) => {
    const { email, password } = await parseBody(request, loginSchema);
    const ip = getClientIp(request) ?? "unknown";
    const key = `saas-login:${ip}:${email}`;
    const limit = checkRateLimit(key, 5, 15 * 60 * 1000);
    if (!limit.allowed) {
        throw new SaasApiError(
            limit.lockoutMinutes
                ? `Trop de tentatives. Réessayez dans ${limit.lockoutMinutes} minutes.`
                : "Trop de tentatives. Réessayez plus tard.",
            429
        );
    }

    const member = await prisma.saasMember.findUnique({ where: { email }, include: { account: true } });
    const valid = await bcrypt.compare(password, member?.passwordHash ?? DUMMY_HASH);
    if (!member || !member.passwordHash || !valid) {
        throw new SaasApiError("Email ou mot de passe incorrect.", 401);
    }
    if (member.status !== "ACTIVE") {
        throw new SaasApiError("Ce compte est désactivé. Contactez l'administrateur de votre espace.", 403);
    }

    resetRateLimit(key);
    await prisma.saasMember.update({ where: { id: member.id }, data: { lastLoginAt: new Date() } });
    await logAccountEvent(member.accountId, member.id, "member.login", { ip });
    await createSaasSession(member);

    const account = await refreshAccountStatus(member.account);
    const next = !hasProductAccess(account)
        ? "/espace/paiement"
        : account.onboardingCompletedAt
          ? "/espace"
          : "/espace/onboarding";
    return ok({ next });
});
