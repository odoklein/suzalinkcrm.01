/**
 * Presets for mission-scoped action status definitions.
 * - SHORT: 9 statuses (NRP, RDV, FAUX NUMERO, Barrage standard, NUMERO KO, REFUS, MAIL DOC, RAPPEL, INVALIDE).
 * - FULL: 8 statuses matching global defaults, with optional colors.
 */

export type PresetStatusItem = {
    code: string;
    label: string;
    color: string | null;
    sortOrder: number;
    requiresNote: boolean;
    priorityLabel: "CALLBACK" | "FOLLOW_UP" | "NEW" | "RETRY" | "SKIP";
    priorityOrder: number | null;
    triggersOpportunity: boolean;
    triggersCallback: boolean;
};

export const MISSION_STATUS_PRESETS = {
    SHORT: [
        { code: "NO_RESPONSE", label: "NRP", color: "#F5F5DC", sortOrder: 1, requiresNote: false, priorityLabel: "RETRY" as const, priorityOrder: 4, triggersOpportunity: false, triggersCallback: false },
        { code: "MEETING_BOOKED", label: "RDV", color: "#90EE90", sortOrder: 2, requiresNote: false, priorityLabel: "SKIP" as const, priorityOrder: 999, triggersOpportunity: true, triggersCallback: false },
        { code: "BAD_CONTACT", label: "FAUX NUMERO", color: "#FFB6C1", sortOrder: 3, requiresNote: false, priorityLabel: "SKIP" as const, priorityOrder: 999, triggersOpportunity: false, triggersCallback: false },
        { code: "BARRAGE_STANDARD", label: "Barrage standard", color: "#FFE0B2", sortOrder: 4, requiresNote: false, priorityLabel: "SKIP" as const, priorityOrder: 999, triggersOpportunity: false, triggersCallback: false },
        { code: "NUMERO_KO", label: "NUMERO KO", color: "#FFAB91", sortOrder: 5, requiresNote: false, priorityLabel: "SKIP" as const, priorityOrder: 999, triggersOpportunity: false, triggersCallback: false },
        { code: "DISQUALIFIED", label: "REFUS", color: "#FFA07A", sortOrder: 6, requiresNote: false, priorityLabel: "SKIP" as const, priorityOrder: 999, triggersOpportunity: false, triggersCallback: false },
        { code: "ENVOIE_MAIL", label: "MAIL DOC", color: "#87CEEB", sortOrder: 7, requiresNote: true, priorityLabel: "SKIP" as const, priorityOrder: 999, triggersOpportunity: false, triggersCallback: false },
        { code: "CALLBACK_REQUESTED", label: "RAPPEL", color: "#DDA0DD", sortOrder: 8, requiresNote: true, priorityLabel: "CALLBACK" as const, priorityOrder: 1, triggersOpportunity: false, triggersCallback: true },
        { code: "INVALIDE", label: "INVALIDE", color: "#D3D3D3", sortOrder: 9, requiresNote: false, priorityLabel: "RETRY" as const, priorityOrder: 4, triggersOpportunity: false, triggersCallback: false },
    ] as PresetStatusItem[],
    EXTENDED: [
        { code: "NO_RESPONSE", label: "NRP", color: "#F5F5DC", sortOrder: 1, requiresNote: false, priorityLabel: "RETRY" as const, priorityOrder: 4, triggersOpportunity: false, triggersCallback: false },
        { code: "MEETING_BOOKED", label: "RDV", color: "#90EE90", sortOrder: 2, requiresNote: false, priorityLabel: "SKIP" as const, priorityOrder: 999, triggersOpportunity: true, triggersCallback: false },
        { code: "INTERESTED", label: "Intéressé", color: "#C8E6C9", sortOrder: 3, requiresNote: true, priorityLabel: "FOLLOW_UP" as const, priorityOrder: 2, triggersOpportunity: true, triggersCallback: false },
        { code: "CALLBACK_REQUESTED", label: "Rappel demandé", color: "#BBDEFB", sortOrder: 4, requiresNote: true, priorityLabel: "CALLBACK" as const, priorityOrder: 1, triggersOpportunity: false, triggersCallback: true },
        { code: "RELANCE", label: "Relance", color: "#B3E5FC", sortOrder: 5, requiresNote: true, priorityLabel: "CALLBACK" as const, priorityOrder: 1, triggersOpportunity: false, triggersCallback: true },
        { code: "RAPPEL", label: "Rappel", color: "#DDA0DD", sortOrder: 6, requiresNote: true, priorityLabel: "CALLBACK" as const, priorityOrder: 1, triggersOpportunity: false, triggersCallback: true },
        { code: "PROJET_A_SUIVRE", label: "Projet à suivre", color: "#C5E1A5", sortOrder: 7, requiresNote: true, priorityLabel: "FOLLOW_UP" as const, priorityOrder: 2, triggersOpportunity: true, triggersCallback: false },
        { code: "BAD_CONTACT", label: "Faux numéro", color: "#FFB6C1", sortOrder: 8, requiresNote: false, priorityLabel: "SKIP" as const, priorityOrder: 999, triggersOpportunity: false, triggersCallback: false },
        { code: "FAUX_NUMERO", label: "Faux numéro", color: "#FFCDD2", sortOrder: 9, requiresNote: false, priorityLabel: "SKIP" as const, priorityOrder: 999, triggersOpportunity: false, triggersCallback: false },
        { code: "BARRAGE_STANDARD", label: "Barrage standard", color: "#FFE0B2", sortOrder: 10, requiresNote: false, priorityLabel: "SKIP" as const, priorityOrder: 999, triggersOpportunity: false, triggersCallback: false },
        { code: "BARRAGE_SECRETAIRE", label: "Barrage secrétaire", color: "#FFECB3", sortOrder: 11, requiresNote: false, priorityLabel: "SKIP" as const, priorityOrder: 999, triggersOpportunity: false, triggersCallback: false },
        { code: "MAUVAIS_INTERLOCUTEUR", label: "Mauvais interlocuteur", color: "#F8BBD0", sortOrder: 12, requiresNote: false, priorityLabel: "SKIP" as const, priorityOrder: 999, triggersOpportunity: false, triggersCallback: false },
        { code: "NUMERO_KO", label: "NUMERO KO", color: "#FFAB91", sortOrder: 13, requiresNote: false, priorityLabel: "SKIP" as const, priorityOrder: 999, triggersOpportunity: false, triggersCallback: false },
        { code: "DISQUALIFIED", label: "Disqualifié", color: "#D7CCC8", sortOrder: 14, requiresNote: false, priorityLabel: "SKIP" as const, priorityOrder: 999, triggersOpportunity: false, triggersCallback: false },
        { code: "REFUS", label: "Refus", color: "#FFA07A", sortOrder: 15, requiresNote: false, priorityLabel: "SKIP" as const, priorityOrder: 999, triggersOpportunity: false, triggersCallback: false },
        { code: "REFUS_ARGU", label: "Refus argu", color: "#FF8A65", sortOrder: 16, requiresNote: false, priorityLabel: "SKIP" as const, priorityOrder: 999, triggersOpportunity: false, triggersCallback: false },
        { code: "REFUS_CATEGORIQUE", label: "Refus catégorique", color: "#FF7043", sortOrder: 17, requiresNote: false, priorityLabel: "SKIP" as const, priorityOrder: 999, triggersOpportunity: false, triggersCallback: false },
        { code: "HORS_CIBLE", label: "Hors cible", color: "#BCAAA4", sortOrder: 18, requiresNote: false, priorityLabel: "SKIP" as const, priorityOrder: 999, triggersOpportunity: false, triggersCallback: false },
        { code: "ENVOIE_MAIL", label: "Envoie mail", color: "#B39DDB", sortOrder: 19, requiresNote: true, priorityLabel: "SKIP" as const, priorityOrder: 999, triggersOpportunity: false, triggersCallback: false },
        { code: "MAIL_DOC", label: "Mail doc", color: "#87CEEB", sortOrder: 20, requiresNote: true, priorityLabel: "SKIP" as const, priorityOrder: 999, triggersOpportunity: false, triggersCallback: false },
        { code: "MAIL_UNIQUEMENT", label: "Mail uniquement", color: "#9FA8DA", sortOrder: 21, requiresNote: false, priorityLabel: "SKIP" as const, priorityOrder: 999, triggersOpportunity: false, triggersCallback: false },
        { code: "GERE_PAR_SIEGE", label: "Géré par le siège", color: "#B0BEC5", sortOrder: 22, requiresNote: false, priorityLabel: "SKIP" as const, priorityOrder: 999, triggersOpportunity: false, triggersCallback: false },
        { code: "INVALIDE", label: "Invalide", color: "#D3D3D3", sortOrder: 23, requiresNote: false, priorityLabel: "RETRY" as const, priorityOrder: 4, triggersOpportunity: false, triggersCallback: false },
        { code: "MEETING_CANCELLED", label: "Meeting annulé", color: "#FFCC80", sortOrder: 24, requiresNote: false, priorityLabel: "RETRY" as const, priorityOrder: 4, triggersOpportunity: false, triggersCallback: false },
    ] as PresetStatusItem[],
    FULL: [
        { code: "NO_RESPONSE", label: "Pas de réponse", color: "#E8E8E8", sortOrder: 1, requiresNote: false, priorityLabel: "RETRY" as const, priorityOrder: 4, triggersOpportunity: false, triggersCallback: false },
        { code: "BAD_CONTACT", label: "Standard / Mauvais contact", color: "#FFCDD2", sortOrder: 2, requiresNote: false, priorityLabel: "SKIP" as const, priorityOrder: 999, triggersOpportunity: false, triggersCallback: false },
        { code: "INTERESTED", label: "Intéressé", color: "#C8E6C9", sortOrder: 3, requiresNote: true, priorityLabel: "FOLLOW_UP" as const, priorityOrder: 2, triggersOpportunity: true, triggersCallback: false },
        { code: "CALLBACK_REQUESTED", label: "Rappel demandé", color: "#BBDEFB", sortOrder: 4, requiresNote: true, priorityLabel: "CALLBACK" as const, priorityOrder: 1, triggersOpportunity: false, triggersCallback: true },
        { code: "MEETING_BOOKED", label: "Meeting booké", color: "#A5D6A7", sortOrder: 5, requiresNote: false, priorityLabel: "SKIP" as const, priorityOrder: 999, triggersOpportunity: true, triggersCallback: false },
        { code: "MEETING_CANCELLED", label: "Meeting annulé", color: "#FFCC80", sortOrder: 6, requiresNote: false, priorityLabel: "RETRY" as const, priorityOrder: 4, triggersOpportunity: false, triggersCallback: false },
        { code: "DISQUALIFIED", label: "Disqualifié", color: "#D7CCC8", sortOrder: 7, requiresNote: false, priorityLabel: "SKIP" as const, priorityOrder: 999, triggersOpportunity: false, triggersCallback: false },
        { code: "ENVOIE_MAIL", label: "Envoie mail", color: "#B39DDB", sortOrder: 8, requiresNote: true, priorityLabel: "SKIP" as const, priorityOrder: 999, triggersOpportunity: false, triggersCallback: false },
    ] as PresetStatusItem[],
    /** LinkedIn hub – manual workflow results */
    LINKEDIN: [
        { code: "CONNECTION_SENT", label: "Demande de connexion envoyée", color: "#0A66C2", sortOrder: 1, requiresNote: false, priorityLabel: "SKIP" as const, priorityOrder: 999, triggersOpportunity: false, triggersCallback: false },
        { code: "MESSAGE_SENT", label: "Message envoyé", color: "#0A66C2", sortOrder: 2, requiresNote: false, priorityLabel: "SKIP" as const, priorityOrder: 999, triggersOpportunity: false, triggersCallback: false },
        { code: "REPLIED", label: "A répondu", color: "#057642", sortOrder: 3, requiresNote: true, priorityLabel: "FOLLOW_UP" as const, priorityOrder: 2, triggersOpportunity: true, triggersCallback: false },
        { code: "NOT_INTERESTED", label: "Pas intéressé", color: "#D7CCC8", sortOrder: 4, requiresNote: false, priorityLabel: "SKIP" as const, priorityOrder: 999, triggersOpportunity: false, triggersCallback: false },
    ] as PresetStatusItem[],
};

/** LinkedIn result codes for log-action UI */
export const LINKEDIN_RESULT_CODES = ["CONNECTION_SENT", "MESSAGE_SENT", "REPLIED", "NOT_INTERESTED"] as const;
