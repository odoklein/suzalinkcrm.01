"use client";

import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { PLANS, TRIAL_DAYS, formatEuros, type Quote } from "@/lib/saas/plans";

interface QuoteSummaryProps {
    quote: Quote;
    /** Trial sign-up: nothing is charged today. */
    trial?: boolean;
    title?: string;
}

export function QuoteSummary({ quote, trial = false, title = "Récapitulatif" }: QuoteSummaryProps) {
    const plan = PLANS[quote.plan];
    const [trialEnd] = useState(() =>
        new Date(Date.now() + TRIAL_DAYS * 86_400_000).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })
    );

    return (
        <aside className="rounded-2xl border border-line bg-surface p-5 shadow-xs" aria-live="polite">
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink-3">{title}</h2>
            <p className="mt-3 text-base font-semibold text-ink">Offre {plan.name}</p>
            <p className="text-[13px] text-ink-3">
                {quote.cycle === "ANNUAL" ? "Facturation annuelle" : "Facturation mensuelle, sans engagement"}
            </p>

            <dl className="mt-4 space-y-2 text-[13px]">
                {quote.lines.map((line) => (
                    <div key={line.label} className="flex justify-between gap-4">
                        <dt className="text-ink-2">{line.label}</dt>
                        <dd className="shrink-0 tabular-nums text-ink">{formatEuros(line.amountCents, { decimals: true })}</dd>
                    </div>
                ))}
                <div className="flex justify-between gap-4 border-t border-line-subtle pt-2">
                    <dt className="text-ink-3">Sous-total HT</dt>
                    <dd className="tabular-nums text-ink">{formatEuros(quote.subtotalCents, { decimals: true })}</dd>
                </div>
                <div className="flex justify-between gap-4">
                    <dt className="text-ink-3">TVA 20 %</dt>
                    <dd className="tabular-nums text-ink">{formatEuros(quote.vatCents, { decimals: true })}</dd>
                </div>
                <div className="flex justify-between gap-4 border-t border-line pt-2 text-[15px] font-semibold">
                    <dt className="text-ink">{trial ? "Après l'essai" : "Total TTC aujourd'hui"}</dt>
                    <dd className="tabular-nums text-ink">{formatEuros(quote.totalCents, { decimals: true })}</dd>
                </div>
            </dl>

            {trial ? (
                <p className="mt-4 rounded-xl bg-success-soft px-3 py-2.5 text-[12.5px] text-success-ink">
                    <strong>0 € aujourd&apos;hui.</strong> Essai gratuit jusqu&apos;au {trialEnd}, sans carte bancaire. Vous choisissez ensuite
                    d&apos;activer ou non l&apos;abonnement.
                </p>
            ) : (
                quote.cycle === "ANNUAL" && (
                    <p className="mt-4 rounded-xl bg-primary-soft px-3 py-2.5 text-[12.5px] text-primary-soft-ink">
                        Vous économisez {formatEuros(quote.annualSavingCents)} HT par an par rapport au mensuel.
                    </p>
                )
            )}

            <p className="mt-4 flex items-center gap-1.5 text-[11.5px] text-ink-4">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden /> Instance et base de données dédiées, hébergées en Europe.
            </p>
        </aside>
    );
}
