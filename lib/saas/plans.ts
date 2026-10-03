// ============================================
// SAAS PLANS — the single source of truth for prices, quotas and features of
// the self-serve offers (OFFRES_ET_DIFFERENCIATION_MARCHE.md §4).
//
// Pure module: no Prisma, no Next. Imported by the pricing page, the checkout
// (amounts are always recomputed here, never trusted from the browser), the
// quota guards and the tests.
// ============================================

export type PlanCode = "INDEPENDANT" | "SMALL_BUSINESS" | "MEDIUM_BUSINESS";
export type BillingCycle = "MONTHLY" | "ANNUAL";

export const TRIAL_DAYS = 14;
export const VAT_RATE = 0.2;
/** Contact quota while trialing: enough to try for real, not to run a campaign for free. */
export const TRIAL_CONTACT_CAP = 2_000;
export const TRIAL_AI_FICHE_CAP = 25;

export type FeatureKey =
    | "callQueue"
    | "emailTemplates"
    | "callVault"
    | "aiFiche"
    | "csvExport"
    | "managerCockpit"
    | "exclusions"
    | "hrTracking"
    | "leadRecycling"
    | "whiteLabel"
    | "clientViewer"
    | "apiWebhooks"
    | "priorityQueue";

export interface PlanQuotas {
    /** Seats included in the base price. */
    includedSeats: number;
    /** Hard cap on total seats (included + extra); null = unlimited. */
    maxSeats: number | null;
    /** null = unlimited */
    workspaces: number | null;
    contacts: number;
    /** null = unlimited */
    phoneLines: number | null;
    callVaultHours: number;
    aiFichesPerMonth: number;
    storageGb: number;
}

export interface PlanDefinition {
    code: PlanCode;
    name: string;
    tagline: string;
    audience: string;
    badge?: string;
    /** Prices in euro cents HT, per month. */
    monthlyPriceCents: number;
    annualMonthlyPriceCents: number;
    extraSeatCents: number | null;
    setupFeeCents: number;
    setupLabel: string;
    trialAvailable: boolean;
    supportLabel: string;
    quotas: PlanQuotas;
    features: FeatureKey[];
    highlights: string[];
}

const BASE_FEATURES: FeatureKey[] = ["callQueue", "emailTemplates", "callVault", "aiFiche", "csvExport"];
const SMALL_FEATURES: FeatureKey[] = [...BASE_FEATURES, "managerCockpit", "exclusions", "hrTracking", "leadRecycling"];
const MEDIUM_FEATURES: FeatureKey[] = [...SMALL_FEATURES, "whiteLabel", "clientViewer", "apiWebhooks", "priorityQueue"];

export const PLANS: Record<PlanCode, PlanDefinition> = {
    INDEPENDANT: {
        code: "INDEPENDANT",
        name: "Indépendant",
        tagline: "Solo, freelance, closer",
        audience: "SDR indépendant, consultant B2B ou solopreneur qui gère sa propre prospection.",
        monthlyPriceCents: 6_900,
        annualMonthlyPriceCents: 5_900,
        extraSeatCents: null,
        setupFeeCents: 15_000,
        setupLabel: "Configuration domaine + 1 ligne Allo/OnOff + import de votre base",
        trialAvailable: true,
        supportLabel: "Support ticket & email (SLA 48h)",
        quotas: {
            includedSeats: 1,
            maxSeats: 1,
            workspaces: 1,
            contacts: 15_000,
            phoneLines: 1,
            callVaultHours: 20,
            aiFichesPerMonth: 150,
            storageGb: 5,
        },
        features: BASE_FEATURES,
        highlights: [
            "File d'appels & qualification en 1 clic",
            "Call Vault : 20 h d'appels enregistrés / mois",
            "150 Fiches de RDV Mistral AI / mois",
            "15 000 contacts, 1 ligne Allo ou OnOff",
        ],
    },
    SMALL_BUSINESS: {
        code: "SMALL_BUSINESS",
        name: "Small Business",
        tagline: "Équipes de 3 à 7 commerciaux",
        audience: "Startups B2B et TPE/PME avec un manager qui pilote le rythme de l'équipe.",
        badge: "Le plus populaire",
        monthlyPriceCents: 22_900,
        annualMonthlyPriceCents: 18_900,
        extraSeatCents: 4_900,
        setupFeeCents: 35_000,
        setupLabel: "Mapping des numéros, DNS, session live de prise en main (45 min)",
        trialAvailable: true,
        supportLabel: "Support prioritaire Slack / WhatsApp (SLA 12h)",
        quotas: {
            includedSeats: 3,
            maxSeats: 7,
            workspaces: 3,
            contacts: 60_000,
            phoneLines: 3,
            callVaultHours: 80,
            aiFichesPerMonth: 600,
            storageGb: 25,
        },
        features: SMALL_FEATURES,
        highlights: [
            "3 sièges inclus, jusqu'à 7 (+49 €/siège)",
            "Cockpit Manager temps réel (Pace, conversion)",
            "Moteur d'exclusions & anti-collision",
            "Recyclage automatique des leads",
        ],
    },
    MEDIUM_BUSINESS: {
        code: "MEDIUM_BUSINESS",
        name: "Medium Business",
        tagline: "Agences & PME en forte croissance",
        audience: "Agences de prospection et équipes de 8 à 30 commerciaux, marque blanche incluse.",
        badge: "Puissance & marque blanche",
        monthlyPriceCents: 49_900,
        annualMonthlyPriceCents: 41_900,
        extraSeatCents: 3_900,
        setupFeeCents: 75_000,
        setupLabel: "Setup White-Glove : domaine personnalisé, intégration complète, formation équipe",
        trialAvailable: false,
        supportLabel: "Account Manager dédié, ligne directe (SLA 4h)",
        quotas: {
            includedSeats: 8,
            maxSeats: null,
            workspaces: null,
            contacts: 250_000,
            phoneLines: null,
            callVaultHours: 250,
            aiFichesPerMonth: 2_500,
            storageGb: 100,
        },
        features: MEDIUM_FEATURES,
        highlights: [
            "8 sièges inclus (+39 €/siège, sans limite)",
            "Marque blanche complète (domaine, logo, couleurs)",
            "Rôle « Client Spectateur » pour vos clients",
            "Webhooks & API d'ingestion sur mesure",
        ],
    },
};

export const PLAN_ORDER: PlanCode[] = ["INDEPENDANT", "SMALL_BUSINESS", "MEDIUM_BUSINESS"];

export function isPlanCode(value: unknown): value is PlanCode {
    return typeof value === "string" && value in PLANS;
}

export function isBillingCycle(value: unknown): value is BillingCycle {
    return value === "MONTHLY" || value === "ANNUAL";
}

export function planHasFeature(plan: PlanCode, feature: FeatureKey): boolean {
    return PLANS[plan].features.includes(feature);
}

/** Max extra seats a plan allows on top of the included ones (null = unlimited, 0 = none). */
export function maxExtraSeats(plan: PlanCode): number | null {
    const def = PLANS[plan];
    if (def.extraSeatCents === null) return 0;
    if (def.quotas.maxSeats === null) return null;
    return def.quotas.maxSeats - def.quotas.includedSeats;
}

export function totalSeats(plan: PlanCode, extraSeats: number): number {
    return PLANS[plan].quotas.includedSeats + Math.max(0, extraSeats);
}

export class PlanValidationError extends Error {}

export function validateExtraSeats(plan: PlanCode, extraSeats: number): number {
    if (!Number.isInteger(extraSeats) || extraSeats < 0) {
        throw new PlanValidationError("Nombre de sièges supplémentaires invalide.");
    }
    const max = maxExtraSeats(plan);
    if (max !== null && extraSeats > max) {
        throw new PlanValidationError(
            max === 0
                ? `L'offre ${PLANS[plan].name} ne permet pas de sièges supplémentaires.`
                : `L'offre ${PLANS[plan].name} est limitée à ${max} siège(s) supplémentaire(s).`
        );
    }
    if (extraSeats > 500) throw new PlanValidationError("Contactez-nous au-delà de 500 sièges supplémentaires.");
    return extraSeats;
}

export interface QuoteLine {
    label: string;
    amountCents: number;
}

export interface Quote {
    plan: PlanCode;
    cycle: BillingCycle;
    extraSeats: number;
    includeSetup: boolean;
    /** Months covered by this charge. */
    months: number;
    lines: QuoteLine[];
    subtotalCents: number;
    vatCents: number;
    totalCents: number;
    /** What the customer pays per month for the subscription part (HT), for display. */
    recurringMonthlyCents: number;
    /** Saving of annual vs monthly over 12 months (HT, subscription only). */
    annualSavingCents: number;
}

/** Price of a charge. Integer cents throughout; VAT rounded once on the subtotal. */
export function computeQuote(input: {
    plan: PlanCode;
    cycle: BillingCycle;
    extraSeats?: number;
    includeSetup?: boolean;
}): Quote {
    const def = PLANS[input.plan];
    const extraSeats = validateExtraSeats(input.plan, input.extraSeats ?? 0);
    const includeSetup = Boolean(input.includeSetup);
    const months = input.cycle === "ANNUAL" ? 12 : 1;
    const baseMonthly = input.cycle === "ANNUAL" ? def.annualMonthlyPriceCents : def.monthlyPriceCents;
    const seatMonthly = (def.extraSeatCents ?? 0) * extraSeats;

    const lines: QuoteLine[] = [
        {
            label:
                input.cycle === "ANNUAL"
                    ? `Offre ${def.name} — annuel (12 × ${formatEuros(baseMonthly)})`
                    : `Offre ${def.name} — mensuel`,
            amountCents: baseMonthly * months,
        },
    ];
    if (extraSeats > 0) {
        lines.push({
            label: `${extraSeats} siège(s) supplémentaire(s) × ${formatEuros(def.extraSeatCents ?? 0)}${months > 1 ? " × 12" : ""}`,
            amountCents: seatMonthly * months,
        });
    }
    if (includeSetup) {
        lines.push({ label: `Frais de mise en place (unique)`, amountCents: def.setupFeeCents });
    }

    const subtotalCents = lines.reduce((sum, l) => sum + l.amountCents, 0);
    const vatCents = Math.round(subtotalCents * VAT_RATE);
    const annualSavingCents = (def.monthlyPriceCents - def.annualMonthlyPriceCents) * 12;

    return {
        plan: input.plan,
        cycle: input.cycle,
        extraSeats,
        includeSetup,
        months,
        lines,
        subtotalCents,
        vatCents,
        totalCents: subtotalCents + vatCents,
        recurringMonthlyCents: baseMonthly + seatMonthly,
        annualSavingCents,
    };
}

export function formatEuros(cents: number, opts: { decimals?: boolean } = {}): string {
    const decimals = opts.decimals ?? cents % 100 !== 0;
    return new Intl.NumberFormat("fr-FR", {
        style: "currency",
        currency: "EUR",
        minimumFractionDigits: decimals ? 2 : 0,
        maximumFractionDigits: decimals ? 2 : 0,
    }).format(cents / 100);
}

export function formatQuota(value: number | null, unit = ""): string {
    if (value === null) return "Illimité";
    return `${new Intl.NumberFormat("fr-FR").format(value)}${unit ? ` ${unit}` : ""}`;
}

/** Effective quotas, taking the trial caps and extra seats into account. */
export function effectiveQuotas(plan: PlanCode, opts: { extraSeats: number; trialing: boolean }) {
    const q = PLANS[plan].quotas;
    return {
        ...q,
        seats: totalSeats(plan, opts.extraSeats),
        contacts: opts.trialing ? Math.min(q.contacts, TRIAL_CONTACT_CAP) : q.contacts,
        aiFichesPerMonth: opts.trialing ? Math.min(q.aiFichesPerMonth, TRIAL_AI_FICHE_CAP) : q.aiFichesPerMonth,
    };
}

export const FEATURE_LABELS: Record<FeatureKey, string> = {
    callQueue: "File d'appels intelligente",
    emailTemplates: "Emails & modèles",
    callVault: "Call Vault (enregistrements)",
    aiFiche: "Fiches de RDV Mistral AI",
    csvExport: "Export CSV / Excel",
    managerCockpit: "Cockpit Manager temps réel",
    exclusions: "Exclusions & anti-collision",
    hrTracking: "Suivi RH & activité",
    leadRecycling: "Recyclage automatique des leads",
    whiteLabel: "Marque blanche",
    clientViewer: "Rôle Client Spectateur",
    apiWebhooks: "Webhooks & API",
    priorityQueue: "File de traitement prioritaire",
};
