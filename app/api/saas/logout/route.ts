import { clearSaasSession } from "@/lib/saas/session";
import { ok, saasHandler } from "@/lib/saas/account";

export const POST = saasHandler(async () => {
    await clearSaasSession();
    return ok({ next: "/espace/connexion" });
});
