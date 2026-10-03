// ============================================
// CONTACT IMPORT — pure helpers for the import step: guess which CSV column is
// which field, then count reachable contacts and duplicates in the browser.
// Only counts, the mapping and a 5-row sample are sent to the server.
// ============================================

export const CONTACT_FIELDS = [
    { key: "ignore", label: "— Ignorer —" },
    { key: "firstName", label: "Prénom" },
    { key: "lastName", label: "Nom" },
    { key: "fullName", label: "Nom complet" },
    { key: "company", label: "Entreprise" },
    { key: "title", label: "Poste" },
    { key: "phone", label: "Téléphone" },
    { key: "email", label: "Email" },
    { key: "website", label: "Site web" },
    { key: "city", label: "Ville" },
] as const;

const HEADER_HINTS: [RegExp, string][] = [
    [/^(pr[ée]nom|first ?name|firstname)$/i, "firstName"],
    [/^(nom|last ?name|lastname|surname)$/i, "lastName"],
    [/^(nom complet|full ?name|name|contact)$/i, "fullName"],
    [/(soci[ée]t[ée]|entreprise|company|organisation|organization|raison sociale)/i, "company"],
    [/(poste|fonction|title|job)/i, "title"],
    [/(t[ée]l|phone|mobile|portable|num[ée]ro)/i, "phone"],
    [/(e-?mail|courriel)/i, "email"],
    [/(site|website|url|domaine)/i, "website"],
    [/(ville|city)/i, "city"],
];

export function guessMapping(headers: string[]): Record<string, string> {
    const used = new Set<string>();
    const mapping: Record<string, string> = {};
    for (const h of headers) {
        const hit = HEADER_HINTS.find(([re, field]) => re.test(h.trim()) && !used.has(field));
        mapping[h] = hit ? hit[1] : "ignore";
        if (hit) used.add(hit[1]);
    }
    return mapping;
}

export interface ImportAnalysis {
    rowCount: number;
    validCount: number;
    duplicateCount: number;
    sample: Record<string, string>[];
}

/** Valid = reachable (phone or email) and identifiable (a name or a company). Duplicates by phone/email. */
export function analyzeRows(rows: Record<string, string>[], mapping: Record<string, string>): ImportAnalysis {
    const colFor = (field: string) => Object.keys(mapping).filter((h) => mapping[h] === field);
    const get = (row: Record<string, string>, field: string) =>
        colFor(field)
            .map((h) => (row[h] ?? "").trim())
            .find(Boolean) ?? "";
    const seen = new Set<string>();
    let valid = 0;
    let dupes = 0;
    const sample: Record<string, string>[] = [];
    for (const row of rows) {
        const phone = get(row, "phone").replace(/[^\d+]/g, "");
        const email = get(row, "email").toLowerCase();
        const name = get(row, "fullName") || `${get(row, "firstName")} ${get(row, "lastName")}`.trim();
        const company = get(row, "company");
        if (!(phone.length >= 6 || email.includes("@")) || !(name || company)) continue;
        const key = phone.length >= 6 ? `p:${phone.slice(-9)}` : `e:${email}`;
        if (seen.has(key)) {
            dupes++;
            continue;
        }
        seen.add(key);
        valid++;
        if (sample.length < 5) sample.push({ name, company, phone: get(row, "phone"), email, title: get(row, "title") });
    }
    return { rowCount: rows.length, validCount: valid, duplicateCount: dupes, sample };
}
