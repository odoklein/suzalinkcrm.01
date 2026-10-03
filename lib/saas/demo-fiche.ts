// ============================================
// DEMO FICHE — the "first call" onboarding step shows what a Fiche de RDV
// looks like without spending Mistral credits during a trial. Deterministic,
// built from the notes the user typed during the practice call plus the ICP
// collected in the "company" step. Labelled as a preview in the UI.
// ============================================

export interface DemoFicheInput {
    prospectCompany: string;
    prospectName: string;
    notes: string;
    offer?: string | null;
    meetingAt?: string | null;
}

export interface DemoFiche {
    title: string;
    context: string;
    pain: string;
    budget: string;
    timeline: string;
    decisionMakers: string;
    objections: string[];
    nextStep: string;
    bant: { budget: boolean; authority: boolean; need: boolean; timing: boolean };
}

const BUDGET_RE = /(\d[\d\s.,]*)\s*(k€|k|€|euros?)/i;
const TIMING_RE = /(semaine|mois|trimestre|q[1-4]|janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre|rentrée|année)/i;
const AUTHORITY_RE = /(dg|ceo|directeur|directrice|fondateur|fondatrice|président|head of|vp|daf|cfo|décideur)/i;
const OBJECTION_HINTS: [RegExp, string][] = [
    [/(cher|prix|budget serré|coût)/i, "Sensibilité au prix : préparer le comparatif du coût total (CRM + téléphonie + transcription)."],
    [/(déjà|hubspot|salesforce|pipedrive|outil actuel)/i, "Outil déjà en place : positionner en complément pour les SDRs, synchronisation des RDV vers le CRM central."],
    [/(temps|pas le moment|occupé|plus tard)/i, "Disponibilité : proposer un déploiement en 48h avec import de la base existante."],
    [/(sécurité|rgpd|données)/i, "Protection des données : instance dédiée (single-tenant) hébergée en Europe."],
];

function sentences(notes: string): string[] {
    return notes
        .split(/(?<=[.!?])\s+|\n+/)
        .map((s) => s.trim())
        .filter(Boolean);
}

export function buildDemoFiche(input: DemoFicheInput): DemoFiche {
    const notes = input.notes.trim();
    const parts = sentences(notes);
    const budgetMatch = BUDGET_RE.exec(notes);
    const timingMatch = TIMING_RE.exec(notes);
    const authorityMatch = AUTHORITY_RE.exec(notes);
    const painSentence =
        parts.find((s) => /(problème|perd|manque|difficile|besoin|cherche|veut|aimerait|douleur|frein)/i.test(s)) ??
        parts[0] ??
        "Non précisé pendant l'appel.";

    const objections = OBJECTION_HINTS.filter(([re]) => re.test(notes)).map(([, text]) => text);
    if (objections.length === 0) {
        objections.push("Aucune objection explicite : valider le périmètre et le budget en début de RDV.");
    }

    return {
        title: `RDV ${input.prospectCompany} — ${input.prospectName}`,
        context: `${input.prospectCompany}, contact : ${input.prospectName}.${
            input.offer ? ` Intérêt pour : ${input.offer.slice(0, 160)}.` : ""
        }`,
        pain: painSentence,
        budget: budgetMatch ? `Budget évoqué : ${budgetMatch[0]}` : "Budget non évoqué — à qualifier en ouverture.",
        timeline: timingMatch ? `Échéance mentionnée : « ${timingMatch[0]} »` : "Pas d'échéance claire.",
        decisionMakers: authorityMatch
            ? `Décideur identifié (${authorityMatch[0]}).`
            : `${input.prospectName} — rôle de décision à confirmer.`,
        objections,
        nextStep: input.meetingAt
            ? `RDV de découverte le ${input.meetingAt}. Envoyer l'invitation et la fiche au closer.`
            : "Envoyer l'invitation et la fiche au closer.",
        bant: {
            budget: Boolean(budgetMatch),
            authority: Boolean(authorityMatch),
            need: parts.length > 0,
            timing: Boolean(timingMatch),
        },
    };
}
