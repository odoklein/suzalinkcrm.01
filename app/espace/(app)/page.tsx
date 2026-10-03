import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Callout } from "@/components/ui";
import { ChecklistCard, TipsList } from "@/components/saas/AdoptionPanel";
import { UsageMeters } from "@/components/saas/UsageMeters";
import { getAccountUsage, hasProductAccess, isAdmin, quotasFor, trialDaysLeft } from "@/lib/saas/account";
import { adoptionTips } from "@/lib/saas/adoption";
import { stepsForPlan, summarizeProgress, type OnboardingStepKey } from "@/lib/saas/onboarding-steps";
import { PLANS, TRIAL_AI_FICHE_CAP, TRIAL_CONTACT_CAP, type PlanCode } from "@/lib/saas/plans";
import { requireSaasPage } from "@/lib/saas/server-page";

export const metadata: Metadata = { title: "Mon espace" };

const EVENT_LABELS: Record<string, string> = {
    "account.created": "Espace créé",
    "payment.succeeded": "Paiement confirmé",
    "payment.failed": "Paiement refusé",
    "trial.expired": "Fin de l'essai",
    "subscription.canceled": "Abonnement résilié",
    "subscription.resumed": "Résiliation annulée",
    "onboarding.step_completed": "Étape terminée",
    "onboarding.step_skipped": "Étape reportée",
    "member.joined": "Nouveau membre",
    "phone_line.verified": "Ligne connectée",
    "api_key.created": "Clé d'API créée",
    "white_label.dns_verified": "Domaine vérifié",
};

export default async function EspaceHome() {
    const { member, account } = await requireSaasPage("/espace");
    const plan = PLANS[account.planCode as PlanCode];
    const admin = isAdmin(member.role);
    const access = hasProductAccess(account);

    const [usage, rows, verifiedLines, pendingInvites, events] = await Promise.all([
        getAccountUsage(account.id),
        prisma.saasOnboardingStep.findMany({ where: { accountId: account.id }, select: { stepKey: true, status: true } }),
        prisma.saasPhoneLine.count({ where: { accountId: account.id, verifiedAt: { not: null } } }),
        prisma.saasMember.count({ where: { accountId: account.id, status: "INVITED" } }),
        prisma.saasAccountEvent.findMany({
            where: { accountId: account.id, type: { in: Object.keys(EVENT_LABELS) } },
            orderBy: { createdAt: "desc" },
            take: 8,
        }),
    ]);

    const quotas = quotasFor(account);
    const steps = stepsForPlan(account.planCode as PlanCode);
    const statusOf = new Map(rows.map((r) => [r.stepKey, r.status]));
    const summary = summarizeProgress(
        account.planCode as PlanCode,
        rows.map((r) => ({ key: r.stepKey as OnboardingStepKey, status: r.status }))
    );
    const prefs = (member.preferences ?? {}) as { dismissedTips?: string[]; checklistCollapsed?: boolean };
    const days = trialDaysLeft(account);
    const trialing = account.status === "TRIALING";

    const tips = adoptionTips({
        plan: account.planCode as PlanCode,
        status: account.status,
        isAdmin: admin,
        trialDaysLeft: days,
        usage,
        quotas,
        verifiedLines,
        pendingInvites,
        onboardingDone: Boolean(account.onboardingCompletedAt),
        skippedSteps: rows.filter((r) => r.status === "SKIPPED").map((r) => r.stepKey),
        dismissed: prefs.dismissedTips ?? [],
    });

    return (
        <div className="space-y-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold text-ink">Bonjour {member.name.split(" ")[0]}</h1>
                    <p className="mt-1 text-[14px] text-ink-3">
                        {account.name} · offre {plan.name}
                        {account.status === "ACTIVE" && account.currentPeriodEnd && (
                            <>
                                {" "}
                                · {account.canceledAt ? "se termine" : "renouvellement"} le {account.currentPeriodEnd.toLocaleDateString("fr-FR")}
                            </>
                        )}
                    </p>
                </div>
                {access && !account.onboardingCompletedAt && summary.nextStep && (
                    <Link
                        href={`/espace/onboarding?step=${summary.nextStep}`}
                        className="inline-flex h-10 items-center gap-2 rounded-control bg-primary px-4 text-sm font-semibold text-primary-fg shadow-primary hover:bg-primary-hover"
                    >
                        {summary.done === 0 ? "Commencer la configuration" : "Reprendre la configuration"} <ArrowRight className="h-4 w-4" />
                    </Link>
                )}
            </div>

            {account.status === "PENDING_PAYMENT" && (
                <Callout tone="warning" title="Paiement en attente" action={admin ? <Link href="/espace/paiement" className="font-semibold underline">Finaliser</Link> : undefined}>
                    Votre espace {plan.name} sera provisionné dès la confirmation du paiement.
                </Callout>
            )}
            {account.status === "TRIAL_EXPIRED" && (
                <Callout tone="danger" title="Votre essai est terminé" action={admin ? <Link href="/espace/paiement" className="font-semibold underline">Activer l&apos;abonnement</Link> : undefined}>
                    Votre configuration et vos contacts sont conservés. {admin ? "Activez l'abonnement pour reprendre." : "Contactez l'administrateur de votre espace."}
                </Callout>
            )}
            {account.status === "CANCELED" && (
                <Callout tone="danger" title="Abonnement terminé" action={admin ? <Link href="/espace/paiement" className="font-semibold underline">Réactiver</Link> : undefined}>
                    Votre configuration est conservée.
                </Callout>
            )}

            {access && member.role !== "CLIENT_VIEWER" && (
                <ChecklistCard
                    items={steps.map((s) => ({
                        key: s.key,
                        title: s.title,
                        done: statusOf.get(s.key) === "COMPLETED",
                        skipped: statusOf.get(s.key) === "SKIPPED",
                    }))}
                    percent={summary.percent}
                    nextKey={summary.nextStep}
                    initiallyCollapsed={Boolean(prefs.checklistCollapsed)}
                />
            )}

            <section aria-labelledby="usage-title">
                <h2 id="usage-title" className="mb-3 text-[15px] font-semibold text-ink">
                    Utilisation
                </h2>
                <UsageMeters
                    meters={[
                        { label: "Sièges", used: usage.seats, limit: quotas.seats, note: pendingInvites > 0 ? `dont ${pendingInvites} invitation(s) en attente` : undefined },
                        { label: "Contacts", used: usage.contacts, limit: quotas.contacts, note: trialing ? `Limité à ${TRIAL_CONTACT_CAP.toLocaleString("fr-FR")} pendant l'essai` : undefined },
                        { label: "Lignes Allo / OnOff", used: usage.phoneLines, limit: quotas.phoneLines, note: `${verifiedLines} vérifiée(s)` },
                        { label: "Workspaces", used: usage.workspaces, limit: quotas.workspaces },
                        { label: "Fiches de RDV IA ce mois", used: 0, limit: quotas.aiFichesPerMonth, note: trialing ? `Limité à ${TRIAL_AI_FICHE_CAP} pendant l'essai` : undefined },
                        { label: "Call Vault ce mois", used: 0, limit: quotas.callVaultHours, unit: "h" },
                    ]}
                />
            </section>

            <TipsList tips={tips} />

            {events.length > 0 && (
                <section aria-labelledby="activity-title">
                    <h2 id="activity-title" className="mb-3 text-[15px] font-semibold text-ink">
                        Activité récente
                    </h2>
                    <ul className="divide-y divide-line-subtle rounded-2xl border border-line bg-surface">
                        {events.map((e) => {
                            const d = (e.details ?? {}) as { step?: string };
                            const stepTitle = d.step ? steps.find((s) => s.key === d.step)?.title : null;
                            return (
                                <li key={e.id} className="flex items-center justify-between gap-4 px-4 py-2.5 text-[13px]">
                                    <span className="text-ink-2">
                                        {EVENT_LABELS[e.type]}
                                        {stepTitle && <span className="text-ink-3"> · {stepTitle}</span>}
                                    </span>
                                    <time className="shrink-0 text-xs text-ink-4" dateTime={e.createdAt.toISOString()}>
                                        {e.createdAt.toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                                    </time>
                                </li>
                            );
                        })}
                    </ul>
                </section>
            )}
        </div>
    );
}
