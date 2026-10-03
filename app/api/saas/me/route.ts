import { getAccountUsage, ok, quotasFor, requireSaasMember, saasHandler, trialDaysLeft } from "@/lib/saas/account";
import { PLANS, type PlanCode } from "@/lib/saas/plans";

export const dynamic = "force-dynamic";

export const GET = saasHandler(async () => {
    const { member, account } = await requireSaasMember();
    const usage = await getAccountUsage(account.id);
    return ok({
        member: {
            id: member.id,
            name: member.name,
            email: member.email,
            role: member.role,
            preferences: member.preferences,
        },
        account: {
            id: account.id,
            name: account.name,
            slug: account.slug,
            planCode: account.planCode,
            planName: PLANS[account.planCode as PlanCode].name,
            billingCycle: account.billingCycle,
            status: account.status,
            extraSeats: account.extraSeats,
            trialEndsAt: account.trialEndsAt,
            trialDaysLeft: trialDaysLeft(account),
            currentPeriodEnd: account.currentPeriodEnd,
            canceledAt: account.canceledAt,
            onboardingCompletedAt: account.onboardingCompletedAt,
            setupServiceRequested: account.setupServiceRequested,
        },
        usage,
        quotas: quotasFor(account),
    });
});
