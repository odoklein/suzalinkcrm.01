import { NextRequest } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/geo-ip";
import { checkRateLimit } from "@/lib/rate-limit";
import { createSaasSession } from "@/lib/saas/session";
import { SaasApiError, logAccountEvent, ok, parseBody, saasHandler, uniqueSlug } from "@/lib/saas/account";
import { PLANS, TRIAL_DAYS, validateExtraSeats } from "@/lib/saas/plans";
import { emailSchema, passwordSchema } from "@/lib/saas/validation";

const signupSchema = z.object({
    plan: z.enum(["INDEPENDANT", "SMALL_BUSINESS", "MEDIUM_BUSINESS"]),
    cycle: z.enum(["MONTHLY", "ANNUAL"]),
    extraSeats: z.number().int().min(0).default(0),
    includeSetup: z.boolean().default(false),
    owner: z.object({
        name: z.string().trim().min(2, "Votre nom est requis.").max(80),
        email: emailSchema,
        password: passwordSchema,
    }),
    company: z.object({
        name: z.string().trim().min(2, "Nom de l'entreprise requis.").max(120),
        size: z.enum(["1", "2-5", "6-10", "11-50", "51-200", "200+"]),
        industry: z.string().trim().max(80).optional(),
        phone: z.string().trim().max(30).optional(),
        country: z.string().length(2).default("FR"),
        siret: z
            .string()
            .trim()
            .regex(/^(\d{14})?$/, "SIRET : 14 chiffres.")
            .optional(),
        vatNumber: z.string().trim().max(20).optional(),
        useCase: z.string().trim().max(400).optional(),
    }),
    acceptTerms: z.literal(true, { message: "Vous devez accepter les conditions." }),
    /** Honeypot: humans never see this field. */
    website: z.string().max(0).optional(),
});

export const POST = saasHandler(async (request: NextRequest) => {
    const ip = getClientIp(request) ?? "unknown";
    if (!checkRateLimit(`saas-signup:${ip}`, 5, 60 * 60 * 1000).allowed) {
        throw new SaasApiError("Trop d'inscriptions depuis cette adresse. Réessayez plus tard.", 429);
    }

    const body = await parseBody(request, signupSchema);
    const plan = PLANS[body.plan];
    const extraSeats = validateExtraSeats(body.plan, body.extraSeats);

    const taken = await prisma.saasMember.findUnique({ where: { email: body.owner.email }, select: { id: true } });
    if (taken) {
        throw new SaasApiError("Un compte existe déjà avec cet email. Connectez-vous.", 409, "email_taken");
    }

    const passwordHash = await bcrypt.hash(body.owner.password, 12);
    const slug = await uniqueSlug(body.company.name);
    const now = new Date();

    const { account, member } = await prisma.$transaction(async (tx) => {
        const account = await tx.saasAccount.create({
            data: {
                name: body.company.name,
                slug,
                planCode: body.plan,
                billingCycle: body.cycle,
                extraSeats,
                setupServiceRequested: body.includeSetup,
                status: plan.trialAvailable ? "TRIALING" : "PENDING_PAYMENT",
                trialEndsAt: plan.trialAvailable ? new Date(now.getTime() + TRIAL_DAYS * 86_400_000) : null,
                companySize: body.company.size,
                industry: body.company.industry || null,
                phone: body.company.phone || null,
                country: body.company.country,
                siret: body.company.siret || null,
                vatNumber: body.company.vatNumber || null,
                useCase: body.company.useCase || null,
            },
        });
        const member = await tx.saasMember.create({
            data: {
                accountId: account.id,
                email: body.owner.email,
                name: body.owner.name,
                passwordHash,
                role: "OWNER",
                status: "ACTIVE",
                lastLoginAt: now,
            },
        });
        await logAccountEvent(
            account.id,
            member.id,
            "account.created",
            { plan: body.plan, cycle: body.cycle, extraSeats, trial: plan.trialAvailable, ip },
            tx
        );
        return { account, member };
    });

    await createSaasSession(member);

    return ok(
        {
            accountId: account.id,
            status: account.status,
            next: account.status === "PENDING_PAYMENT" ? "/espace/paiement" : "/espace/onboarding",
        },
        201
    );
});
