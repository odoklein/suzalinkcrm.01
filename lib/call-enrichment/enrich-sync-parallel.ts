import { prisma } from "@/lib/prisma";
import { enrichActionFromCallProvider, enrichActionShouldUseForce } from "./enrich-action";
import { isCallEnrichmentDebug } from "./debug";

export type CallEnrichmentSyncStatus =
    | "enriched"
    | "no_match"
    | "no_phone"
    | "error"
    | "skipped";

/**
 * Nombre d’actions enrichies en parallèle (appels Allo + Prisma).
 * Réduit de 20 → 5 par défaut pour éviter les rafales de 429.
 * Surchargez avec CALL_ENRICHMENT_SYNC_CONCURRENCY si besoin (max 10 en code).
 */
export function getCallEnrichmentSyncConcurrency(): number {
    const raw = process.env.CALL_ENRICHMENT_SYNC_CONCURRENCY ?? "5";
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n) || n < 1) return 1;
    return Math.min(n, 10);
}

async function enrichOneAction(
    action: {
        id: string;
        callEnrichmentAt: Date | null;
        callSummary: string | null;
        callRecordingUrl: string | null;
    },
    logPrefix: string,
): Promise<{ actionId: string; status: CallEnrichmentSyncStatus }> {
    try {
        const force = enrichActionShouldUseForce(action);
        console.log(
            `${logPrefix} actionId=${action.id} force=${force} ` +
                `before: callEnrichmentAt=${action.callEnrichmentAt?.toISOString() ?? "null"} hasSummary=${!!action.callSummary?.trim()} hasRecording=${!!action.callRecordingUrl?.trim()} debug=${isCallEnrichmentDebug() ? "on" : "off"}`,
        );
        await enrichActionFromCallProvider(action.id, { force });
        const after = await prisma.action.findUnique({
            where: { id: action.id },
            select: {
                callEnrichmentAt: true,
                callSummary: true,
                callRecordingUrl: true,
                callEnrichmentError: true,
            },
        });

        if (after?.callEnrichmentAt) {
            console.log(
                `${logPrefix} outcome=enriched actionId=${action.id} hasSummary=${!!after.callSummary?.trim()} hasRecording=${!!after.callRecordingUrl?.trim()} error=${after.callEnrichmentError ?? "null"}`,
            );
            return { actionId: action.id, status: "enriched" };
        }
        if (after?.callEnrichmentError === "NO_MATCH") {
            return { actionId: action.id, status: "no_match" };
        }
        if (after?.callEnrichmentError === "NO_PHONE") {
            return { actionId: action.id, status: "no_phone" };
        }
        if (after?.callEnrichmentError === "NO_ALLO_NUMBERS") {
            return { actionId: action.id, status: "no_phone" };
        }
        if (after?.callEnrichmentError?.trim()) {
            console.log(
                `${logPrefix} outcome=error actionId=${action.id} callEnrichmentAt=${after?.callEnrichmentAt?.toISOString() ?? "null"} ` +
                    `callEnrichmentError=${after.callEnrichmentError} ` +
                    `(provider/network — not NO_MATCH; see [call-enrichment] outcome=PROVIDER_ERROR logs)`,
            );
            return { actionId: action.id, status: "error" };
        }
        console.log(
            `${logPrefix} outcome=skipped actionId=${action.id} callEnrichmentAt=${after?.callEnrichmentAt?.toISOString() ?? "null"} ` +
                `hasSummary=${!!after?.callSummary?.trim()} hasRecording=${!!after?.callRecordingUrl?.trim()} ` +
                `callEnrichmentError=${after?.callEnrichmentError ?? "null"} ` +
                `(no error field: usually enrichAction returned early e.g. SKIP_ALREADY_ENRICHED without DB write)`,
        );
        return { actionId: action.id, status: "skipped" };
    } catch (err) {
        console.error(`${logPrefix} actionId=${action.id}`, err);
        return { actionId: action.id, status: "error" };
    }
}

/** Pool fixe : garde l’ordre des résultats aligné sur `items`. */
async function mapPool<T, R>(items: T[], concurrency: number, fn: (item: T) => Promise<R>): Promise<R[]> {
    const results: R[] = new Array(items.length);
    let nextIndex = 0;
    async function worker() {
        for (;;) {
            const i = nextIndex++;
            if (i >= items.length) break;
            results[i] = await fn(items[i]);
        }
    }
    const workers = Math.min(Math.max(1, concurrency), items.length);
    await Promise.all(Array.from({ length: workers }, () => worker()));
    return results;
}

export async function enrichCallActionsParallel(
    actions: Array<{
        id: string;
        callEnrichmentAt: Date | null;
        callSummary: string | null;
        callRecordingUrl: string | null;
    }>,
    logPrefix = "[call-enrichment-sync]",
): Promise<Array<{ actionId: string; status: CallEnrichmentSyncStatus }>> {
    const concurrency = getCallEnrichmentSyncConcurrency();
    return mapPool(actions, concurrency, (action) => enrichOneAction(action, logPrefix));
}
