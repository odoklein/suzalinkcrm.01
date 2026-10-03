// ============================================
// ONBOARDING STEPS — what each plan walks through after sign-up.
//
// Pure module (shared by the wizard UI and the API). The order here is the
// order of the wizard; `plans` decides who sees a step, `required` decides
// whether onboarding can be finished without it.
// ============================================

import type { PlanCode } from "./plans";

export type OnboardingStepKey =
    | "profile"
    | "company"
    | "phone_line"
    | "workspaces"
    | "import_contacts"
    | "call_outcomes"
    | "team"
    | "exclusions"
    | "manager_cockpit"
    | "white_label"
    | "client_viewer"
    | "api_webhooks"
    | "first_call"
    | "go_live";

export type OnboardingPhase = "setup" | "data" | "team" | "brand" | "adoption";

export interface OnboardingStepDefinition {
    key: OnboardingStepKey;
    title: string;
    /** One line shown in the step list. */
    summary: string;
    /** Why this matters — shown at the top of the step. */
    why: string;
    phase: OnboardingPhase;
    plans: PlanCode[];
    required: boolean;
    /** Rough time, shown so people know what they commit to. */
    minutes: number;
    /** Only the account owner/admin can complete it. */
    adminOnly: boolean;
}

const ALL: PlanCode[] = ["INDEPENDANT", "SMALL_BUSINESS", "MEDIUM_BUSINESS"];
const TEAM: PlanCode[] = ["SMALL_BUSINESS", "MEDIUM_BUSINESS"];
const MEDIUM: PlanCode[] = ["MEDIUM_BUSINESS"];

export const ONBOARDING_STEPS: OnboardingStepDefinition[] = [
    {
        key: "profile",
        title: "Votre profil",
        summary: "Votre rôle et votre objectif d'appels quotidien",
        why: "On adapte l'écran d'appel et vos objectifs de rythme (Pace) à votre façon de travailler.",
        phase: "setup",
        plans: ALL,
        required: true,
        minutes: 1,
        adminOnly: false,
    },
    {
        key: "company",
        title: "Entreprise & cible",
        summary: "Votre offre et votre client idéal (ICP)",
        why: "Mistral AI s'en sert pour rédiger des Fiches de RDV qui parlent le langage de votre marché.",
        phase: "setup",
        plans: ALL,
        required: true,
        minutes: 2,
        adminOnly: true,
    },
    {
        key: "phone_line",
        title: "Ligne Allo / OnOff",
        summary: "Connectez votre numéro pour remonter appels et enregistrements",
        why: "Chaque appel passé avec votre application habituelle arrive dans le CRM et dans le Call Vault, sans changer d'opérateur.",
        phase: "setup",
        plans: ALL,
        required: true,
        minutes: 3,
        adminOnly: true,
    },
    {
        key: "workspaces",
        title: "Workspaces",
        summary: "Séparez vos offres, vos cibles ou vos clients",
        why: "Un workspace par offre (ou par client d'agence) garde les listes, les scripts et les statistiques étanches.",
        phase: "setup",
        plans: TEAM,
        required: true,
        minutes: 2,
        adminOnly: true,
    },
    {
        key: "import_contacts",
        title: "Importer vos contacts",
        summary: "Un CSV ou Excel exporté de votre ancien outil",
        why: "Une file d'appels pleine dès le premier jour : c'est ce qui fait la différence entre essayer et adopter.",
        phase: "data",
        plans: ALL,
        required: true,
        minutes: 4,
        adminOnly: false,
    },
    {
        key: "call_outcomes",
        title: "Issues d'appel",
        summary: "Les boutons de qualification en 1 clic",
        why: "Des issues claires (RDV pris, barrage, rappel…) alimentent le recyclage des leads et vos statistiques.",
        phase: "data",
        plans: ALL,
        required: false,
        minutes: 2,
        adminOnly: true,
    },
    {
        key: "team",
        title: "Inviter l'équipe",
        summary: "SDRs, closers et managers",
        why: "Chaque commercial reçoit un lien d'activation ; ses appels et ses RDV remontent dans votre cockpit.",
        phase: "team",
        plans: TEAM,
        required: true,
        minutes: 2,
        adminOnly: true,
    },
    {
        key: "exclusions",
        title: "Exclusions & anti-collision",
        summary: "Clients existants, concurrents, verrouillage des comptes",
        why: "Deux commerciaux n'appellent jamais la même entreprise, et vos clients actuels ne sont jamais prospectés.",
        phase: "team",
        plans: TEAM,
        required: false,
        minutes: 2,
        adminOnly: true,
    },
    {
        key: "manager_cockpit",
        title: "Objectifs du cockpit",
        summary: "Appels par heure, RDV par semaine, horaires",
        why: "Le cockpit compare le rythme réel de chacun à ces objectifs et vous alerte quand l'équipe décroche.",
        phase: "team",
        plans: TEAM,
        required: false,
        minutes: 2,
        adminOnly: true,
    },
    {
        key: "white_label",
        title: "Marque blanche",
        summary: "Votre domaine, votre logo, vos couleurs",
        why: "Vos clients voient votre marque sur crm.votreagence.com, jamais la nôtre.",
        phase: "brand",
        plans: MEDIUM,
        required: true,
        minutes: 4,
        adminOnly: true,
    },
    {
        key: "client_viewer",
        title: "Accès Client Spectateur",
        summary: "Vos clients écoutent leurs RDV et lisent leurs rapports",
        why: "Transparence totale sur les résultats, sans montrer vos coulisses (scripts, listes, autres clients).",
        phase: "brand",
        plans: MEDIUM,
        required: false,
        minutes: 2,
        adminOnly: true,
    },
    {
        key: "api_webhooks",
        title: "API & webhooks",
        summary: "Typeform, Ads, bots LinkedIn vers le CRM",
        why: "Les leads entrants arrivent directement dans la bonne liste, enrichis et dédoublonnés.",
        phase: "brand",
        plans: MEDIUM,
        required: false,
        minutes: 3,
        adminOnly: true,
    },
    {
        key: "first_call",
        title: "Premier appel guidé",
        summary: "Un appel d'entraînement et votre première Fiche de RDV IA",
        why: "En 2 minutes vous voyez tout le flux : appel, qualification en 1 clic, fiche générée pour le closer.",
        phase: "adoption",
        plans: ALL,
        required: true,
        minutes: 2,
        adminOnly: false,
    },
    {
        key: "go_live",
        title: "Lancement",
        summary: "Vérification finale et ouverture de l'espace",
        why: "On vérifie que tout est branché avant votre première vraie session d'appels.",
        phase: "adoption",
        plans: ALL,
        required: true,
        minutes: 1,
        adminOnly: true,
    },
];

export const PHASE_LABELS: Record<OnboardingPhase, string> = {
    setup: "Configuration",
    data: "Données",
    team: "Équipe",
    brand: "Marque & intégrations",
    adoption: "Prise en main",
};

export function stepsForPlan(plan: PlanCode): OnboardingStepDefinition[] {
    return ONBOARDING_STEPS.filter((s) => s.plans.includes(plan));
}

export function getStepDefinition(key: string): OnboardingStepDefinition | undefined {
    return ONBOARDING_STEPS.find((s) => s.key === key);
}

export type StepStatus = "PENDING" | "COMPLETED" | "SKIPPED";

export interface StepProgress {
    key: OnboardingStepKey;
    status: StepStatus;
}

export interface OnboardingProgressSummary {
    total: number;
    done: number;
    percent: number;
    requiredRemaining: OnboardingStepKey[];
    /** First step not done yet (where "Continuer" goes). */
    nextStep: OnboardingStepKey | null;
    canFinish: boolean;
}

/**
 * Progress from stored step rows. `go_live` is excluded from the readiness
 * check because it is the step that finishes onboarding.
 */
export function summarizeProgress(plan: PlanCode, rows: StepProgress[]): OnboardingProgressSummary {
    const steps = stepsForPlan(plan);
    const statusOf = new Map(rows.map((r) => [r.key, r.status]));
    const isDone = (key: OnboardingStepKey) => {
        const s = statusOf.get(key);
        return s === "COMPLETED" || s === "SKIPPED";
    };
    const done = steps.filter((s) => isDone(s.key)).length;
    const requiredRemaining = steps
        .filter((s) => s.required && s.key !== "go_live" && statusOf.get(s.key) !== "COMPLETED")
        .map((s) => s.key);
    const next = steps.find((s) => !isDone(s.key));
    return {
        total: steps.length,
        done,
        percent: steps.length === 0 ? 100 : Math.round((done / steps.length) * 100),
        requiredRemaining,
        nextStep: next?.key ?? null,
        canFinish: requiredRemaining.length === 0,
    };
}
