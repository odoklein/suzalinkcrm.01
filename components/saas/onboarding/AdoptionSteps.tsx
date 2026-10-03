"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarCheck, CheckCircle2, Circle, Phone, PhoneOff, Sparkles } from "lucide-react";
import { AiMark, Badge, Button, Input, Textarea } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { DemoFiche } from "@/lib/saas/demo-fiche";
import type { StepComponentProps } from "./types";

// ---------------- first_call ----------------

export interface FirstCallDraft {
    prospectCompany: string;
    prospectName: string;
    outcome: string;
    notes: string;
    meetingAt: string;
}

export const firstCallDefaults = (): FirstCallDraft => ({
    prospectCompany: "Atelier Morel Industrie",
    prospectName: "Claire Morel",
    outcome: "",
    notes: "",
    meetingAt: "",
});

const OUTCOMES = [
    { key: "MEETING_BOOKED", label: "Rendez-vous pris", tone: "bg-success text-white" },
    { key: "CALLBACK", label: "Rappel demandé", tone: "bg-info-soft text-info-ink" },
    { key: "GATEKEEPER", label: "Barrage standard", tone: "bg-warning-soft text-warning-ink" },
    { key: "NOT_INTERESTED", label: "Pas intéressé", tone: "bg-surface-3 text-ink-2" },
];

const SCRIPT = [
    "Bonjour Claire, ici {you}. Je vous appelle car nous aidons des entreprises comme la vôtre à {offer}.",
    "Comment gérez-vous ce sujet aujourd'hui ? Qu'est-ce qui vous freine le plus ?",
    "Ce que je vous propose : 30 minutes avec notre expert pour chiffrer le gain. Jeudi 10 h ou vendredi 14 h ?",
];

const NOTES_EXAMPLE =
    "Claire est DG. Ils perdent beaucoup de temps à relancer leurs prospects à la main. Budget d'environ 5k€, décision avant la rentrée. Déjà équipés d'un vieux CRM, un peu cher selon elle.";

export function FirstCallStep({ value, onChange, account, state, result, disabled }: StepComponentProps<FirstCallDraft>) {
    const [phase, setPhase] = useState<"idle" | "ringing" | "live" | "ended">(value.outcome ? "ended" : "idle");
    const [seconds, setSeconds] = useState(0);
    const timer = useRef<ReturnType<typeof setInterval> | null>(null);
    const offer = ((state.settings?.icp as { offer?: string } | undefined)?.offer ?? "gagner du temps sur leur prospection").replace(/\.$/, "");
    const fiche = (result?.fiche as DemoFiche | null | undefined) ?? null;

    useEffect(() => () => {
        if (timer.current) clearInterval(timer.current);
    }, []);

    const start = () => {
        setPhase("ringing");
        setTimeout(() => {
            setPhase("live");
            setSeconds(0);
            timer.current = setInterval(() => setSeconds((s) => s + 1), 1000);
        }, 1400);
    };
    const hangUp = () => {
        if (timer.current) clearInterval(timer.current);
        setPhase("ended");
    };

    if (fiche) return <FicheView fiche={fiche} />;

    return (
        <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
            <div className="rounded-2xl border border-line bg-surface-2 p-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-700">CM</div>
                    <div className="min-w-0">
                        <p className="truncate text-[14px] font-semibold text-ink">{value.prospectName}</p>
                        <p className="truncate text-xs text-ink-3">DG · {value.prospectCompany} · 45 salariés</p>
                    </div>
                    <Badge size="sm" variant="info" className="ml-auto">
                        Contact fictif
                    </Badge>
                </div>

                <div className="mt-4 flex items-center gap-3">
                    {phase === "idle" && (
                        <Button leftIcon={<Phone className="h-4 w-4" />} onClick={start} disabled={disabled}>
                            Appeler
                        </Button>
                    )}
                    {phase === "ringing" && <p className="animate-pulse text-[13px] text-ink-2">Appel en cours… ça sonne</p>}
                    {phase === "live" && (
                        <>
                            <Button variant="danger" leftIcon={<PhoneOff className="h-4 w-4" />} onClick={hangUp}>
                                Raccrocher
                            </Button>
                            <span className="font-mono text-[13px] tabular-nums text-ink-2" aria-live="off">
                                {String(Math.floor(seconds / 60)).padStart(2, "0")}:{String(seconds % 60).padStart(2, "0")}
                            </span>
                            <span className="flex items-center gap-1 text-xs text-danger">
                                <Circle className="h-2 w-2 fill-current" aria-hidden /> Enregistré dans le Call Vault
                            </span>
                        </>
                    )}
                    {phase === "ended" && <p className="text-[13px] text-ink-3">Appel terminé. Qualifiez-le en 1 clic.</p>}
                </div>

                {phase !== "idle" && (
                    <ol className="mt-4 space-y-2 text-[12.5px] text-ink-2">
                        {SCRIPT.map((line, i) => (
                            <li key={i} className="rounded-lg bg-surface p-2.5">
                                <span className="mr-1 font-semibold text-ink-3">{i + 1}.</span>
                                {line.replace("{you}", account.memberName.split(" ")[0]).replace("{offer}", offer.charAt(0).toLowerCase() + offer.slice(1))}
                            </li>
                        ))}
                    </ol>
                )}
            </div>

            <div className={cn("space-y-4 transition", phase === "idle" && "pointer-events-none opacity-40")} aria-disabled={phase === "idle"}>
                <Textarea
                    label="Notes prises pendant l'appel"
                    rows={5}
                    value={value.notes}
                    onChange={(e) => onChange({ ...value, notes: e.target.value })}
                    placeholder={NOTES_EXAMPLE}
                    disabled={disabled}
                />
                {!value.notes && phase !== "idle" && (
                    <Button size="xs" variant="ghost" onClick={() => onChange({ ...value, notes: NOTES_EXAMPLE })}>
                        Utiliser l&apos;exemple
                    </Button>
                )}
                <div>
                    <p className="mb-2 text-[13px] font-medium text-ink-2">Issue de l&apos;appel</p>
                    <div className="grid grid-cols-2 gap-2">
                        {OUTCOMES.map((o) => (
                            <button
                                key={o.key}
                                type="button"
                                aria-pressed={value.outcome === o.key}
                                disabled={disabled || phase === "live" || phase === "ringing"}
                                onClick={() => onChange({ ...value, outcome: o.key })}
                                className={cn(
                                    "rounded-xl px-3 py-2.5 text-[13px] font-medium transition disabled:opacity-50",
                                    value.outcome === o.key ? `${o.tone} ring-2 ring-ink/20` : "border border-line bg-surface text-ink-2 hover:bg-surface-2"
                                )}
                            >
                                {o.label}
                            </button>
                        ))}
                    </div>
                    {(phase === "live" || phase === "ringing") && <p className="mt-1.5 text-xs text-ink-4">Raccrochez pour qualifier l&apos;appel.</p>}
                </div>
                {value.outcome === "MEETING_BOOKED" && (
                    <Input label="Date du RDV" placeholder="jeudi 10 h" value={value.meetingAt} onChange={(e) => onChange({ ...value, meetingAt: e.target.value })} icon={<CalendarCheck className="h-4 w-4" />} disabled={disabled} />
                )}
                {value.outcome && value.outcome !== "MEETING_BOOKED" && (
                    <p className="text-xs text-ink-3">Astuce : choisissez « Rendez-vous pris » pour voir la Fiche de RDV générée par l&apos;IA.</p>
                )}
            </div>
        </div>
    );
}

function FicheView({ fiche }: { fiche: DemoFiche }) {
    const bant = [
        ["Budget", fiche.bant.budget],
        ["Décideur", fiche.bant.authority],
        ["Besoin", fiche.bant.need],
        ["Échéance", fiche.bant.timing],
    ] as const;
    return (
        <div className="rounded-2xl border border-line bg-surface p-5 shadow-xs">
            <div className="flex flex-wrap items-center gap-2">
                <AiMark className="h-4 w-4" />
                <h3 className="text-[15px] font-semibold text-ink">{fiche.title}</h3>
                <Badge size="sm" variant="accent" className="ml-auto">
                    Aperçu — généré en production par Mistral AI
                </Badge>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
                {bant.map(([label, ok]) => (
                    <span key={label} className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium", ok ? "bg-success-soft text-success-ink" : "bg-surface-3 text-ink-3")}>
                        {ok ? <CheckCircle2 className="h-3 w-3" aria-hidden /> : <Circle className="h-3 w-3" aria-hidden />} {label}
                    </span>
                ))}
            </div>
            <dl className="mt-4 grid gap-3 text-[13px] sm:grid-cols-2">
                {(
                    [
                        ["Contexte", fiche.context],
                        ["Douleur principale", fiche.pain],
                        ["Budget", fiche.budget],
                        ["Échéance", fiche.timeline],
                        ["Décideurs", fiche.decisionMakers],
                        ["Prochaine étape", fiche.nextStep],
                    ] as const
                ).map(([k, v]) => (
                    <div key={k} className="rounded-xl bg-surface-2 p-3">
                        <dt className="text-xs font-medium text-ink-3">{k}</dt>
                        <dd className="mt-1 text-ink">{v}</dd>
                    </div>
                ))}
            </dl>
            <div className="mt-3 rounded-xl border border-warning-line bg-warning-soft p-3 text-[13px]">
                <p className="text-xs font-medium text-warning-ink">Points de vigilance pour le closer</p>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-ink-2">
                    {fiche.objections.map((o) => (
                        <li key={o}>{o}</li>
                    ))}
                </ul>
            </div>
            <p className="mt-4 flex items-center gap-1.5 text-xs text-ink-3">
                <Sparkles className="h-3.5 w-3.5" aria-hidden /> Sur un vrai appel, la fiche est produite à partir de l&apos;enregistrement et envoyée au closer en 10 secondes.
            </p>
        </div>
    );
}

// ---------------- go_live ----------------

export function GoLiveStep({ state }: StepComponentProps<Record<string, never>>) {
    const remaining = new Set(state.summary.requiredRemaining);
    const steps = state.steps.filter((s) => s.key !== "go_live");
    return (
        <div className="space-y-4">
            <ul className="divide-y divide-line-subtle rounded-xl border border-line">
                {steps.map((s) => {
                    const done = s.status === "COMPLETED";
                    const skipped = s.status === "SKIPPED";
                    const blocking = remaining.has(s.key);
                    return (
                        <li key={s.key} className="flex items-center gap-3 px-4 py-2.5 text-[13px]">
                            {done ? (
                                <CheckCircle2 className="h-4 w-4 text-success" aria-label="Terminé" />
                            ) : (
                                <Circle className={cn("h-4 w-4", blocking ? "text-danger" : "text-ink-4")} aria-label={skipped ? "Passé" : "À faire"} />
                            )}
                            <span className={cn("flex-1", done ? "text-ink" : "text-ink-2")}>{s.title}</span>
                            {skipped && <span className="text-xs text-ink-4">Passée — à faire plus tard</span>}
                            {blocking && <span className="text-xs font-medium text-danger">Indispensable</span>}
                        </li>
                    );
                })}
            </ul>
            <div className="grid gap-3 text-[13px] sm:grid-cols-3">
                <Stat label="Contacts prêts à appeler" value={state.usage.contacts.toLocaleString("fr-FR")} />
                <Stat label="Lignes connectées" value={String(state.resources.phoneLines.filter((l) => l.verifiedAt).length)} />
                <Stat label="Membres" value={String(state.resources.members.filter((m) => m.role !== "CLIENT_VIEWER").length)} />
            </div>
        </div>
    );
}

function Stat({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-xl bg-surface-2 p-3">
            <p className="text-xl font-semibold tabular-nums text-ink">{value}</p>
            <p className="text-xs text-ink-3">{label}</p>
        </div>
    );
}
