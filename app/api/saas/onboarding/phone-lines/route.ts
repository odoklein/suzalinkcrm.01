import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
    SaasApiError,
    assertQuota,
    logAccountEvent,
    ok,
    parseBody,
    quotasFor,
    randomToken,
    requireSaasMember,
    saasHandler,
} from "@/lib/saas/account";
import { normalizePhone } from "@/lib/saas/onboarding-service";

const lineSchema = z.object({
    provider: z.enum(["ALLO", "ONOFF"]),
    phoneNumber: z.string().trim().min(6, "Numéro requis.").max(30),
    label: z.string().trim().max(60).optional(),
});

export const POST = saasHandler(async (request: NextRequest) => {
    const { account, member } = await requireSaasMember({ admin: true, productAccess: true });
    const body = await parseBody(request, lineSchema);
    const phoneNumber = normalizePhone(body.phoneNumber);

    const count = await prisma.saasPhoneLine.count({ where: { accountId: account.id } });
    assertQuota("lignes téléphoniques", count, 1, quotasFor(account).phoneLines);

    const exists = await prisma.saasPhoneLine.findUnique({
        where: { accountId_phoneNumber: { accountId: account.id, phoneNumber } },
    });
    if (exists) throw new SaasApiError("Ce numéro est déjà connecté.", 409);

    const line = await prisma.saasPhoneLine.create({
        data: {
            accountId: account.id,
            provider: body.provider,
            phoneNumber,
            label: body.label || null,
            webhookToken: randomToken(24),
        },
    });
    await logAccountEvent(account.id, member.id, "phone_line.added", { provider: line.provider });
    return ok({ id: line.id }, 201);
});
