import { promises as dns } from "dns";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { SaasApiError, logAccountEvent, ok, requireSaasMember, saasHandler } from "@/lib/saas/account";
import { planHasFeature, type PlanCode } from "@/lib/saas/plans";

export const dynamic = "force-dynamic";

/** Where customers point their CNAME. */
const CNAME_TARGET = process.env.SAAS_CNAME_TARGET || "edge.captainprospect.app";

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
    return Promise.race([p, new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms))]);
}

export const POST = saasHandler(async () => {
    const { account, member } = await requireSaasMember({ admin: true, productAccess: true });
    if (!planHasFeature(account.planCode as PlanCode, "whiteLabel")) {
        throw new SaasApiError("La marque blanche est incluse dans l'offre Medium Business.", 403);
    }
    const wl = (account.whiteLabel ?? {}) as Record<string, unknown>;
    const domain = typeof wl.customDomain === "string" ? wl.customDomain : null;
    if (!domain) throw new SaasApiError("Enregistrez d'abord votre domaine.");

    let records: string[] = [];
    let error: string | null = null;
    try {
        records = await withTimeout(dns.resolveCname(domain), 4_000);
    } catch (err) {
        const code = (err as NodeJS.ErrnoException).code;
        error =
            code === "ENODATA" || code === "ENOTFOUND"
                ? "Aucun enregistrement CNAME trouvé pour l'instant."
                : "Le DNS n'a pas répondu, réessayez dans quelques minutes.";
    }

    const verified = records.some((r) => r.replace(/\.$/, "").toLowerCase() === CNAME_TARGET);
    if (verified && !wl.dnsVerifiedAt) {
        await prisma.saasAccount.update({
            where: { id: account.id },
            data: { whiteLabel: { ...wl, dnsVerifiedAt: new Date().toISOString() } as Prisma.InputJsonValue },
        });
        await logAccountEvent(account.id, member.id, "white_label.dns_verified", { domain });
    }
    return ok({
        domain,
        target: CNAME_TARGET,
        verified,
        found: records,
        message: verified ? "Domaine vérifié." : (error ?? `Le CNAME pointe vers ${records.join(", ")} au lieu de ${CNAME_TARGET}.`),
    });
});
