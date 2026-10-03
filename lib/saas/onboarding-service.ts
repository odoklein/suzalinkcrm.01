// ============================================
// ONBOARDING SERVICE — validates and applies each wizard step.
//
// Every step goes through applyStep(): "save" stores a draft, "complete"
// validates (payload + quotas + real state such as a verified phone line) and
// writes the side effects in one transaction, "skip" is allowed for optional
// steps only. The wizard can be reloaded at any point: everything it shows
// comes from loadOnboardingState().
// ============================================

import { z } from "zod";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import type { Prisma, SaasAccount, SaasMemberRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { brandUrl } from "@/lib/brand";
import {
    SaasApiError,
    assertQuota,
    getAccountUsage,
    isAdmin,
    logAccountEvent,
    quotasFor,
    randomToken,
    sha256,
    type SaasContext,
} from "./account";
import {
    getStepDefinition,
    stepsForPlan,
    summarizeProgress,
    type OnboardingStepKey,
    type StepStatus,
} from "./onboarding-steps";
import { buildDemoFiche } from "./demo-fiche";
import type { PlanCode } from "./plans";

export const INVITE_TTL_DAYS = 7;

// --------------------------------------------
// Schemas
// --------------------------------------------

const email = z.string().trim().toLowerCase().email("Adresse email invalide.");
const shortText = (max: number, label: string) =>
    z.string().trim().min(1, `${label} requis.`).max(max, `${label} : ${max} caractères maximum.`);
const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Couleur au format #RRGGBB attendue.");
const domainName = z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/, "Nom de domaine invalide (ex. crm.votreagence.com).");

const schemas = {
    profile: z.object({
        jobRole: z.enum(["SDR", "CLOSER", "MANAGER", "FOUNDER", "FREELANCE", "OTHER"]),
        dailyCallTarget: z.number().int().min(5, "Au moins 5 appels.").max(400, "400 appels maximum."),
        experience: z.enum(["BEGINNER", "INTERMEDIATE", "EXPERT"]),
        timezone: z.string().min(3).max(64),
    }),
    company: z.object({
        offer: z.string().trim().min(15, "Décrivez votre offre en une phrase (15 caractères min.).").max(600),
        targetIndustries: z.array(shortText(60, "Secteur")).min(1, "Choisissez au moins un secteur.").max(12),
        targetCompanySizes: z.array(z.enum(["1-10", "11-50", "51-200", "201-1000", "1000+"])).min(1, "Choisissez au moins une taille."),
        targetPersonas: z.string().trim().min(2, "Indiquez au moins un poste cible.").max(300),
        averageDealSize: z.enum(["<1k", "1-5k", "5-20k", "20-100k", ">100k"]),
    }),
    // Lines are added/tested through /api/saas/onboarding/phone-lines; completing only checks one is verified.
    phone_line: z.object({}).passthrough(),
    workspaces: z.object({
        workspaces: z
            .array(
                z.object({
                    name: shortText(60, "Nom du workspace"),
                    description: z.string().trim().max(200).optional(),
                    color: hexColor.optional(),
                })
            )
            .min(1, "Créez au moins un workspace.")
            .max(200),
    }),
    import_contacts: z.discriminatedUnion("source", [
        z.object({
            source: z.literal("file"),
            fileName: shortText(200, "Nom du fichier"),
            rowCount: z.number().int().min(1, "Le fichier est vide.").max(1_000_000),
            validCount: z.number().int().min(1, "Aucune ligne exploitable (nom + téléphone ou email)."),
            duplicateCount: z.number().int().min(0),
            mapping: z.record(z.string(), z.string()),
            sample: z.array(z.record(z.string(), z.string())).max(5).optional(),
        }),
        z.object({ source: z.literal("demo") }),
    ]),
    call_outcomes: z.object({
        outcomes: z
            .array(
                z.object({
                    key: z.string().regex(/^[A-Z_]{2,40}$/),
                    label: shortText(40, "Libellé"),
                    enabled: z.boolean(),
                    recycleAfterDays: z.number().int().min(0).max(365).nullable(),
                })
            )
            .min(2)
            .max(20)
            .refine((o) => o.some((x) => x.enabled && x.key === "MEETING_BOOKED"), {
                message: "L'issue « Rendez-vous pris » doit rester active.",
            }),
    }),
    team: z.object({
        invites: z
            .array(
                z.object({
                    email,
                    name: shortText(80, "Nom"),
                    role: z.enum(["ADMIN", "MANAGER", "SDR", "CLOSER"]),
                })
            )
            .max(200),
        soloForNow: z.boolean().optional(),
    }),
    exclusions: z.object({
        excludedDomains: z.array(domainName).max(5_000),
        competitorDomains: z.array(domainName).max(500),
        lockDays: z.number().int().min(0).max(365),
        excludeExistingClients: z.boolean(),
    }),
    manager_cockpit: z
        .object({
            callsPerHour: z.number().int().min(1).max(120),
            meetingsPerWeek: z.number().int().min(0).max(200),
            workStart: z.string().regex(/^\d{2}:\d{2}$/),
            workEnd: z.string().regex(/^\d{2}:\d{2}$/),
            workDays: z.array(z.enum(["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"])).min(1, "Au moins un jour travaillé."),
            alertBelowPacePercent: z.number().int().min(10).max(100),
        })
        .refine((v) => v.workStart < v.workEnd, { message: "L'heure de fin doit suivre l'heure de début." }),
    white_label: z.object({
        brandName: shortText(60, "Nom de marque"),
        customDomain: domainName,
        logoUrl: z.union([z.literal(""), z.string().trim().url("URL du logo invalide.").max(500)]).optional(),
        primaryColor: hexColor,
        accentColor: hexColor,
        senderEmail: z.union([z.literal(""), email]).optional(),
    }),
    client_viewer: z.object({
        invites: z
            .array(z.object({ email, name: shortText(80, "Nom") }))
            .max(500),
    }),
    api_webhooks: z.object({
        sources: z.array(z.enum(["TYPEFORM", "META_ADS", "GOOGLE_ADS", "LINKEDIN", "ZAPIER", "CUSTOM"])).max(10),
    }),
    first_call: z.object({
        prospectCompany: shortText(80, "Entreprise"),
        prospectName: shortText(80, "Contact"),
        outcome: z.enum(["MEETING_BOOKED", "CALLBACK", "GATEKEEPER", "NOT_INTERESTED"]),
        notes: z.string().trim().max(2_000),
        meetingAt: z.string().max(40).optional(),
    }),
    go_live: z.object({}).passthrough(),
} satisfies Record<OnboardingStepKey, z.ZodType>;

export type StepAction = "save" | "complete" | "skip";

// --------------------------------------------
// State
// --------------------------------------------

export async function loadOnboardingState(ctx: SaasContext) {
    const { account } = ctx;
    const plan = account.planCode as PlanCode;
    const [rows, workspaces, phoneLines, members, imports, apiKeys, usage] = await Promise.all([
        prisma.saasOnboardingStep.findMany({ where: { accountId: account.id } }),
        prisma.saasWorkspace.findMany({ where: { accountId: account.id }, orderBy: { createdAt: "asc" } }),
        prisma.saasPhoneLine.findMany({ where: { accountId: account.id }, orderBy: { createdAt: "asc" } }),
        prisma.saasMember.findMany({
            where: { accountId: account.id, status: { not: "DISABLED" } },
            orderBy: { createdAt: "asc" },
            select: { id: true, email: true, name: true, role: true, status: true, inviteExpiresAt: true, createdAt: true },
        }),
        prisma.saasContactImport.findMany({ where: { accountId: account.id }, orderBy: { createdAt: "desc" }, take: 10 }),
        prisma.saasApiKey.findMany({
            where: { accountId: account.id, revokedAt: null },
            orderBy: { createdAt: "desc" },
            select: { id: true, name: true, prefix: true, createdAt: true, lastUsedAt: true },
        }),
        getAccountUsage(account.id),
    ]);

    const steps = stepsForPlan(plan).map((def) => {
        const row = rows.find((r) => r.stepKey === def.key);
        return {
            ...def,
            status: (row?.status ?? "PENDING") as StepStatus,
            data: row?.data ?? null,
            completedAt: row?.completedAt ?? null,
        };
    });

    return {
        steps,
        summary: summarizeProgress(
            plan,
            steps.map((s) => ({ key: s.key, status: s.status }))
        ),
        completedAt: account.onboardingCompletedAt,
        resources: {
            workspaces,
            phoneLines: phoneLines.map((l) => ({
                ...l,
                webhookUrl: brandUrl(`/api/webhooks/saas/${l.provider.toLowerCase()}/${l.webhookToken}`),
            })),
            members,
            imports,
            apiKeys,
        },
        usage,
        quotas: quotasFor(account),
        whiteLabel: account.whiteLabel,
        settings: account.settings,
    };
}

// --------------------------------------------
// Apply
// --------------------------------------------

type Tx = Prisma.TransactionClient;

interface ApplyResult {
    status: StepStatus;
    /** Extra data the UI needs right after the action (invite links, generated fiche…). */
    result?: Record<string, unknown>;
}

export async function applyStep(
    ctx: SaasContext,
    stepKey: string,
    action: StepAction,
    payload: unknown
): Promise<ApplyResult> {
    const def = getStepDefinition(stepKey);
    const plan = ctx.account.planCode as PlanCode;
    if (!def || !def.plans.includes(plan)) {
        throw new SaasApiError("Étape inconnue pour votre offre.", 404);
    }
    if (def.adminOnly && !isAdmin(ctx.member.role)) {
        throw new SaasApiError("Seul un administrateur du compte peut configurer cette étape.", 403);
    }
    const key = def.key;
    const accountId = ctx.account.id;

    if (action === "skip") {
        if (def.required) throw new SaasApiError("Cette étape est indispensable et ne peut pas être passée.");
        await upsertStep(prisma, accountId, key, { status: "SKIPPED", completedBy: ctx.member.id });
        await markStarted(ctx.account);
        await logAccountEvent(accountId, ctx.member.id, "onboarding.step_skipped", { step: key });
        return { status: "SKIPPED" };
    }

    const schema = schemas[key] as z.ZodType;
    if (action === "save") {
        // Drafts are stored as-is (partial forms), but must still be an object of sane size.
        if (typeof payload !== "object" || payload === null || JSON.stringify(payload).length > 200_000) {
            throw new SaasApiError("Brouillon invalide.");
        }
        const existing = await prisma.saasOnboardingStep.findUnique({
            where: { accountId_stepKey: { accountId, stepKey: key } },
        });
        // Saving a draft never reopens a finished step.
        const status = existing?.status ?? "PENDING";
        await upsertStep(prisma, accountId, key, { status, data: payload as Prisma.InputJsonValue });
        await markStarted(ctx.account);
        return { status };
    }

    const parsed = schema.safeParse(payload);
    if (!parsed.success) {
        throw new SaasApiError(parsed.error.issues[0]?.message ?? "Données invalides.");
    }
    const data = parsed.data;

    const result = await prisma.$transaction(
        async (tx) => {
            const extra = await STEP_EFFECTS[key](tx, ctx, data);
            await upsertStep(tx, accountId, key, {
                status: "COMPLETED",
                data: (extra?.storedData ?? data) as Prisma.InputJsonValue,
                completedAt: new Date(),
                completedBy: ctx.member.id,
            });
            return extra?.result;
        },
        { timeout: 20_000 }
    );

    await markStarted(ctx.account);
    await logAccountEvent(accountId, ctx.member.id, "onboarding.step_completed", { step: key });
    return { status: "COMPLETED", result };
}

async function upsertStep(
    tx: Tx,
    accountId: string,
    stepKey: OnboardingStepKey,
    fields: { status: StepStatus; data?: Prisma.InputJsonValue; completedAt?: Date; completedBy?: string }
) {
    await tx.saasOnboardingStep.upsert({
        where: { accountId_stepKey: { accountId, stepKey } },
        create: { accountId, stepKey, ...fields },
        update: fields,
    });
}

async function markStarted(account: SaasAccount) {
    if (account.onboardingStartedAt) return;
    await prisma.saasAccount.updateMany({
        where: { id: account.id, onboardingStartedAt: null },
        data: { onboardingStartedAt: new Date() },
    });
}

async function mergeSettings(tx: Tx, accountId: string, patch: Record<string, unknown>) {
    const acc = await tx.saasAccount.findUniqueOrThrow({ where: { id: accountId }, select: { settings: true } });
    const current = (acc.settings && typeof acc.settings === "object" ? acc.settings : {}) as Record<string, unknown>;
    await tx.saasAccount.update({
        where: { id: accountId },
        data: { settings: { ...current, ...patch } as Prisma.InputJsonValue },
    });
}

type EffectReturn = { storedData?: unknown; result?: Record<string, unknown> } | void;
type Effect = (tx: Tx, ctx: SaasContext, data: any) => Promise<EffectReturn>; // eslint-disable-line @typescript-eslint/no-explicit-any

export function normalizePhone(raw: string): string {
    const parsed = parsePhoneNumberFromString(raw, "FR");
    if (!parsed || !parsed.isValid()) throw new SaasApiError(`Numéro invalide : ${raw}`);
    return parsed.number; // E.164
}

async function createInvites(
    tx: Tx,
    ctx: SaasContext,
    invites: { email: string; name: string; role: SaasMemberRole }[]
) {
    const accountId = ctx.account.id;
    const emails = invites.map((i) => i.email);
    if (new Set(emails).size !== emails.length) throw new SaasApiError("Une adresse email apparaît deux fois.");

    const existing = await tx.saasMember.findMany({ where: { email: { in: emails } } });
    const links: { email: string; name: string; role: string; url: string }[] = [];
    for (const invite of invites) {
        const found = existing.find((m) => m.email === invite.email);
        if (found && found.accountId !== accountId) {
            throw new SaasApiError(`${invite.email} est déjà utilisé par un autre compte.`, 409);
        }
        if (found && found.status === "ACTIVE") continue; // already on the team
        const token = randomToken();
        const inviteData = {
            name: invite.name,
            role: invite.role,
            status: "INVITED" as const,
            inviteTokenHash: sha256(token),
            inviteExpiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 86_400_000),
            invitedById: ctx.member.id,
        };
        if (found) {
            await tx.saasMember.update({ where: { id: found.id }, data: inviteData });
        } else {
            await tx.saasMember.create({ data: { accountId, email: invite.email, ...inviteData } });
        }
        links.push({ email: invite.email, name: invite.name, role: invite.role, url: brandUrl(`/espace/invitation/${token}`) });
    }
    return links;
}

const STEP_EFFECTS: Record<OnboardingStepKey, Effect> = {
    profile: async (tx, ctx, data) => {
        const prefs = (ctx.member.preferences && typeof ctx.member.preferences === "object" ? ctx.member.preferences : {}) as Record<string, unknown>;
        await tx.saasMember.update({
            where: { id: ctx.member.id },
            data: { jobTitle: data.jobRole, preferences: { ...prefs, profile: data } },
        });
    },

    company: async (tx, ctx, data) => {
        await mergeSettings(tx, ctx.account.id, { icp: data });
    },

    phone_line: async (tx, ctx) => {
        const lines = await tx.saasPhoneLine.findMany({ where: { accountId: ctx.account.id } });
        if (lines.length === 0) throw new SaasApiError("Ajoutez au moins une ligne Allo ou OnOff.");
        if (!lines.some((l) => l.verifiedAt)) {
            throw new SaasApiError(
                "Aucune ligne vérifiée : collez l'URL de webhook dans Allo/OnOff puis cliquez sur « Tester la connexion ».",
                409,
                "line_not_verified"
            );
        }
        return { storedData: { lines: lines.map((l) => ({ provider: l.provider, phoneNumber: l.phoneNumber, verified: Boolean(l.verifiedAt) })) } };
    },

    workspaces: async (tx, ctx, data: z.infer<typeof schemas.workspaces>) => {
        const accountId = ctx.account.id;
        const names = data.workspaces.map((w) => w.name.toLowerCase());
        if (new Set(names).size !== names.length) throw new SaasApiError("Deux workspaces portent le même nom.");
        assertQuota("workspaces", 0, data.workspaces.length, quotasFor(ctx.account).workspaces);

        const current = await tx.saasWorkspace.findMany({ where: { accountId } });
        const wanted = new Set(data.workspaces.map((w) => w.name));
        await tx.saasWorkspace.deleteMany({ where: { accountId, name: { notIn: [...wanted] } } });
        for (const ws of data.workspaces) {
            const found = current.find((c) => c.name === ws.name);
            if (found) {
                await tx.saasWorkspace.update({
                    where: { id: found.id },
                    data: { description: ws.description || null, color: ws.color || null },
                });
            } else {
                await tx.saasWorkspace.create({
                    data: { accountId, name: ws.name, description: ws.description || null, color: ws.color || null },
                });
            }
        }
    },

    import_contacts: async (tx, ctx, data: z.infer<typeof schemas.import_contacts>) => {
        const accountId = ctx.account.id;
        const quotas = quotasFor(ctx.account);
        const used = (await tx.saasContactImport.aggregate({ where: { accountId }, _sum: { validCount: true } }))._sum.validCount ?? 0;

        if (data.source === "demo") {
            const demoCount = 40;
            assertQuota("contacts", used, demoCount, quotas.contacts);
            const imp = await tx.saasContactImport.create({
                data: {
                    accountId,
                    fileName: "Jeu de démonstration (40 contacts fictifs)",
                    rowCount: demoCount,
                    validCount: demoCount,
                    mapping: { demo: "true" },
                    createdById: ctx.member.id,
                },
            });
            return { storedData: { source: "demo", importId: imp.id } };
        }

        if (data.validCount > data.rowCount) throw new SaasApiError("Comptage incohérent : plus de lignes valides que de lignes.");
        const mapped = Object.values(data.mapping);
        if (!mapped.includes("phone") && !mapped.includes("email")) {
            throw new SaasApiError("Associez au moins une colonne Téléphone ou Email.");
        }
        assertQuota("contacts", used, data.validCount, quotas.contacts);
        const imp = await tx.saasContactImport.create({
            data: {
                accountId,
                fileName: data.fileName,
                rowCount: data.rowCount,
                validCount: data.validCount,
                duplicateCount: data.duplicateCount,
                mapping: data.mapping,
                sample: data.sample ?? undefined,
                createdById: ctx.member.id,
            },
        });
        return { storedData: { source: "file", importId: imp.id, validCount: data.validCount } };
    },

    call_outcomes: async (tx, ctx, data) => {
        await mergeSettings(tx, ctx.account.id, { callOutcomes: data.outcomes });
    },

    team: async (tx, ctx, data: z.infer<typeof schemas.team>) => {
        if (data.invites.length === 0 && !data.soloForNow) {
            throw new SaasApiError("Invitez au moins un collègue, ou indiquez que vous démarrez seul pour l'instant.");
        }
        if (data.invites.some((i) => i.email === ctx.member.email)) {
            throw new SaasApiError("Vous faites déjà partie de l'équipe.");
        }
        const usage = await tx.saasMember.count({
            where: {
                accountId: ctx.account.id,
                status: { not: "DISABLED" },
                role: { not: "CLIENT_VIEWER" },
                email: { notIn: data.invites.map((i) => i.email) },
            },
        });
        assertQuota("sièges", usage, data.invites.length, quotasFor(ctx.account).seats);
        const links = await createInvites(tx, ctx, data.invites);
        return { storedData: { invited: data.invites.length, soloForNow: Boolean(data.soloForNow) }, result: { inviteLinks: links } };
    },

    exclusions: async (tx, ctx, data) => {
        await mergeSettings(tx, ctx.account.id, { exclusions: data });
    },

    manager_cockpit: async (tx, ctx, data) => {
        await mergeSettings(tx, ctx.account.id, { cockpit: data });
    },

    white_label: async (tx, ctx, data: z.infer<typeof schemas.white_label>) => {
        const current = (ctx.account.whiteLabel && typeof ctx.account.whiteLabel === "object" ? ctx.account.whiteLabel : {}) as Record<string, unknown>;
        const domainChanged = current.customDomain !== data.customDomain;
        await tx.saasAccount.update({
            where: { id: ctx.account.id },
            data: {
                whiteLabel: {
                    ...data,
                    dnsVerifiedAt: domainChanged ? null : (current.dnsVerifiedAt ?? null),
                } as Prisma.InputJsonValue,
            },
        });
    },

    client_viewer: async (tx, ctx, data: z.infer<typeof schemas.client_viewer>) => {
        if (data.invites.length === 0) throw new SaasApiError("Ajoutez au moins un client, ou passez cette étape.");
        const links = await createInvites(
            tx,
            ctx,
            data.invites.map((i) => ({ email: i.email, name: i.name, role: "CLIENT_VIEWER" as const }))
        );
        return { result: { inviteLinks: links } };
    },

    api_webhooks: async (tx, ctx, data) => {
        await mergeSettings(tx, ctx.account.id, { inboundSources: data.sources });
    },

    first_call: async (tx, ctx, data: z.infer<typeof schemas.first_call>) => {
        const settings = (ctx.account.settings ?? {}) as { icp?: { offer?: string } };
        const fiche =
            data.outcome === "MEETING_BOOKED"
                ? buildDemoFiche({ ...data, offer: settings.icp?.offer })
                : null;
        return { storedData: { ...data, fiche }, result: { fiche } };
    },

    go_live: async (tx, ctx) => {
        const rows = await tx.saasOnboardingStep.findMany({ where: { accountId: ctx.account.id } });
        const summary = summarizeProgress(
            ctx.account.planCode as PlanCode,
            rows.map((r) => ({ key: r.stepKey as OnboardingStepKey, status: r.status }))
        );
        if (!summary.canFinish) {
            const titles = summary.requiredRemaining.map((k) => getStepDefinition(k)?.title ?? k);
            throw new SaasApiError(`Il reste des étapes indispensables : ${titles.join(", ")}.`, 409, "steps_remaining");
        }
        await tx.saasAccount.update({
            where: { id: ctx.account.id },
            data: { onboardingCompletedAt: ctx.account.onboardingCompletedAt ?? new Date() },
        });
    },
};
