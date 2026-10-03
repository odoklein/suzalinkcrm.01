import { ok, requireSaasMember, saasHandler } from "@/lib/saas/account";
import { loadOnboardingState } from "@/lib/saas/onboarding-service";

export const dynamic = "force-dynamic";

export const GET = saasHandler(async () => {
    const ctx = await requireSaasMember({ productAccess: true });
    return ok(await loadOnboardingState(ctx));
});
