// ============================================
// MOCK CARD PROCESSOR — simulated payments, no money moves.
//
// Behaves like a real gateway in test mode so the checkout UX (validation,
// declines, 3-D Secure) can be built and demoed end to end. Swap
// chargeMockCard() for a Stripe/Mollie call when billing goes live; the card
// number never leaves this function except as brand + last 4.
// ============================================

export const TEST_CARDS = [
    { number: "4242 4242 4242 4242", outcome: "Paiement accepté" },
    { number: "4000 0027 6000 3184", outcome: "Authentification 3-D Secure demandée" },
    { number: "4000 0000 0000 0002", outcome: "Carte refusée" },
    { number: "4000 0000 0000 9995", outcome: "Fonds insuffisants" },
    { number: "4000 0000 0000 0069", outcome: "Carte expirée" },
] as const;

export type CardBrand = "visa" | "mastercard" | "amex" | "cb" | "unknown";

export function normalizeCardNumber(input: string): string {
    return input.replace(/[\s-]/g, "");
}

export function detectBrand(number: string): CardBrand {
    const n = normalizeCardNumber(number);
    if (/^4/.test(n)) return "visa";
    if (/^(5[1-5]|2(2[2-9]|[3-6]\d|7[01]|720))/.test(n)) return "mastercard";
    if (/^3[47]/.test(n)) return "amex";
    return "unknown";
}

export function luhnValid(number: string): boolean {
    const n = normalizeCardNumber(number);
    if (!/^\d{12,19}$/.test(n)) return false;
    let sum = 0;
    let double = false;
    for (let i = n.length - 1; i >= 0; i--) {
        let d = n.charCodeAt(i) - 48;
        if (double) {
            d *= 2;
            if (d > 9) d -= 9;
        }
        sum += d;
        double = !double;
    }
    return sum % 10 === 0;
}

/** "MM/YY" → valid and not in the past (card valid through the end of its month). */
export function expiryValid(expiry: string, now: Date = new Date()): boolean {
    const m = /^(\d{2})\s*\/\s*(\d{2})$/.exec(expiry.trim());
    if (!m) return false;
    const month = Number(m[1]);
    const year = 2000 + Number(m[2]);
    if (month < 1 || month > 12) return false;
    const endOfMonth = new Date(Date.UTC(year, month, 1));
    return endOfMonth.getTime() > now.getTime() && year < now.getUTCFullYear() + 20;
}

export function cvcValid(cvc: string, brand: CardBrand): boolean {
    return brand === "amex" ? /^\d{4}$/.test(cvc) : /^\d{3}$/.test(cvc);
}

export interface CardInput {
    number: string;
    expiry: string;
    cvc: string;
    holder: string;
}

export type CardFieldErrors = Partial<Record<keyof CardInput, string>>;

export function validateCard(card: CardInput, now?: Date): CardFieldErrors {
    const errors: CardFieldErrors = {};
    const brand = detectBrand(card.number);
    if (!luhnValid(card.number)) errors.number = "Numéro de carte invalide.";
    if (!expiryValid(card.expiry, now)) errors.expiry = "Date d'expiration invalide ou dépassée.";
    if (!cvcValid(card.cvc, brand)) errors.cvc = brand === "amex" ? "4 chiffres attendus." : "3 chiffres attendus.";
    if (card.holder.trim().length < 2) errors.holder = "Nom du titulaire requis.";
    return errors;
}

export type ChargeResult =
    | { ok: true; brand: CardBrand; last4: string }
    | { ok: false; code: "requires_3ds"; brand: CardBrand; last4: string; message: string }
    | { ok: false; code: string; brand: CardBrand; last4: string; message: string };

/**
 * Decide the outcome of a simulated charge. `threeDsConfirmed` is true when
 * the customer approved the simulated 3-D Secure challenge.
 */
export function chargeMockCard(card: CardInput, opts: { threeDsConfirmed?: boolean } = {}): ChargeResult {
    const n = normalizeCardNumber(card.number);
    const brand = detectBrand(n);
    const last4 = n.slice(-4);
    switch (n) {
        case "4000000000000002":
            return { ok: false, code: "card_declined", brand, last4, message: "Votre banque a refusé le paiement." };
        case "4000000000009995":
            return { ok: false, code: "insufficient_funds", brand, last4, message: "Fonds insuffisants sur cette carte." };
        case "4000000000000069":
            return { ok: false, code: "expired_card", brand, last4, message: "Cette carte a expiré." };
        case "4000002760003184":
            if (!opts.threeDsConfirmed) {
                return {
                    ok: false,
                    code: "requires_3ds",
                    brand,
                    last4,
                    message: "Votre banque demande une authentification 3-D Secure.",
                };
            }
            return { ok: true, brand, last4 };
        default:
            return { ok: true, brand, last4 };
    }
}
