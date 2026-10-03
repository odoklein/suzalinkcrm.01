// ============================================
// COMPANY NAME MATCHING (Leexi <-> CRM)
// Normalized comparison with fuzzy tolerance
// ============================================

/**
 * Normalize a company name for comparison:
 * lowercase, remove common suffixes (SAS, SARL, SA, SRL, Inc, Ltd, etc.),
 * trim whitespace, collapse multiple spaces.
 */
function normalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(sas|sarl|sa|srl|inc\.?|ltd\.?|llc|gmbh|ag|corp\.?|co\.?)\b/gi, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Check if two company names match after normalization.
 * Uses exact match on normalized form, plus substring containment for partial matches.
 */
export function companiesMatch(crmName: string, leexiName: string): boolean {
  if (!crmName || !leexiName) return false;
  const a = normalize(crmName);
  const b = normalize(leexiName);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;
  return false;
}

export interface MatchedRecap<T> {
  clientId: string;
  clientName: string;
  recaps: T[];
}

/**
 * Match an array of recaps (each having a companyName) to CRM clients.
 * Returns only clients that have at least one matched recap.
 */
export function matchRecapsToClients<T extends { companyName: string }>(
  clients: { id: string; name: string }[],
  recaps: T[],
): MatchedRecap<T>[] {
  const results: MatchedRecap<T>[] = [];

  for (const client of clients) {
    const matched = recaps.filter((r) => companiesMatch(client.name, r.companyName));
    if (matched.length > 0) {
      results.push({
        clientId: client.id,
        clientName: client.name,
        recaps: matched,
      });
    }
  }

  return results;
}
