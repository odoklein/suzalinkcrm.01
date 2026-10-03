import type { ReactNode } from "react";
import { AccountHeader } from "@/components/saas/AccountHeader";
import { isAdmin, trialDaysLeft } from "@/lib/saas/account";
import { PLANS, type PlanCode } from "@/lib/saas/plans";
import { requireSaasPage } from "@/lib/saas/server-page";

export const dynamic = "force-dynamic";

export default async function EspaceLayout({ children }: { children: ReactNode }) {
    // Each page re-checks with its own path (for the post-login redirect); this guards the shell.
    const { member, account } = await requireSaasPage("/espace");

    return (
        <div className="min-h-screen bg-canvas text-ink">
            <AccountHeader
                accountName={account.name}
                planName={PLANS[account.planCode as PlanCode].name}
                memberName={member.name}
                status={account.status}
                trialDaysLeft={trialDaysLeft(account)}
                onboardingDone={Boolean(account.onboardingCompletedAt)}
                isAdmin={isAdmin(member.role)}
            />
            <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
        </div>
    );
}
