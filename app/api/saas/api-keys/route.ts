import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
    SaasApiError,
    logAccountEvent,
    ok,
    parseBody,
    randomToken,
    requireSaasMember,
    saasHandler,
    sha256,
} from "@/lib/saas/account";
import { planHasFeature, type PlanCode } from "@/lib/saas/plans";

const MAX_ACTIVE_KEYS = 10;

const createSchema = z.object({ name: z.string().trim().min(2, "Nommez la clé.").max(60) });

/** Creates an API key. The plaintext is returned once and only its SHA-256 is stored. */
export const POST = saasHandler(async (request: NextRequest) => {
    const { account, member } = await requireSaasMember({ admin: true, productAccess: true });
    if (!planHasFeature(account.planCode as PlanCode, "apiWebhooks")) {
        throw new SaasApiError("L'API est incluse dans l'offre Medium Business.", 403);
    }
    const { name } = await parseBody(request, createSchema);
    const active = await prisma.saasApiKey.count({ where: { accountId: account.id, revokedAt: null } });
    if (active >= MAX_ACTIVE_KEYS) throw new SaasApiError(`${MAX_ACTIVE_KEYS} clés actives maximum. Révoquez-en une.`, 409);

    const secret = `cpk_live_${randomToken(24)}`;
    const key = await prisma.saasApiKey.create({
        data: {
            accountId: account.id,
            name,
            prefix: secret.slice(0, 14),
            keyHash: sha256(secret),
            createdById: member.id,
        },
    });
    await logAccountEvent(account.id, member.id, "api_key.created", { id: key.id, name });
    return ok({ id: key.id, name: key.name, prefix: key.prefix, secret }, 201);
});
