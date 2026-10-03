"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Circle, Clock, CloudOff, Loader2, Lock, PartyPopper, SkipForward } from "lucide-react";
import { Badge, Button, Callout, useToast } from "@/components/ui";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { cn } from "@/lib/utils";
import { saasFetch } from "@/lib/saas/client-api";
import { PHASE_LABELS, type OnboardingPhase, type OnboardingStepKey } from "@/lib/saas/onboarding-steps";
import { STEP_UI, initialDraft } from "./registry";
import type { AccountView, OnboardingState, OnboardingStepView } from "./types";

type SaveStatus = "idle" | "saving" | "saved" | "offline";

interface WizardProps {
    initialState: OnboardingState;
    account: AccountView;
}

const AUTOSAVE_MS = 1200;

export function OnboardingWizard({ initialState, account }: WizardProps) {
    const router = useRouter();
    const params = useSearchParams();
    const toast = useToast();
    const [state, setState] = useState(initialState);
    const [drafts, setDrafts] = useState<Partial<Record<OnboardingStepKey, unknown>>>({});
    const [results, setResults] = useState<Partial<Record<OnboardingStepKey, Record<string, unknown>>>>({});
    const [busy, setBusy] = useState<"complete" | "skip" | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
    const [finished, setFinished] = useState(Boolean(initialState.completedAt) && params.get("step") === null);
    const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pendingSave = useRef<{ key: OnboardingStepKey; data: unknown } | null>(null);
    const headingRef = useRef<HTMLHeadingElement>(null);

    const steps = state.steps;
    const requestedKey = params.get("step") as OnboardingStepKey | null;
    const currentKey: OnboardingStepKey =
        (requestedKey && steps.some((s) => s.key === requestedKey) ? requestedKey : null) ?? state.summary.nextStep ?? steps[steps.length - 1].key;
    const current = steps.find((s) => s.key === currentKey)!;
    const index = steps.findIndex((s) => s.key === currentKey);
    const ui = STEP_UI[currentKey];
    const isDone = current.status === "COMPLETED";
    const locked = current.adminOnly && !account.isAdmin;

    const draft = useMemo(
        () => drafts[currentKey] ?? initialDraft(currentKey, current.data, state, account, isDone),
        [drafts, currentKey, current.data, state, account, isDone]
    );
    const result = results[currentKey] ?? (currentKey === "first_call" && isDone ? ((current.data as Record<string, unknown> | null) ?? null) : null);

    const goTo = useCallback(
        (key: OnboardingStepKey | null) => {
            setError(null);
            setFinished(false);
            const url = key ? `/espace/onboarding?step=${key}` : "/espace/onboarding";
            router.replace(url, { scroll: false });
        },
        [router]
    );

    useEffect(() => {
        headingRef.current?.focus({ preventScroll: true });
        window.scrollTo({ top: 0, behavior: "smooth" });
    }, [currentKey]);

    // A draft that couldn't reach the server (offline) was kept on this device: bring it back.
    useEffect(() => {
        if (drafts[currentKey] !== undefined || isDone) return;
        try {
            const raw = localStorage.getItem(`cp_onb_${currentKey}`);
            if (!raw) return;
            const restored = initialDraft(currentKey, JSON.parse(raw), state, account, false);
            setDrafts((d) => ({ ...d, [currentKey]: restored }));
            pendingSave.current = { key: currentKey, data: restored };
            void flushSave();
            localStorage.removeItem(`cp_onb_${currentKey}`);
        } catch {
            /* storage unavailable or corrupt draft */
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentKey]);

    const refresh = useCallback(async () => {
        const res = await saasFetch<OnboardingState>("/api/saas/onboarding");
        if (res.ok) setState(res.data);
        else if (res.status === 402) router.push("/espace/paiement");
    }, [router]);

    // ---- autosave (drafts of steps that aren't finished) ----
    const flushSave = useCallback(async () => {
        if (saveTimer.current) clearTimeout(saveTimer.current);
        const job = pendingSave.current;
        if (!job) return;
        pendingSave.current = null;
        setSaveStatus("saving");
        const res = await saasFetch(`/api/saas/onboarding/${job.key}`, { method: "PUT", body: { action: "save", data: job.data } });
        setSaveStatus(res.ok ? "saved" : "offline");
        if (!res.ok) {
            try {
                localStorage.setItem(`cp_onb_${job.key}`, JSON.stringify(job.data));
            } catch {
                /* storage unavailable */
            }
        }
    }, []);

    const setDraft = (next: unknown) => {
        setDrafts((d) => ({ ...d, [currentKey]: next }));
        if (isDone || locked) return;
        // Steps whose state lives in their own tables (lines, keys) have nothing to draft.
        if (currentKey === "phone_line" || currentKey === "go_live") return;
        pendingSave.current = { key: currentKey, data: next };
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => void flushSave(), AUTOSAVE_MS);
    };

    useEffect(() => {
        const warn = (e: BeforeUnloadEvent) => {
            if (pendingSave.current) {
                void flushSave();
                e.preventDefault();
            }
        };
        window.addEventListener("beforeunload", warn);
        return () => window.removeEventListener("beforeunload", warn);
    }, [flushSave]);

    // Leaving a step: save its draft right away instead of waiting for the debounce.
    useEffect(() => {
        return () => {
            if (pendingSave.current) void flushSave();
        };
    }, [currentKey, flushSave]);

    const nextKeyAfter = (s: OnboardingState, from: OnboardingStepKey): OnboardingStepKey | null => {
        const i = s.steps.findIndex((x) => x.key === from);
        const after = s.steps.slice(i + 1).find((x) => x.status === "PENDING");
        return after?.key ?? s.summary.nextStep;
    };

    const complete = async () => {
        if (busy) return;
        setError(null);
        setBusy("complete");
        pendingSave.current = null;
        const payload = ui.toPayload ? ui.toPayload(draft) : draft;
        const res = await saasFetch<{ status: string; result?: Record<string, unknown> }>(`/api/saas/onboarding/${currentKey}`, {
            method: "PUT",
            body: { action: "complete", data: payload },
        });
        if (!res.ok) {
            setBusy(null);
            setError(res.error);
            if (res.status === 402) router.push("/espace/paiement");
            return;
        }
        const fresh = await saasFetch<OnboardingState>("/api/saas/onboarding");
        const nextState = fresh.ok ? fresh.data : state;
        setState(nextState);
        setBusy(null);
        setDrafts((d) => {
            const copy = { ...d };
            delete copy[currentKey];
            return copy;
        });
        try {
            localStorage.removeItem(`cp_onb_${currentKey}`);
        } catch {
            /* storage unavailable */
        }

        if (currentKey === "go_live") {
            setFinished(true);
            router.replace("/espace/onboarding", { scroll: false });
            router.refresh();
            return;
        }
        const r = res.data.result;
        if (r && (r.fiche || (Array.isArray(r.inviteLinks) && r.inviteLinks.length > 0))) {
            // Something to look at (links shown once, the generated fiche): stay on the step.
            setResults((m) => ({ ...m, [currentKey]: r }));
            toast.success("Étape terminée");
            return;
        }
        toast.success(`${current.title} : c'est fait`);
        goTo(nextKeyAfter(nextState, currentKey));
    };

    const skip = async () => {
        if (busy) return;
        setBusy("skip");
        const res = await saasFetch<OnboardingState>(`/api/saas/onboarding/${currentKey}`, { method: "PUT", body: { action: "skip" } });
        if (!res.ok) {
            setBusy(null);
            setError(res.error);
            return;
        }
        const fresh = await saasFetch<OnboardingState>("/api/saas/onboarding");
        const nextState = fresh.ok ? fresh.data : state;
        setState(nextState);
        setBusy(null);
        goTo(nextKeyAfter(nextState, currentKey));
    };

    // Ctrl/Cmd + Enter submits the step.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                void complete();
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    });

    const minutesLeft = steps.filter((s) => s.status === "PENDING").reduce((sum, s) => sum + s.minutes, 0);
    const ready = ui.ready ? ui.ready(draft, state) : true;
    const showResultContinue = Boolean(results[currentKey]);

    if (finished) return <FinishedScreen account={account} state={state} onReview={() => goTo(steps[0].key)} />;

    return (
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
            <StepRail steps={steps} currentKey={currentKey} onSelect={goTo} percent={state.summary.percent} minutesLeft={minutesLeft} />

            <section className="min-w-0 rounded-2xl border border-line bg-surface shadow-xs" aria-labelledby="step-title">
                <header className="border-b border-line-subtle p-5 sm:p-6">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-ink-3">
                        <span>
                            Étape {index + 1} sur {steps.length} · {PHASE_LABELS[current.phase]}
                        </span>
                        <span className="inline-flex items-center gap-1">
                            <Clock className="h-3 w-3" aria-hidden /> {current.minutes} min
                        </span>
                        {current.required ? <Badge size="sm">Indispensable</Badge> : <Badge size="sm" variant="outline">Facultative</Badge>}
                        {isDone && (
                            <Badge size="sm" variant="success" dot>
                                Terminée
                            </Badge>
                        )}
                        {current.status === "SKIPPED" && <Badge size="sm" variant="warning">Passée</Badge>}
                        <SaveIndicator status={saveStatus} />
                    </div>
                    <h1 id="step-title" ref={headingRef} tabIndex={-1} className="mt-2 text-xl font-semibold text-ink outline-none">
                        {current.title}
                    </h1>
                    <p className="mt-1 text-[13.5px] leading-relaxed text-ink-3">{current.why}</p>
                </header>

                <div className="p-5 sm:p-6">
                    {locked && (
                        <Callout tone="info" icon={Lock} className="mb-5">
                            Cette étape est configurée par l&apos;administrateur de votre espace. Vous pouvez la consulter, ou passer à la suivante.
                        </Callout>
                    )}
                    {error && (
                        <Callout tone="danger" className="mb-5" title="Impossible de valider l'étape">
                            {error}
                        </Callout>
                    )}
                    <ui.Component value={draft} onChange={setDraft} state={state} account={account} refresh={refresh} result={result} disabled={locked || busy !== null} />
                </div>

                <footer className="flex flex-wrap items-center gap-2 border-t border-line-subtle p-4 sm:px-6">
                    <Button variant="ghost" size="sm" leftIcon={<ArrowLeft className="h-4 w-4" />} disabled={index === 0} onClick={() => goTo(steps[index - 1]?.key ?? null)}>
                        Précédent
                    </Button>
                    <div className="ml-auto flex flex-wrap items-center gap-2">
                        {!current.required && !isDone && !locked && (
                            <Button variant="ghost" size="sm" leftIcon={<SkipForward className="h-4 w-4" />} isLoading={busy === "skip"} onClick={skip}>
                                Plus tard
                            </Button>
                        )}
                        {(isDone || locked || current.status === "SKIPPED") && index < steps.length - 1 && !showResultContinue && (
                            <Button variant="secondary" size="sm" rightIcon={<ArrowRight className="h-4 w-4" />} onClick={() => goTo(steps[index + 1].key)}>
                                Étape suivante
                            </Button>
                        )}
                        {showResultContinue ? (
                            <Button rightIcon={<ArrowRight className="h-4 w-4" />} onClick={() => goTo(nextKeyAfter(state, currentKey))}>
                                Continuer
                            </Button>
                        ) : (
                            !locked && (
                                <Button
                                    onClick={complete}
                                    isLoading={busy === "complete"}
                                    disabled={!ready}
                                    title={!ready ? "Complétez les champs de l'étape" : "Ctrl + Entrée"}
                                    rightIcon={currentKey === "go_live" ? undefined : <Check className="h-4 w-4" />}
                                >
                                    {isDone ? "Mettre à jour" : (ui.cta ?? "Valider et continuer")}
                                </Button>
                            )
                        )}
                    </div>
                </footer>
            </section>
        </div>
    );
}

function SaveIndicator({ status }: { status: SaveStatus }) {
    if (status === "idle") return null;
    return (
        <span className="ml-auto inline-flex items-center gap-1" role="status">
            {status === "saving" && (
                <>
                    <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> Enregistrement…
                </>
            )}
            {status === "saved" && (
                <>
                    <Check className="h-3 w-3 text-success" aria-hidden /> Brouillon enregistré
                </>
            )}
            {status === "offline" && (
                <>
                    <CloudOff className="h-3 w-3 text-warning" aria-hidden /> Brouillon gardé sur cet appareil
                </>
            )}
        </span>
    );
}

function StepRail({
    steps,
    currentKey,
    onSelect,
    percent,
    minutesLeft,
}: {
    steps: OnboardingStepView[];
    currentKey: OnboardingStepKey;
    onSelect: (k: OnboardingStepKey) => void;
    percent: number;
    minutesLeft: number;
}) {
    const phases = [...new Set(steps.map((s) => s.phase))] as OnboardingPhase[];
    return (
        <nav aria-label="Étapes de l'onboarding" className="lg:sticky lg:top-20 lg:self-start">
            <div className="rounded-2xl border border-line bg-surface p-4 shadow-xs">
                <div className="flex items-baseline justify-between">
                    <p className="text-[13px] font-semibold text-ink">Mise en route</p>
                    <p className="text-[13px] font-semibold tabular-nums text-ink">{percent} %</p>
                </div>
                <ProgressBar value={percent} max={100} className="mt-2" height="sm" tone={percent === 100 ? "success" : "primary"} />
                <p className="mt-2 text-xs text-ink-3">{minutesLeft > 0 ? `Environ ${minutesLeft} min restantes` : "Tout est prêt"}</p>

                <div className="mt-4 space-y-4">
                    {phases.map((phase) => (
                        <div key={phase}>
                            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-4">{PHASE_LABELS[phase]}</p>
                            <ol className="space-y-0.5">
                                {steps
                                    .filter((s) => s.phase === phase)
                                    .map((s) => {
                                        const active = s.key === currentKey;
                                        return (
                                            <li key={s.key}>
                                                <button
                                                    type="button"
                                                    onClick={() => onSelect(s.key)}
                                                    aria-current={active ? "step" : undefined}
                                                    className={cn(
                                                        "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] transition",
                                                        active ? "bg-primary-50 font-medium text-primary-700" : "text-ink-2 hover:bg-surface-2"
                                                    )}
                                                >
                                                    {s.status === "COMPLETED" ? (
                                                        <CheckCircle2 className="h-4 w-4 shrink-0 text-success" aria-label="Terminée" />
                                                    ) : s.status === "SKIPPED" ? (
                                                        <SkipForward className="h-4 w-4 shrink-0 text-ink-4" aria-label="Passée" />
                                                    ) : (
                                                        <Circle className={cn("h-4 w-4 shrink-0", active ? "text-primary" : "text-ink-4")} aria-label="À faire" />
                                                    )}
                                                    <span className="truncate">{s.title}</span>
                                                    {!s.required && s.status === "PENDING" && <span className="ml-auto text-[10.5px] text-ink-4">option</span>}
                                                </button>
                                            </li>
                                        );
                                    })}
                            </ol>
                        </div>
                    ))}
                </div>
            </div>
        </nav>
    );
}

function FinishedScreen({ account, state, onReview }: { account: AccountView; state: OnboardingState; onReview: () => void }) {
    const skipped = state.steps.filter((s) => s.status === "SKIPPED");
    return (
        <div className="mx-auto max-w-2xl py-6 text-center">
            <PartyPopper className="mx-auto h-12 w-12 text-accent" aria-hidden />
            <h1 className="mt-4 text-2xl font-semibold text-ink">Votre espace est prêt, {account.memberName.split(" ")[0]} !</h1>
            <p className="mt-2 text-[14px] text-ink-3">
                {state.usage.contacts.toLocaleString("fr-FR")} contacts vous attendent dans la file d&apos;appels. Votre première session peut commencer.
            </p>
            {skipped.length > 0 && (
                <Callout tone="info" className="mt-6 text-left" title="À compléter quand vous aurez un moment">
                    <ul className="list-disc pl-5">
                        {skipped.map((s) => (
                            <li key={s.key}>{s.title}</li>
                        ))}
                    </ul>
                </Callout>
            )}
            <div className="mt-8 flex flex-wrap justify-center gap-3">
                <Link href="/espace" className="inline-flex h-11 items-center rounded-control bg-primary px-5 text-sm font-semibold text-primary-fg shadow-primary hover:bg-primary-hover">
                    Aller à mon espace
                </Link>
                <Button variant="secondary" size="lg" onClick={onReview}>
                    Revoir la configuration
                </Button>
            </div>
        </div>
    );
}
