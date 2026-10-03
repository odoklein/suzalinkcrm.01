import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui";
import { SubscriptionActions } from "@/components/saas/SubscriptionActions";
import { isAdmin, quotasFor, trialDaysLeft } from "@/lib/saas/account";
import { FEATURE_LABELS, PLANS, formatEuros, formatQuota, type PlanCode } from "@/lib/saas/plans";
import { requireSaasPage } from "@/lib/saas/server-page";

export const metadata: Metadata = { title: "Abonnement" };

const STATUS_LABEL: Record<string, string> = {
    TRIALING: "Essai gratuit",
    ACTIVE: "Actif",
    PENDING_PAYMENT: "Paiement en attente",
    TRIAL_EXPIRED: "Essai terminé",
    CANCELED: "Résilié",
};

export default async function SubscriptionPage() {
    const { member, account } = await requireSaasPage("/espace/abonnement");
    if (!isAdmin(member.role)) redirect("/espace");

    const plan = PLANS[account.planCode as PlanCode];
    const quotas = quotasFor(account);
    const payments = await prisma.saasPayment.findMany({ where: { accountId: account.id }, orderBy: { createdAt: "desc" }, take: 50 });
    const days = trialDaysLeft(account);
    const monthly = account.billingCycle === "ANNUAL" ? plan.annualMonthlyPriceCents : plan.monthlyPriceCents;
    const seatCost = (plan.extraSeatCents ?? 0) * account.extraSeats;

    return (
        <div className="space-y-8">
            <h1 className="text-2xl font-semibold text-ink">Abonnement</h1>

            <section className="grid gap-5 rounded-2xl border border-line bg-surface p-5 shadow-xs sm:p-6 lg:grid-cols-[1fr_auto]">
                <div>
                    <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-semibold text-ink">Offre {plan.name}</h2>
                        <Badge variant={account.status === "ACTIVE" ? "success" : account.status === "TRIALING" ? "info" : "warning"} dot>
                            {STATUS_LABEL[account.status]}
                        </Badge>
                        {account.canceledAt && account.status === "ACTIVE" && <Badge variant="danger">Résiliation programmée</Badge>}
                    </div>
                    <p className="mt-1 text-[14px] text-ink-3">
                        {formatEuros(monthly + seatCost)} HT / mois · {account.billingCycle === "ANNUAL" ? "facturation annuelle" : "facturation mensuelle"}
                        {account.extraSeats > 0 && ` · dont ${account.extraSeats} siège(s) supplémentaire(s)`}
                    </p>
                    <p className="mt-1 text-[13px] text-ink-3">
                        {account.status === "TRIALING" && days !== null && `Essai gratuit : ${days} jour(s) restant(s), jusqu'au ${account.trialEndsAt?.toLocaleDateString("fr-FR")}.`}
                        {account.status === "ACTIVE" &&
                            account.currentPeriodEnd &&
                            (account.canceledAt
                                ? `Accès jusqu'au ${account.currentPeriodEnd.toLocaleDateString("fr-FR")}.`
                                : `Prochain renouvellement le ${account.currentPeriodEnd.toLocaleDateString("fr-FR")}.`)}
                    </p>

                    <dl className="mt-5 grid gap-x-6 gap-y-2 text-[13px] sm:grid-cols-2">
                        {(
                            [
                                ["Sièges", formatQuota(quotas.seats)],
                                ["Workspaces", formatQuota(quotas.workspaces)],
                                ["Contacts", formatQuota(quotas.contacts)],
                                ["Lignes Allo / OnOff", formatQuota(quotas.phoneLines)],
                                ["Call Vault", formatQuota(quotas.callVaultHours, "h / mois")],
                                ["Fiches de RDV IA", `${formatQuota(quotas.aiFichesPerMonth)} / mois`],
                                ["Stockage", `${quotas.storageGb} Go`],
                                ["Support", plan.supportLabel],
                            ] as const
                        ).map(([k, v]) => (
                            <div key={k} className="flex justify-between gap-4 border-b border-line-subtle py-1.5">
                                <dt className="text-ink-3">{k}</dt>
                                <dd className="text-right text-ink">{v}</dd>
                            </div>
                        ))}
                    </dl>
                    <p className="mt-4 text-xs text-ink-3">Inclus : {plan.features.map((f) => FEATURE_LABELS[f]).join(" · ")}</p>
                </div>
                <div className="flex flex-col gap-2 lg:items-end">
                    <Link href="/espace/paiement" className="inline-flex h-10 items-center justify-center rounded-control bg-primary px-4 text-sm font-semibold text-primary-fg shadow-primary hover:bg-primary-hover">
                        {account.status === "ACTIVE" ? "Changer d'offre ou de sièges" : "Activer l'abonnement"}
                    </Link>
                    {account.status === "ACTIVE" && <SubscriptionActions canceled={Boolean(account.canceledAt)} periodEnd={account.currentPeriodEnd?.toISOString() ?? null} />}
                </div>
            </section>

            <section aria-labelledby="payments-title">
                <h2 id="payments-title" className="mb-3 text-[15px] font-semibold text-ink">
                    Paiements & factures
                </h2>
                {payments.length === 0 ? (
                    <p className="rounded-2xl border border-dashed border-line-strong p-6 text-center text-[13px] text-ink-3">Aucun paiement pour l&apos;instant.</p>
                ) : (
                    <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
                        <table className="w-full min-w-[600px] text-left text-[13px]">
                            <thead className="bg-surface-2 text-xs text-ink-3">
                                <tr>
                                    <th scope="col" className="px-4 py-2.5 font-medium">Date</th>
                                    <th scope="col" className="px-4 py-2.5 font-medium">Facture</th>
                                    <th scope="col" className="px-4 py-2.5 font-medium">Détail</th>
                                    <th scope="col" className="px-4 py-2.5 font-medium">Carte</th>
                                    <th scope="col" className="px-4 py-2.5 text-right font-medium">Montant TTC</th>
                                    <th scope="col" className="px-4 py-2.5 font-medium">Statut</th>
                                </tr>
                            </thead>
                            <tbody>
                                {payments.map((p) => (
                                    <tr key={p.id} className="border-t border-line-subtle">
                                        <td className="px-4 py-2.5 text-ink-2">{p.createdAt.toLocaleDateString("fr-FR")}</td>
                                        <td className="px-4 py-2.5 font-mono text-[12px] text-ink-2">{p.invoiceNumber ?? "—"}</td>
                                        <td className="px-4 py-2.5 text-ink-2">
                                            {PLANS[p.planCode as PlanCode].name} · {p.billingCycle === "ANNUAL" ? "annuel" : "mensuel"}
                                            {p.includesSetup && " + mise en place"}
                                        </td>
                                        <td className="px-4 py-2.5 text-ink-3">
                                            {p.cardBrand} •••• {p.cardLast4}
                                        </td>
                                        <td className="px-4 py-2.5 text-right tabular-nums text-ink">{formatEuros(p.totalCents, { decimals: true })}</td>
                                        <td className="px-4 py-2.5">
                                            {p.status === "SUCCEEDED" ? (
                                                <Badge size="sm" variant="success">
                                                    Payé
                                                </Badge>
                                            ) : (
                                                <Badge size="sm" variant="danger" title={p.failureMessage ?? undefined}>
                                                    Refusé
                                                </Badge>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                <p className="mt-2 text-xs text-ink-4">Paiements simulés (environnement de démonstration).</p>
            </section>
        </div>
    );
}
