// Pure: imported by the onboarding UI.

/** Default call outcomes offered in the call_outcomes step. */
export const DEFAULT_CALL_OUTCOMES = [
    { key: "MEETING_BOOKED", label: "Rendez-vous pris", enabled: true, recycleAfterDays: null },
    { key: "CALLBACK", label: "Rappel demandé", enabled: true, recycleAfterDays: 2 },
    { key: "GATEKEEPER", label: "Barrage standard", enabled: true, recycleAfterDays: 5 },
    { key: "NO_ANSWER", label: "Pas de réponse", enabled: true, recycleAfterDays: 1 },
    { key: "NOT_INTERESTED", label: "Pas intéressé", enabled: true, recycleAfterDays: 90 },
    { key: "WRONG_NUMBER", label: "Mauvais numéro", enabled: true, recycleAfterDays: null },
    { key: "ALREADY_EQUIPPED", label: "Déjà équipé", enabled: false, recycleAfterDays: 180 },
];
