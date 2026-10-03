import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { CheckoutFlow } from "@/components/saas/CheckoutFlow";
import { getAccountUsage, isAdmin } from "@/lib/saas/account";
import { requireSaasPage } from "@/lib/saas/server-page";
import type { BillingCycle, PlanCode } from "@/lib/saas/plans";

export const metadata: Metadata = { title: "Paiement" };

export default async function PaymentPage() {
    const { member, account } = await requireSaasPage("/espace/paiement");
    if (!isAdmin(member.role)) redirect("/espace");

    const [usage, paidSetup] = await Promise.all([
        getAccountUsage(account.id),
        prisma.saasPayment.count({ where: { accountId: account.id, status: "SUCCEEDED", includesSetup: true } }),
    ]);

    return (
        <CheckoutFlow
            status={account.status}
            initial={{
                plan: account.planCode as PlanCode,
                cycle: account.billingCycle as BillingCycle,
                extraSeats: account.extraSeats,
                includeSetup: account.setupServiceRequested,
            }}
            hasPaidSetup={paidSetup > 0}
            usage={usage}
            onboardingDone={Boolean(account.onboardingCompletedAt)}
            currentPeriodEnd={account.currentPeriodEnd?.toISOString() ?? null}
        />
    );
}
