"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Eye, EyeOff, Lock, Sparkles } from "lucide-react";
import { Button, Callout, Checkbox, Input, LoadingState, Select, Textarea } from "@/components/ui";
import { PlanOptions, type PlanSelection } from "@/components/saas/PlanOptions";
import { QuoteSummary } from "@/components/saas/QuoteSummary";
import { Stepper } from "@/components/saas/Stepper";
import { saasFetch } from "@/lib/saas/client-api";
import { PLANS, TRIAL_DAYS, computeQuote, isBillingCycle, isPlanCode, maxExtraSeats } from "@/lib/saas/plans";
import { passwordScore } from "@/lib/saas/validation";
import { cn } from "@/lib/utils";

const DRAFT_KEY = "cp_signup_draft_v1";
const STEPS = ["Offre", "Compte", "Entreprise"];

const SIZE_OPTIONS = [
    { value: "1", label: "Je travaille seul" },
    { value: "2-5", label: "2 à 5 personnes" },
    { value: "6-10", label: "6 à 10 personnes" },
    { value: "11-50", label: "11 à 50 personnes" },
    { value: "51-200", label: "51 à 200 personnes" },
    { value: "200+", label: "Plus de 200 personnes" },
];

interface Draft {
    selection: PlanSelection;
    owner: { name: string; email: string };
    company: { name: string; size: string; industry: string; phone: string; siret: string; vatNumber: string; useCase: string };
}

const EMPTY_DRAFT: Draft = {
    selection: { plan: "SMALL_BUSINESS", cycle: "ANNUAL", extraSeats: 0, includeSetup: false },
    owner: { name: "", email: "" },
    company: { name: "", size: "", industry: "", phone: "", siret: "", vatNumber: "", useCase: "" },
};

type Errors = Record<string, string>;

function validateStep(step: number, draft: Draft, password: string, acceptTerms: boolean): Errors {
    const e: Errors = {};
    if (step === 1) {
        if (draft.owner.name.trim().length < 2) e.name = "Votre nom est requis.";
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(draft.owner.email.trim())) e.email = "Adresse email invalide.";
        if (password.length < 10) e.password = "10 caractères minimum.";
        else if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) e.password = "Au moins une lettre et un chiffre.";
    }
    if (step === 2) {
        if (draft.company.name.trim().length < 2) e.companyName = "Nom de l'entreprise requis.";
        if (!draft.company.size) e.size = "Choisissez une taille d'équipe.";
        if (draft.company.siret && !/^\d{14}$/.test(draft.company.siret.replace(/\s/g, ""))) e.siret = "SIRET : 14 chiffres.";
        if (!acceptTerms) e.terms = "Vous devez accepter les conditions.";
    }
    return e;
}

const STRENGTH = ["Trop faible", "Faible", "Correct", "Bon", "Excellent"];

/** Saved draft (never the password), then the URL picks the plan. Browser only. */
function readInitialDraft(params: URLSearchParams): Draft {
    let next = EMPTY_DRAFT;
    try {
        const raw = sessionStorage.getItem(DRAFT_KEY);
        if (raw) next = { ...EMPTY_DRAFT, ...JSON.parse(raw) };
    } catch {
        /* storage unavailable */
    }
    const plan = params.get("plan");
    const cycle = params.get("cycle");
    if (isPlanCode(plan)) {
        const max = maxExtraSeats(plan);
        next = {
            ...next,
            selection: {
                ...next.selection,
                plan,
                extraSeats: max === null ? next.selection.extraSeats : Math.min(next.selection.extraSeats, max),
            },
        };
    }
    if (isBillingCycle(cycle)) next = { ...next, selection: { ...next.selection, cycle } };
    return next;
}

const noopSubscribe = () => () => {};

/** The draft lives in sessionStorage, so the form renders on the client only (no hydration mismatch). */
export function SignupFlow() {
    const isClient = useSyncExternalStore(noopSubscribe, () => true, () => false);
    if (!isClient) return <LoadingState message="Chargement…" />;
    return <SignupForm />;
}

function SignupForm() {
    const router = useRouter();
    const params = useSearchParams();
    const [step, setStep] = useState(0);
    const [draft, setDraft] = useState<Draft>(() => readInitialDraft(params));
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [acceptTerms, setAcceptTerms] = useState(false);
    const [honeypot, setHoneypot] = useState("");
    const [errors, setErrors] = useState<Errors>({});
    const [serverError, setServerError] = useState<{ message: string; code?: string } | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const headingRef = useRef<HTMLHeadingElement>(null);

    useEffect(() => {
        try {
            sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
        } catch {
            /* storage unavailable */
        }
    }, [draft]);

    useEffect(() => {
        headingRef.current?.focus();
    }, [step]);

    const plan = PLANS[draft.selection.plan];
    const quote = useMemo(() => computeQuote(draft.selection), [draft.selection]);
    const score = passwordScore(password);

    const setOwner = (patch: Partial<Draft["owner"]>) => setDraft((d) => ({ ...d, owner: { ...d.owner, ...patch } }));
    const setCompany = (patch: Partial<Draft["company"]>) => setDraft((d) => ({ ...d, company: { ...d.company, ...patch } }));

    const next = () => {
        const e = validateStep(step, draft, password, acceptTerms);
        setErrors(e);
        if (Object.keys(e).length > 0) return;
        if (step < STEPS.length - 1) setStep(step + 1);
        else void submit();
    };

    const submit = async () => {
        setSubmitting(true);
        setServerError(null);
        const res = await saasFetch<{ next: string }>("/api/saas/signup", {
            body: {
                ...draft.selection,
                owner: { name: draft.owner.name, email: draft.owner.email, password },
                company: {
                    name: draft.company.name,
                    size: draft.company.size,
                    industry: draft.company.industry || undefined,
                    phone: draft.company.phone || undefined,
                    siret: draft.company.siret.replace(/\s/g, "") || undefined,
                    vatNumber: draft.company.vatNumber || undefined,
                    useCase: draft.company.useCase || undefined,
                    country: "FR",
                },
                acceptTerms,
                website: honeypot,
            },
        });
        if (!res.ok) {
            setSubmitting(false);
            setServerError({ message: res.error, code: res.code });
            if (res.code === "email_taken") setStep(1);
            return;
        }
        try {
            sessionStorage.removeItem(DRAFT_KEY);
        } catch {
            /* storage unavailable */
        }
        router.push(res.data.next);
    };

    const cta =
        step < STEPS.length - 1
            ? "Continuer"
            : plan.trialAvailable
              ? `Démarrer mon essai de ${TRIAL_DAYS} jours`
              : "Continuer vers le paiement";

    return (
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_340px]">
            <div className="min-w-0">
                <Stepper steps={STEPS} current={step} />

                <form
                    className="mt-8 rounded-2xl border border-line bg-surface p-5 shadow-xs sm:p-7"
                    onSubmit={(e) => {
                        e.preventDefault();
                        next();
                    }}
                    noValidate
                >
                    <h1 ref={headingRef} tabIndex={-1} className="text-xl font-semibold text-ink outline-none">
                        {step === 0 && "Choisissez votre offre"}
                        {step === 1 && "Créez votre compte"}
                        {step === 2 && "Votre entreprise"}
                    </h1>
                    <p className="mt-1 text-[13.5px] text-ink-3">
                        {step === 0 && "Vous pourrez changer d'offre à tout moment depuis votre espace."}
                        {step === 1 && "Vous serez l'administrateur de votre espace."}
                        {step === 2 && "Ces informations apparaissent sur vos factures et préparent votre onboarding."}
                    </p>

                    {serverError && (
                        <Callout tone="danger" className="mt-5">
                            {serverError.message}{" "}
                            {serverError.code === "email_taken" && (
                                <Link href="/espace/connexion" className="font-semibold underline">
                                    Se connecter
                                </Link>
                            )}
                        </Callout>
                    )}

                    <div className="mt-6">
                        {step === 0 && (
                            <PlanOptions value={draft.selection} onChange={(selection) => setDraft((d) => ({ ...d, selection }))} />
                        )}

                        {step === 1 && (
                            <div className="grid gap-4">
                                <Input
                                    label="Nom complet"
                                    required
                                    autoComplete="name"
                                    value={draft.owner.name}
                                    onChange={(e) => setOwner({ name: e.target.value })}
                                    error={errors.name}
                                />
                                <Input
                                    label="Email professionnel"
                                    type="email"
                                    required
                                    autoComplete="email"
                                    value={draft.owner.email}
                                    onChange={(e) => setOwner({ email: e.target.value })}
                                    error={errors.email}
                                />
                                <div>
                                    <Input
                                        label="Mot de passe"
                                        type={showPassword ? "text" : "password"}
                                        required
                                        autoComplete="new-password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        error={errors.password}
                                        hint="10 caractères minimum, avec au moins une lettre et un chiffre."
                                        endIcon={
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword((v) => !v)}
                                                className="text-ink-4 hover:text-ink"
                                                aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                                            >
                                                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                            </button>
                                        }
                                    />
                                    {password && (
                                        <div className="mt-2 flex items-center gap-2" aria-live="polite">
                                            <div className="flex flex-1 gap-1">
                                                {[0, 1, 2, 3].map((i) => (
                                                    <span
                                                        key={i}
                                                        className={cn(
                                                            "h-1 flex-1 rounded-full",
                                                            i < score
                                                                ? score <= 1
                                                                    ? "bg-danger"
                                                                    : score === 2
                                                                      ? "bg-warning"
                                                                      : "bg-success"
                                                                : "bg-surface-3"
                                                        )}
                                                    />
                                                ))}
                                            </div>
                                            <span className="w-20 text-right text-[11.5px] text-ink-3">{STRENGTH[score]}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {step === 2 && (
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="sm:col-span-2">
                                    <Input
                                        label="Nom de l'entreprise"
                                        required
                                        autoComplete="organization"
                                        value={draft.company.name}
                                        onChange={(e) => setCompany({ name: e.target.value })}
                                        error={errors.companyName}
                                    />
                                </div>
                                <Select
                                    label="Taille de l'équipe"
                                    options={SIZE_OPTIONS}
                                    value={draft.company.size}
                                    onChange={(size) => setCompany({ size })}
                                    error={errors.size}
                                    placeholder="Choisir…"
                                />
                                <Input
                                    label="Secteur"
                                    value={draft.company.industry}
                                    onChange={(e) => setCompany({ industry: e.target.value })}
                                    placeholder="SaaS, conseil, industrie…"
                                />
                                <Input
                                    label="Téléphone"
                                    type="tel"
                                    autoComplete="tel"
                                    value={draft.company.phone}
                                    onChange={(e) => setCompany({ phone: e.target.value })}
                                />
                                <Input
                                    label="SIRET"
                                    inputMode="numeric"
                                    value={draft.company.siret}
                                    onChange={(e) => setCompany({ siret: e.target.value })}
                                    error={errors.siret}
                                    hint="Facultatif"
                                />
                                <Input
                                    label="N° de TVA intracommunautaire"
                                    value={draft.company.vatNumber}
                                    onChange={(e) => setCompany({ vatNumber: e.target.value })}
                                    hint="Facultatif"
                                />
                                <div className="sm:col-span-2">
                                    <Textarea
                                        label="Qu'attendez-vous de l'outil ?"
                                        rows={3}
                                        maxLength={400}
                                        value={draft.company.useCase}
                                        onChange={(e) => setCompany({ useCase: e.target.value })}
                                        placeholder="Ex. : passer de 40 à 80 appels/jour par SDR et arrêter de payer Aircall + Modjo."
                                    />
                                </div>
                                {/* Honeypot: hidden from people, filled by bots. */}
                                <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
                                    <label>
                                        Site web
                                        <input tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
                                    </label>
                                </div>
                                <div className="sm:col-span-2">
                                    <Checkbox
                                        checked={acceptTerms}
                                        onChange={(e) => setAcceptTerms(e.target.checked)}
                                        label="J'accepte les conditions générales et la politique de confidentialité."
                                    />
                                    {errors.terms && <p className="mt-1 text-xs text-danger">{errors.terms}</p>}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="mt-8 flex items-center justify-between gap-3 border-t border-line-subtle pt-5">
                        {step > 0 ? (
                            <Button type="button" variant="ghost" leftIcon={<ArrowLeft className="h-4 w-4" />} onClick={() => setStep(step - 1)}>
                                Retour
                            </Button>
                        ) : (
                            <Link href="/tarifs" className="text-[13px] text-ink-3 hover:text-ink">
                                Comparer les offres
                            </Link>
                        )}
                        <Button
                            type="submit"
                            size="lg"
                            isLoading={submitting}
                            leftIcon={step === 2 ? plan.trialAvailable ? <Sparkles className="h-4 w-4" /> : <Lock className="h-4 w-4" /> : undefined}
                            rightIcon={step < 2 ? <ArrowRight className="h-4 w-4" /> : undefined}
                        >
                            {cta}
                        </Button>
                    </div>
                </form>

                <p className="mt-4 text-center text-[13px] text-ink-3">
                    Déjà un compte ?{" "}
                    <Link href="/espace/connexion" className="font-medium text-link hover:underline">
                        Se connecter
                    </Link>
                </p>
            </div>

            <div className="lg:sticky lg:top-20 lg:self-start">
                <QuoteSummary quote={quote} trial={plan.trialAvailable} />
            </div>
        </div>
    );
}
