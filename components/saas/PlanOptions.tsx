"use client";

import { Minus, Plus } from "lucide-react";
import { Checkbox, IconButton, SegmentedControl } from "@/components/ui";
import { cn } from "@/lib/utils";
import {
    PLANS,
    PLAN_ORDER,
    TRIAL_DAYS,
    formatEuros,
    maxExtraSeats,
    type BillingCycle,
    type PlanCode,
} from "@/lib/saas/plans";

export interface PlanSelection {
    plan: PlanCode;
    cycle: BillingCycle;
    extraSeats: number;
    includeSetup: boolean;
}

interface PlanOptionsProps {
    value: PlanSelection;
    onChange: (next: PlanSelection) => void;
    /** Plans that can't be chosen (e.g. too small for current usage). */
    disabledPlans?: PlanCode[];
    /** Setup already paid once: hide the option. */
    hideSetup?: boolean;
}

/** Plan / cycle / extra seats / setup picker shared by sign-up and checkout. */
export function PlanOptions({ value, onChange, disabledPlans = [], hideSetup = false }: PlanOptionsProps) {
    const plan = PLANS[value.plan];
    const maxExtra = maxExtraSeats(value.plan);
    const set = (patch: Partial<PlanSelection>) => onChange({ ...value, ...patch });

    const choosePlan = (code: PlanCode) => {
        const max = maxExtraSeats(code);
        set({ plan: code, extraSeats: max === null ? value.extraSeats : Math.min(value.extraSeats, max) });
    };

    return (
        <div className="space-y-6">
            <fieldset>
                <legend className="mb-2 text-[13px] font-medium text-ink-2">Offre</legend>
                <div className="grid gap-3 sm:grid-cols-3" role="radiogroup">
                    {PLAN_ORDER.map((code) => {
                        const p = PLANS[code];
                        const selected = value.plan === code;
                        const disabled = disabledPlans.includes(code);
                        return (
                            <button
                                key={code}
                                type="button"
                                role="radio"
                                aria-checked={selected}
                                disabled={disabled}
                                onClick={() => choosePlan(code)}
                                className={cn(
                                    "rounded-xl border p-3.5 text-left transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/15",
                                    selected ? "border-primary bg-primary-50/50 ring-1 ring-primary" : "border-line bg-surface hover:border-line-strong",
                                    disabled && "cursor-not-allowed opacity-50"
                                )}
                            >
                                <span className="block text-[14px] font-semibold text-ink">{p.name}</span>
                                <span className="mt-0.5 block text-xs text-ink-3">{p.tagline}</span>
                                <span className="mt-2 block text-[13px] tabular-nums text-ink">
                                    {formatEuros(value.cycle === "ANNUAL" ? p.annualMonthlyPriceCents : p.monthlyPriceCents)}
                                    <span className="text-ink-3"> HT/mois</span>
                                </span>
                                <span className={cn("mt-1 block text-[11px] font-medium", p.trialAvailable ? "text-success-ink" : "text-ink-3")}>
                                    {p.trialAvailable ? `Essai ${TRIAL_DAYS} jours` : "Paiement à la souscription"}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </fieldset>

            <div>
                <p className="mb-2 text-[13px] font-medium text-ink-2">Facturation</p>
                <SegmentedControl<BillingCycle>
                    ariaLabel="Période de facturation"
                    value={value.cycle}
                    onChange={(cycle) => set({ cycle })}
                    options={[
                        { value: "MONTHLY", label: "Mensuel" },
                        { value: "ANNUAL", label: "Annuel · 2 mois offerts" },
                    ]}
                />
            </div>

            {maxExtra !== 0 && (
                <div>
                    <p className="mb-2 text-[13px] font-medium text-ink-2">Sièges</p>
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-1 rounded-control border border-line bg-surface p-1">
                            <IconButton
                                icon={Minus}
                                label="Retirer un siège"
                                size="sm"
                                variant="ghost"
                                disabled={value.extraSeats <= 0}
                                onClick={() => set({ extraSeats: Math.max(0, value.extraSeats - 1) })}
                            />
                            <span className="w-10 text-center text-sm font-semibold tabular-nums" aria-live="polite">
                                {plan.quotas.includedSeats + value.extraSeats}
                            </span>
                            <IconButton
                                icon={Plus}
                                label="Ajouter un siège"
                                size="sm"
                                variant="ghost"
                                disabled={maxExtra !== null && value.extraSeats >= maxExtra}
                                onClick={() => set({ extraSeats: value.extraSeats + 1 })}
                            />
                        </div>
                        <p className="text-xs text-ink-3">
                            {plan.quotas.includedSeats} inclus, +{formatEuros(plan.extraSeatCents ?? 0)} HT/mois par siège
                            {plan.quotas.maxSeats ? ` (max. ${plan.quotas.maxSeats})` : ""}
                        </p>
                    </div>
                </div>
            )}

            {!hideSetup && (
                <Checkbox
                    checked={value.includeSetup}
                    onChange={(e) => set({ includeSetup: e.target.checked })}
                    label={`Mise en place accompagnée — ${formatEuros(plan.setupFeeCents)} HT (unique)`}
                    description={
                        plan.trialAvailable
                            ? `${plan.setupLabel}. Facturée à l'activation de l'abonnement.`
                            : plan.setupLabel
                    }
                />
            )}
        </div>
    );
}
