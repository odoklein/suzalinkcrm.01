import { Suspense } from "react";
import type { Metadata } from "next";
import { OnboardingWizard } from "@/components/saas/onboarding/OnboardingWizard";
import type { OnboardingState } from "@/components/saas/onboarding/types";
import { isAdmin } from "@/lib/saas/account";
import { loadOnboardingState } from "@/lib/saas/onboarding-service";
import { PLANS, type PlanCode } from "@/lib/saas/plans";
import { requireSaasPage, toPlain } from "@/lib/saas/server-page";

export const metadata: Metadata = { title: "Onboarding" };

export default async function OnboardingPage() {
    const ctx = await requireSaasPage("/espace/onboarding", { productAccess: true });
    const state = toPlain(await loadOnboardingState(ctx)) as unknown as OnboardingState;
    const { member, account } = ctx;

    return (
        <Suspense>
            <OnboardingWizard
                initialState={state}
                account={{
                    name: account.name,
                    planCode: account.planCode,
                    planName: PLANS[account.planCode as PlanCode].name,
                    status: account.status,
                    memberName: member.name,
                    memberEmail: member.email,
                    isAdmin: isAdmin(member.role),
                }}
            />
        </Suspense>
    );
}
