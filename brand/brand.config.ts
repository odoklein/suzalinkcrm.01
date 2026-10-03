// ============================================
// BRAND CONFIG — the one file to edit when this CRM is cloned for another agency.
//
// Everything visible that says "who we are" comes from here: names in the UI,
// <title>, emails, PDFs, exports, AI prompts, the colour system and the logos.
// Colours: give two seeds; lib/brand/color.ts derives every 50…950 shade, the
// tinted greys and the readable text colour on top. See brand/README.md.
//
// Keep this file free of imports from the app: server code, workers and emails
// all read it.
// ============================================

export const brandConfig = {
    identity: {
        /** The brand people see: sidebar, login, emails, PDFs. */
        name: "Suzalink",
        /** Product name for <title>, browser tabs, calendar PRODID, notifications. */
        productName: "Suzalink CRM",
        /** One-line positioning, used under the logo and in meta descriptions. */
        tagline: "La plateforme d'exécution commerciale qui transforme l'activité en résultats.",
        /** What the agency does, as AI prompts should describe it. */
        description: "plateforme d'exécution commerciale B2B",
        /** Legal entity behind the brand (invoices, legal footers). */
        companyName: "Suzali Conseil",
        /** Short label for the agency's own enriched lists (list source SUZALI). */
        companyShortName: "Suzali",
    },

    web: {
        /** Public URL of the app — fallback when NEXT_PUBLIC_APP_URL / NEXTAUTH_URL are unset. */
        appUrl: "https://app.suzalink.com",
        /** Marketing site. */
        website: "https://suzalink.com",
    },

    email: {
        /** Display name on automatic emails ("Suzalink" <…>). */
        senderName: "Suzalink",
        /** Default sender for notifications when no SMTP sender is configured. */
        notificationsAddress: "notifications@suzalink.com",
        /** Where blocked or lost users are told to write. */
        supportAddress: "support@suzalink.com",
        /** Email domains offered first in address pickers. */
        domains: ["suzalink.com", "suzaliconseil.com"],
    },

    locale: {
        lang: "fr",
        locale: "fr-FR",
        currency: "EUR",
        timeZone: "Europe/Paris",
    },

    colors: {
        /**
         * Structure colour: sidebar, hero cards, dark surfaces.
         * Suzalink Ink #0B1220.
         */
        primary: "#0B1220",
        /**
         * Highlight colour: active nav, selection, focus ring, AI features, primary buttons.
         * Suzalink Blue #3355FF.
         */
        accent: "#3355FF",
        /** How much of the primary hue tints the greys: 0 = pure grey, 1 = slate-like. */
        neutralTint: 0.8,
    },

    /** Files in /public. Replace the images, keep the names. */
    logos: {
        /** Full logo on a light background. */
        full: "/brand/logo.png",
        /** Full logo on the primary colour (sidebar, hero, dark emails). */
        fullInverse: "/brand/logo-inverse.png",
        /** Square symbol on light backgrounds. */
        mark: "/brand/mark.png",
        /** Square symbol on the primary colour. */
        markInverse: "/brand/mark-inverse.png",
        /** Browser tab icon and apple-touch icon. */
        favicon: "/brand/favicon.png",
        /** Intrinsic size of `full` (keeps next/image from shifting layout). */
        fullWidth: 429,
        fullHeight: 113,
    },
} as const;

export type BrandConfig = typeof brandConfig;
