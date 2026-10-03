// ============================================
// BRAND FONTS — swap the families here when cloning for another agency.
//
// next/font needs literal calls at module scope, so fonts can't live in
// brand.config.ts. Each font exposes a CSS variable; app/globals.css maps
//   --font-display → headings, hero figures (Tailwind: font-display)
//   --font-body    → everything else         (Tailwind: font-sans)
//   --font-code    → ids, codes, kbd          (Tailwind: font-mono)
// Keep the `variable` names; change only the imported families.
// ============================================

import localFont from "next/font/local";
import { Geist_Mono } from "next/font/google";

export const displayFont = localFont({
    src: [
        { path: "./fonts/satoshi-medium.woff", weight: "500", style: "normal" },
        { path: "./fonts/satoshi-bold.woff", weight: "700", style: "normal" },
    ],
    variable: "--font-display-face",
    display: "swap",
    fallback: ["ui-sans-serif", "system-ui", "sans-serif"],
});

export const bodyFont = localFont({
    src: [
        { path: "./fonts/satoshi-regular.woff", weight: "400", style: "normal" },
        { path: "./fonts/satoshi-medium.woff", weight: "500", style: "normal" },
        { path: "./fonts/satoshi-bold.woff", weight: "700", style: "normal" },
    ],
    variable: "--font-body-face",
    display: "swap",
    fallback: ["ui-sans-serif", "system-ui", "sans-serif"],
});

export const codeFont = Geist_Mono({
    variable: "--font-code-face",
    subsets: ["latin"],
    display: "swap",
});

/** Class names to put on <body> so the three variables exist everywhere. */
export const brandFontVariables = [displayFont.variable, bodyFont.variable, codeFont.variable].join(" ");
