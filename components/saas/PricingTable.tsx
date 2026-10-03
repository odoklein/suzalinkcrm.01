"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Minus, Sparkles } from "lucide-react";
import { SegmentedControl } from "@/components/ui";
import { cn } from "@/lib/utils";
import {
    FEATURE_LABELS,
    PLANS,
    PLAN_ORDER,
    TRIAL_DAYS,
    formatEuros,
    formatQuota,
    type BillingCycle,
    type FeatureKey,
} from "@/lib/saas/plans";

const QUOTA_ROWS: { label: string; render: (code: keyof typeof PLANS) => string }[] = [
    { label: "Sièges inclus", render: (c) => String(PLANS[c].quotas.includedSeats) },
    {
        label: "Siège supplémentaire",
        render: (c) => (PLANS[c].extraSeatCents ? `${formatEuros(PLANS[c].extraSeatCents!)} / mois` : "—"),
    },
    { label: "Workspaces", render: (c) => formatQuota(PLANS[c].quotas.workspaces) },
    { label: "Contacts", render: (c) => formatQuota(PLANS[c].quotas.contacts) },
    { label: "Lignes Allo / OnOff", render: (c) => formatQuota(PLANS[c].quotas.phoneLines) },
    { label: "Call Vault (heures / mois)", render: (c) => formatQuota(PLANS[c].quotas.callVaultHours, "h") },
    { label: "Fiches de RDV IA / mois", render: (c) => formatQuota(PLANS[c].quotas.aiFichesPerMonth) },
    { label: "Stockage", render: (c) => `${PLANS[c].quotas.storageGb} Go` },
];

const FEATURE_ROWS = Object.keys(FEATURE_LABELS) as FeatureKey[];

export function PricingTable() {
    const [cycle, setCycle] = useState<BillingCycle>("ANNUAL");

    return (
        <div>
            <div className="flex justify-center">
                <SegmentedControl<BillingCycle>
                    ariaLabel="Période de facturation"
                    value={cycle}
                    onChange={setCycle}
                    options={[
                        { value: "MONTHLY", label: "Mensuel" },
                        { value: "ANNUAL", label: "Annuel · 2 mois offerts" },
                    ]}
                />
            </div>

            <div className="mt-8 grid gap-5 lg:grid-cols-3">
                {PLAN_ORDER.map((code) => {
                    const plan = PLANS[code];
                    const featured = code === "SMALL_BUSINESS";
                    const price = cycle === "ANNUAL" ? plan.annualMonthlyPriceCents : plan.monthlyPriceCents;
                    const href = `/inscription?plan=${code}&cycle=${cycle}`;
                    return (
                        <section
                            key={code}
                            aria-labelledby={`plan-${code}`}
                            className={cn(
                                "relative flex flex-col rounded-2xl border bg-surface p-6 shadow-xs",
                                featured ? "border-primary ring-4 ring-primary/10" : "border-line"
                            )}
                        >
                            {plan.badge && (
                                <span
                                    className={cn(
                                        "absolute -top-3 left-6 rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                                        featured ? "bg-primary text-primary-fg" : "bg-accent-soft text-accent-soft-ink"
                                    )}
                                >
                                    {plan.badge}
                                </span>
                            )}
                            <h2 id={`plan-${code}`} className="text-lg font-semibold text-ink">
                                {plan.name}
                            </h2>
                            <p className="mt-0.5 text-[13px] text-ink-3">{plan.tagline}</p>

                            <div className="mt-5 flex items-baseline gap-1">
                                <span className="text-4xl font-semibold tracking-tight tabular-nums">{formatEuros(price)}</span>
                                <span className="text-sm text-ink-3">HT / mois</span>
                            </div>
                            <p className="mt-1 h-5 text-xs text-ink-3">
                                {cycle === "ANNUAL"
                                    ? `${formatEuros(price * 12)} HT facturés à l'année`
                                    : `ou ${formatEuros(plan.annualMonthlyPriceCents)} / mois en annuel`}
                            </p>

                            <p className="mt-4 text-[13px] leading-relaxed text-ink-2">{plan.audience}</p>

                            <ul className="mt-5 space-y-2.5 text-[13px]">
                                {plan.highlights.map((h) => (
                                    <li key={h} className="flex gap-2">
                                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
                                        <span className="text-ink-2">{h}</span>
                                    </li>
                                ))}
                                <li className="flex gap-2">
                                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
                                    <span className="text-ink-2">{plan.supportLabel}</span>
                                </li>
                            </ul>

                            <div className="mt-auto pt-6">
                                <Link
                                    href={href}
                                    className={cn(
                                        "flex h-11 w-full items-center justify-center gap-2 rounded-control text-sm font-semibold transition",
                                        featured
                                            ? "bg-primary text-primary-fg shadow-primary hover:bg-primary-hover"
                                            : "border border-line bg-surface text-ink hover:bg-surface-2"
                                    )}
                                >
                                    {plan.trialAvailable ? (
                                        <>
                                            <Sparkles className="h-4 w-4" aria-hidden />
                                            Essai gratuit {TRIAL_DAYS} jours
                                        </>
                                    ) : (
                                        "Souscrire"
                                    )}
                                </Link>
                                <p className="mt-2 text-center text-[11.5px] text-ink-4">
                                    {plan.trialAvailable
                                        ? "Sans carte bancaire · sans engagement"
                                        : `Mise en place White-Glove disponible (${formatEuros(plan.setupFeeCents)})`}
                                </p>
                            </div>
                        </section>
                    );
                })}
            </div>

            <div className="mt-16 overflow-x-auto rounded-2xl border border-line bg-surface">
                <table className="w-full min-w-[640px] text-left text-[13px]">
                    <caption className="sr-only">Comparatif détaillé des offres</caption>
                    <thead>
                        <tr className="border-b border-line">
                            <th scope="col" className="px-5 py-3 font-medium text-ink-3">
                                Comparatif
                            </th>
                            {PLAN_ORDER.map((c) => (
                                <th key={c} scope="col" className="px-5 py-3 font-semibold text-ink">
                                    {PLANS[c].name}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {QUOTA_ROWS.map((row) => (
                            <tr key={row.label} className="border-b border-line-subtle">
                                <th scope="row" className="px-5 py-2.5 font-normal text-ink-2">
                                    {row.label}
                                </th>
                                {PLAN_ORDER.map((c) => (
                                    <td key={c} className="px-5 py-2.5 tabular-nums text-ink">
                                        {row.render(c)}
                                    </td>
                                ))}
                            </tr>
                        ))}
                        {FEATURE_ROWS.map((f) => (
                            <tr key={f} className="border-b border-line-subtle last:border-0">
                                <th scope="row" className="px-5 py-2.5 font-normal text-ink-2">
                                    {FEATURE_LABELS[f]}
                                </th>
                                {PLAN_ORDER.map((c) => (
                                    <td key={c} className="px-5 py-2.5">
                                        {PLANS[c].features.includes(f) ? (
                                            <Check className="h-4 w-4 text-success" aria-label="Inclus" />
                                        ) : (
                                            <Minus className="h-4 w-4 text-ink-4" aria-label="Non inclus" />
                                        )}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
