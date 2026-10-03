"use client";

import { Calendar, UserCircle2, Target, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface OnboardingReadiness {
    calendarConnected: boolean;
    personaSet: boolean;
    missionCreated: boolean;
}

interface OnboardingReadinessGaugeProps {
    readiness: OnboardingReadiness;
    size?: "sm" | "md";
    showLabels?: boolean;
    className?: string;
}

const STEPS = [
    {
        key: "calendarConnected" as const,
        label: "Calendrier",
        icon: Calendar,
        description: "Calendrier connecté",
    },
    {
        key: "personaSet" as const,
        label: "Persona",
        icon: UserCircle2,
        description: "Persona / ICP défini",
    },
    {
        key: "missionCreated" as const,
        label: "Mission",
        icon: Target,
        description: "Mission créée",
    },
] as const;

export function OnboardingReadinessGauge({
    readiness,
    size = "md",
    showLabels = true,
    className,
}: OnboardingReadinessGaugeProps) {
    const completed = [
        readiness.calendarConnected,
        readiness.personaSet,
        readiness.missionCreated,
    ].filter(Boolean).length;
    const total = 3;
    const percent = Math.round((completed / total) * 100);

    return (
        <div className={cn("space-y-2", className)}>
            {showLabels && (
                <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-600">
                        Prêt pour lancement
                    </span>
                    <span
                        className={cn(
                            "text-xs font-bold",
                            percent === 100
                                ? "text-emerald-600"
                                : percent >= 66
                                  ? "text-amber-600"
                                  : "text-slate-500"
                        )}
                    >
                        {percent}%
                    </span>
                </div>
            )}
            <div className="flex gap-1">
                {STEPS.map((step) => {
                    const ok = readiness[step.key];
                    const sizeClasses =
                        size === "sm"
                            ? "w-2 flex-1 h-1.5 rounded-full"
                            : "w-3 flex-1 h-2 rounded-full";

                    return (
                        <div
                            key={step.key}
                            title={`${step.description}: ${ok ? "OK" : "Manquant"}`}
                            className={cn(
                                sizeClasses,
                                "transition-colors",
                                ok
                                    ? "bg-emerald-500"
                                    : "bg-slate-200"
                            )}
                        />
                    );
                })}
            </div>
            {showLabels && (
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                    {STEPS.map((step) => {
                        const ok = readiness[step.key];
                        return (
                            <span
                                key={step.key}
                                className={cn(
                                    "inline-flex items-center gap-1.5 text-[10px] font-medium",
                                    ok ? "text-slate-600" : "text-slate-400"
                                )}
                            >
                                {ok ? (
                                    <Check className="w-3 h-3 text-emerald-500" />
                                ) : (
                                    <X className="w-3 h-3 text-slate-300" />
                                )}
                                {step.label}
                            </span>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
