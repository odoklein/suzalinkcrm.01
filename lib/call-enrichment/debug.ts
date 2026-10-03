/**
 * Set CALL_ENRICHMENT_DEBUG=1 (or true) for per-call / per-page traces on the server.
 * Outcome lines (outcome=…) always print so you can see why a sync did nothing without extra env.
 */
export function isCallEnrichmentDebug(): boolean {
  const v = process.env.CALL_ENRICHMENT_DEBUG?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export function ceDebug(...args: unknown[]): void {
  if (isCallEnrichmentDebug()) {
    console.log("[call-enrichment:debug]", ...args);
  }
}
