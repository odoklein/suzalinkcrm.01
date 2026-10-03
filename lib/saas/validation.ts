import { z } from "zod";

export const passwordSchema = z
    .string()
    .min(10, "Mot de passe : 10 caractères minimum.")
    .max(128, "Mot de passe : 128 caractères maximum.")
    .regex(/[a-zA-Z]/, "Mot de passe : au moins une lettre.")
    .regex(/\d/, "Mot de passe : au moins un chiffre.");

export const emailSchema = z.string().trim().toLowerCase().email("Adresse email invalide.");

/** 0–4 score for the strength meter on the sign-up form (UI only; the schema above is the rule). */
export function passwordScore(pw: string): number {
    let score = 0;
    if (pw.length >= 10) score++;
    if (pw.length >= 14) score++;
    if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
    if (/\d/.test(pw) && /[^a-zA-Z0-9]/.test(pw)) score++;
    return Math.min(4, score);
}
