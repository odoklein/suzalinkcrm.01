"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, CreditCard, FlaskConical, Lock, ShieldCheck } from "lucide-react";
import { Button, Callout, Input, Modal } from "@/components/ui";
import { PlanOptions, type PlanSelection } from "./PlanOptions";
import { QuoteSummary } from "./QuoteSummary";
import { newIdempotencyKey, saasFetch } from "@/lib/saas/client-api";
import { TEST_CARDS, detectBrand, validateCard, type CardFieldErrors } from "@/lib/saas/mock-card";
import { PLANS, PLAN_ORDER, computeQuote, effectiveQuotas, formatEuros, type PlanCode } from "@/lib/saas/plans";

interface CheckoutFlowProps {
    status: string;
    initial: PlanSelection;
    hasPaidSetup: boolean;
    usage: { seats: number; workspaces: number; phoneLines: number; contacts: number };
    onboardingDone: boolean;
    currentPeriodEnd: string | null;
}

const HEADINGS: Record<string, { title: string; body: string }> = {
    PENDING_PAYMENT: {
        title: "Finalisez votre souscription",
        body: "Votre espace est réservé. Dès le paiement confirmé, nous provisionnons votre instance et l'onboarding démarre.",
    },
    TRIALING: {
        title: "Activer votre abonnement",
        body: "Tout ce que vous avez configuré pendant l'essai est conservé. Les limites d'essai sont levées immédiatement.",
    },
    TRIAL_EXPIRED: {
        title: "Votre essai est terminé",
        body: "Votre configuration et vos données sont conservées. Activez l'abonnement pour reprendre là où vous en étiez.",
    },
    CANCELED: {
        title: "Réactiver votre abonnement",
        body: "Votre configuration est toujours là. Choisissez une offre pour réactiver votre espace.",
    },
    ACTIVE: {
        title: "Changer d'offre",
        body: "Modifiez votre offre, votre période ou vos sièges. Le nouveau tarif s'applique dès aujourd'hui.",
    },
};

function formatCardNumber(raw: string) {
    const digits = raw.replace(/\D/g, "").slice(0, 19);
    return digits.replace(/(.{4})/g, "$1 ").trim();
}

function formatExpiry(raw: string) {
    const digits = raw.replace(/\D/g, "").slice(0, 4);
    return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
}

const BRAND_LABEL: Record<string, string> = { visa: "Visa", mastercard: "Mastercard", amex: "Amex", cb: "CB", unknown: "" };

export function CheckoutFlow(props: CheckoutFlowProps) {
    const router = useRouter();
    const [selection, setSelection] = useState<PlanSelection>({
        ...props.initial,
        includeSetup: props.hasPaidSetup ? false : props.initial.includeSetup,
    });
    const [card, setCard] = useState({ number: "", expiry: "", cvc: "", holder: "" });
    const [fieldErrors, setFieldErrors] = useState<CardFieldErrors>({});
    const [error, setError] = useState("");
    const [processing, setProcessing] = useState(false);
    const [threeDsOpen, setThreeDsOpen] = useState(false);
    const [success, setSuccess] = useState<{ invoiceNumber: string | null; totalCents: number; next: string } | null>(null);
    const keyRef = useRef<string | null>(null);

    const quote = useMemo(() => computeQuote(selection), [selection]);
    const brand = detectBrand(card.number);
    const heading = HEADINGS[props.status] ?? HEADINGS.ACTIVE;

    // Plans the account has outgrown can't be picked (the server enforces it too).
    const disabledPlans = useMemo(
        () =>
            PLAN_ORDER.filter((code) => {
                const q = effectiveQuotas(code, { extraSeats: code === selection.plan ? selection.extraSeats : 0, trialing: false });
                const maxSeats = PLANS[code].quotas.maxSeats ?? Infinity;
                return (
                    props.usage.seats > maxSeats ||
                    (q.workspaces !== null && props.usage.workspaces > q.workspaces) ||
                    (q.phoneLines !== null && props.usage.phoneLines > q.phoneLines) ||
                    props.usage.contacts > q.contacts
                );
            }) as PlanCode[],
        [props.usage, selection.plan, selection.extraSeats]
    );
    const seatShortfall = props.usage.seats - (PLANS[selection.plan].quotas.includedSeats + selection.extraSeats);

    const pay = async (threeDsConfirmed = false) => {
        setError("");
        const errs = validateCard(card);
        setFieldErrors(errs);
        if (Object.keys(errs).length > 0) return;
        if (seatShortfall > 0) {
            setError(`Votre équipe compte ${props.usage.seats} membres : ajoutez ${seatShortfall} siège(s).`);
            return;
        }

        // One key per attempt: a double click or a retry of the same attempt can't charge twice.
        keyRef.current ??= newIdempotencyKey();
        setProcessing(true);
        const res = await saasFetch<{ payment: { invoiceNumber: string | null; totalCents: number }; next: string }>(
            "/api/saas/checkout",
            { body: { ...selection, card, threeDsConfirmed, idempotencyKey: keyRef.current } }
        );
        setProcessing(false);

        if (res.ok) {
            keyRef.current = null;
            setSuccess({ ...res.data.payment, next: res.data.next });
            router.refresh();
            return;
        }
        if (res.code === "requires_3ds") {
            setThreeDsOpen(true);
            return;
        }
        // A decline is final for this key; the next try is a new attempt.
        if (res.status === 402 || res.status === 409 || res.status === 422) keyRef.current = null;
        setError(res.error);
    };

    if (success) {
        return (
            <div className="mx-auto max-w-lg py-10 text-center">
                <CheckCircle2 className="mx-auto h-12 w-12 text-success" aria-hidden />
                <h1 className="mt-4 text-2xl font-semibold text-ink">Paiement confirmé</h1>
                <p className="mt-2 text-[14px] text-ink-3">
                    {formatEuros(success.totalCents, { decimals: true })} TTC · facture {success.invoiceNumber}
                </p>
                <p className="mt-4 text-[14px] text-ink-2">
                    Votre offre {PLANS[selection.plan].name} est active.{" "}
                    {props.onboardingDone ? "Bon retour parmi nous." : "Configurons maintenant votre espace : comptez une quinzaine de minutes."}
                </p>
                <Button className="mt-6" size="lg" onClick={() => router.push(success.next)}>
                    {props.onboardingDone ? "Retour à mon espace" : "Démarrer l'onboarding"}
                </Button>
            </div>
        );
    }

    return (
        <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
            <div className="min-w-0 space-y-6">
                <div>
                    <h1 className="text-2xl font-semibold text-ink">{heading.title}</h1>
                    <p className="mt-1 text-[14px] text-ink-3">{heading.body}</p>
                    {props.status === "ACTIVE" && props.currentPeriodEnd && (
                        <p className="mt-1 text-[13px] text-ink-3">
                            Période en cours jusqu&apos;au {new Date(props.currentPeriodEnd).toLocaleDateString("fr-FR")}.
                        </p>
                    )}
                </div>

                <Callout tone="warning" icon={FlaskConical} title="Paiement simulé">
                    Environnement de démonstration : aucune somme n&apos;est débitée et le numéro de carte n&apos;est jamais stocké (seuls la marque et
                    les 4 derniers chiffres sont conservés).
                </Callout>

                <section className="rounded-2xl border border-line bg-surface p-5 shadow-xs sm:p-6">
                    <h2 className="mb-4 text-[15px] font-semibold text-ink">Votre offre</h2>
                    <PlanOptions value={selection} onChange={setSelection} disabledPlans={disabledPlans} hideSetup={props.hasPaidSetup} />
                    {disabledPlans.length > 0 && (
                        <p className="mt-3 text-xs text-ink-3">
                            Offres indisponibles : votre usage actuel ({props.usage.seats} membres, {props.usage.workspaces} workspaces,{" "}
                            {props.usage.phoneLines} lignes) dépasse leurs limites.
                        </p>
                    )}
                </section>

                <form
                    className="rounded-2xl border border-line bg-surface p-5 shadow-xs sm:p-6"
                    onSubmit={(e) => {
                        e.preventDefault();
                        void pay();
                    }}
                    noValidate
                >
                    <h2 className="mb-4 flex items-center gap-2 text-[15px] font-semibold text-ink">
                        <CreditCard className="h-4 w-4 text-ink-3" aria-hidden /> Carte bancaire
                    </h2>
                    {error && (
                        <Callout tone="danger" className="mb-4">
                            {error}
                        </Callout>
                    )}
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                            <Input
                                label="Numéro de carte"
                                inputMode="numeric"
                                autoComplete="cc-number"
                                placeholder="1234 1234 1234 1234"
                                value={card.number}
                                onChange={(e) => setCard({ ...card, number: formatCardNumber(e.target.value) })}
                                error={fieldErrors.number}
                                endIcon={brand !== "unknown" ? <span className="text-[11px] font-semibold text-ink-3">{BRAND_LABEL[brand]}</span> : undefined}
                            />
                        </div>
                        <Input
                            label="Expiration"
                            inputMode="numeric"
                            autoComplete="cc-exp"
                            placeholder="MM/AA"
                            value={card.expiry}
                            onChange={(e) => setCard({ ...card, expiry: formatExpiry(e.target.value) })}
                            error={fieldErrors.expiry}
                        />
                        <Input
                            label="CVC"
                            inputMode="numeric"
                            autoComplete="cc-csc"
                            placeholder={brand === "amex" ? "1234" : "123"}
                            value={card.cvc}
                            onChange={(e) => setCard({ ...card, cvc: e.target.value.replace(/\D/g, "").slice(0, 4) })}
                            error={fieldErrors.cvc}
                        />
                        <div className="sm:col-span-2">
                            <Input
                                label="Titulaire de la carte"
                                autoComplete="cc-name"
                                value={card.holder}
                                onChange={(e) => setCard({ ...card, holder: e.target.value })}
                                error={fieldErrors.holder}
                            />
                        </div>
                    </div>

                    <details className="mt-4 rounded-xl bg-surface-2 px-4 py-3 text-[12.5px]">
                        <summary className="cursor-pointer font-medium text-ink-2">Cartes de test</summary>
                        <ul className="mt-2 space-y-1">
                            {TEST_CARDS.map((t) => (
                                <li key={t.number}>
                                    <button
                                        type="button"
                                        className="font-mono text-link hover:underline"
                                        onClick={() =>
                                            setCard({
                                                number: t.number,
                                                expiry: `12/${String((new Date().getFullYear() + 3) % 100).padStart(2, "0")}`,
                                                cvc: "123",
                                                holder: card.holder || "Test Demo",
                                            })
                                        }
                                    >
                                        {t.number}
                                    </button>{" "}
                                    <span className="text-ink-3">— {t.outcome}</span>
                                </li>
                            ))}
                        </ul>
                    </details>

                    <Button type="submit" size="lg" fullWidth className="mt-6" isLoading={processing} leftIcon={<Lock className="h-4 w-4" />}>
                        {processing ? "Traitement…" : `Payer ${formatEuros(quote.totalCents, { decimals: true })} TTC`}
                    </Button>
                    <p className="mt-3 flex items-center justify-center gap-1.5 text-[11.5px] text-ink-4">
                        <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
                        {selection.cycle === "ANNUAL" ? "Renouvellement annuel" : "Renouvellement mensuel"}, résiliable depuis votre espace.
                    </p>
                </form>

                {props.status === "TRIALING" && (
                    <p className="text-center text-[13px] text-ink-3">
                        <Link href="/espace" className="text-link hover:underline">
                            Continuer l&apos;essai
                        </Link>
                    </p>
                )}
            </div>

            <div className="lg:sticky lg:top-20 lg:self-start">
                <QuoteSummary quote={quote} title="À payer aujourd'hui" />
            </div>

            <Modal
                isOpen={threeDsOpen}
                onClose={() => setThreeDsOpen(false)}
                title="Authentification 3-D Secure"
                description="Simulation de la validation demandée par votre banque."
                size="sm"
                closeOnOverlay={false}
            >
                <p className="text-[13.5px] text-ink-2">
                    Confirmez le paiement de <strong>{formatEuros(quote.totalCents, { decimals: true })}</strong> dans l&apos;application de votre banque.
                </p>
                <div className="mt-5 flex justify-end gap-2">
                    <Button
                        variant="ghost"
                        onClick={() => {
                            setThreeDsOpen(false);
                            keyRef.current = null;
                            setError("Authentification refusée. Aucun montant n'a été débité.");
                        }}
                    >
                        Refuser
                    </Button>
                    <Button
                        onClick={() => {
                            setThreeDsOpen(false);
                            void pay(true);
                        }}
                    >
                        Valider le paiement
                    </Button>
                </div>
            </Modal>
        </div>
    );
}
