// ============================================
// ADOPTION NUDGES — which tips the home page shows, from the account state.
// Pure so the rules are testable; ordered by impact (first = most important).
// ============================================

import type { PlanCode } from "./plans";
import { PLANS, TRIAL_DAYS } from "./plans";

export interface AdoptionInput {
    plan: PlanCode;
    status: string;
    isAdmin: boolean;
    trialDaysLeft: number | null;
    usage: { seats: number; contacts: number; phoneLines: number; workspaces: number };
    quotas: { seats: number; contacts: number };
    verifiedLines: number;
    pendingInvites: number;
    onboardingDone: boolean;
    skippedSteps: string[];
    dismissed: string[];
}

export interface AdoptionTip {
    id: string;
    title: string;
    body: string;
    href?: string;
    cta?: string;
}

export function adoptionTips(input: AdoptionInput): AdoptionTip[] {
    const tips: AdoptionTip[] = [];
    const add = (tip: AdoptionTip, when: boolean) => {
        if (when && !input.dismissed.includes(tip.id)) tips.push(tip);
    };

    add(
        {
            id: "line-unverified",
            title: "Aucune ligne connectée",
            body: "Sans ligne Allo ou OnOff vérifiée, vos appels ne remontent ni dans le CRM ni dans le Call Vault.",
            href: "/espace/onboarding?step=phone_line",
            cta: "Connecter une ligne",
        },
        input.isAdmin && input.verifiedLines === 0
    );
    add(
        {
            id: "no-contacts",
            title: "Votre file d'appels est vide",
            body: "Importez un CSV de prospects : les colonnes sont reconnues automatiquement et les doublons écartés.",
            href: "/espace/onboarding?step=import_contacts",
            cta: "Importer des contacts",
        },
        input.usage.contacts === 0
    );
    add(
        {
            id: "trial-ending",
            title: `Plus que ${input.trialDaysLeft ?? 0} jour(s) d'essai`,
            body: "Activez l'abonnement pour garder votre configuration et lever les limites d'essai (contacts, Fiches IA).",
            href: "/espace/paiement",
            cta: "Activer l'abonnement",
        },
        input.isAdmin && input.status === "TRIALING" && input.trialDaysLeft !== null && input.trialDaysLeft <= Math.ceil(TRIAL_DAYS / 3)
    );
    add(
        {
            id: "contacts-near-limit",
            title: "Vous approchez de la limite de contacts",
            body: `${input.usage.contacts.toLocaleString("fr-FR")} / ${input.quotas.contacts.toLocaleString("fr-FR")} contacts utilisés.`,
            href: "/espace/paiement",
            cta: input.status === "TRIALING" ? "Lever la limite d'essai" : "Changer d'offre",
        },
        input.isAdmin && input.usage.contacts >= input.quotas.contacts * 0.8
    );
    add(
        {
            id: "pending-invites",
            title: `${input.pendingInvites} invitation(s) en attente`,
            body: "Relancez vos collègues : un commercial qui n'a pas activé son compte n'apparaît pas dans le cockpit.",
            href: "/espace/onboarding?step=team",
            cta: "Gérer l'équipe",
        },
        input.isAdmin && input.pendingInvites > 0
    );
    add(
        {
            id: "seats-full",
            title: "Tous vos sièges sont occupés",
            body: PLANS[input.plan].extraSeatCents
                ? `Ajoutez des sièges à ${PLANS[input.plan].extraSeatCents! / 100} € HT/mois chacun.`
                : "Passez à Small Business pour travailler en équipe.",
            href: "/espace/paiement",
            cta: "Ajouter des sièges",
        },
        input.isAdmin && input.usage.seats >= input.quotas.seats && input.plan !== "INDEPENDANT"
    );
    for (const step of input.skippedSteps) {
        const copy: Record<string, [string, string]> = {
            exclusions: ["Protégez vos clients actuels", "Ajoutez vos clients et concurrents aux exclusions pour qu'ils ne soient jamais appelés."],
            manager_cockpit: ["Fixez des objectifs à l'équipe", "Le cockpit ne peut pas alerter sur le rythme sans objectifs d'appels."],
            call_outcomes: ["Personnalisez vos issues d'appel", "Ajustez les délais de recyclage pour relancer automatiquement les barrages."],
            client_viewer: ["Donnez de la visibilité à vos clients", "Un accès Client Spectateur réduit les points de reporting hebdomadaires."],
            api_webhooks: ["Branchez vos sources de leads", "Typeform, Meta Lead Ads ou LinkedIn peuvent alimenter vos listes directement."],
        };
        const c = copy[step];
        if (c) add({ id: `skipped-${step}`, title: c[0], body: c[1], href: `/espace/onboarding?step=${step}`, cta: "Configurer" }, input.isAdmin);
    }
    add(
        {
            id: "fiche-closer",
            title: "La Fiche de RDV part toute seule",
            body: "Dès qu'un appel est qualifié « RDV pris », la fiche est générée et envoyée au closer. Vérifiez qu'il fait partie de l'équipe.",
        },
        input.onboardingDone && input.plan !== "INDEPENDANT"
    );
    return tips;
}
