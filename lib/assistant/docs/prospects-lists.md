---
routes: ["/manager/lists", "/manager/enricher", "/manager/prospects", "/manager/prospects/review", "/manager/prospects/rules", "/manager/prospects/sources", "/sdr/lists"]
roles: ["MANAGER", "SDR", "BOOKER", "BUSINESS_DEVELOPER"]
keywords: ["list", "liste", "contact", "import", "CSV", "upload", "prospect", "enrich", "enrichment", "enrichir", "téléphone", "phone", "company", "société", "duplicate", "doublon", "mapping", "colonnes", "columns", "source", "qualification", "score", "approve", "reject", "approuver", "rejeter", "review", "révision", "règle", "rule"]
priority: 9
---

# Prospect Lists & Contact Management

## List Types

| Type | Meaning | When to use |
|------|---------|------------|
| **SUZALI** | Contacts sourced externally / by the agency | When the prospecting team provides the list |
| **CLIENT** | Contacts sourced by the client | When the client provides their own contacts |
| **MIXED** | Mix of both sources | When list combines both origins |

---

## Create a New Prospect List

1. Go to `/manager/lists` → click **"+"** (top right)
2. Fill the form:
   - **Nom** — descriptive name (e.g. "SaaS Paris — Q2 2025")
   - **Type** — SUZALI / CLIENT / MIXED
   - **Mission** — assign to an active mission (required)
3. Click **Créer la liste**
4. The empty list appears → now import contacts into it

---

## Import Contacts via CSV

1. Open a list at `/manager/lists/[id]`
2. Click **Importer** or the **Upload CSV** button
3. Drag & drop your CSV file or click to browse
4. **Map columns**: match your CSV headers to CRM fields:
   - Prénom (First name) ← column
   - Nom (Last name) ← column
   - Société / Company ← column
   - Email ← column
   - Téléphone / Phone ← column
   - Titre / Title ← column
5. Review the **preview** of first 5 rows to verify mapping
6. Check **Détecter les doublons** (Detect duplicates) — recommended
7. Click **Importer** → contacts appear in the list with status **Incomplet**

### CSV Format Tips
- Use UTF-8 encoding to preserve accented characters (é, à, ü)
- Phone numbers: include country code (+33 for France)
- LinkedIn URLs: full URL preferred (https://linkedin.com/in/...)
- One row per contact — one contact can belong to multiple companies

---

## Contact Statuses

| Status | Meaning |
|--------|---------|
| **Incomplet** (Incomplete) | Missing key data (no phone or email) |
| **Partiel** (Partial) | Has some contact data but not all |
| **Complet** (Actionable) | Has all required fields — ready to contact |

SDRs see only **Complet** contacts in their calling queue. Always enrich/complete contacts first.

---

## Phone Enrichment (`/manager/enricher`)

Use the enrichment tool to find phone numbers from company name/website:

1. Go to `/manager/enricher`
2. Upload CSV or paste data
3. Map columns: **Société** (company name), **Site web** (website URL), **Adresse** (optional)
4. Click **Démarrer l'enrichissement**
5. Progress bar runs — each row is looked up via SerpAPI / Apollo / Explorium
6. Results show: original row + **found phone**, confidence score, source
7. Expand a row to see detailed logs (found via Google Maps, Apollo, etc.)
8. Click **Télécharger les résultats** → CSV with enriched phones
9. Import this enriched CSV back into the list

### Enrichment quality:
- **High confidence** (>0.8): Phone very likely correct
- **Medium confidence** (0.5–0.8): Verify before calling
- **Low confidence** (<0.5): May be wrong number — treat carefully

---

## Managing Contacts in a List

At `/manager/lists/[id]` or `/sdr/lists/[id]`:

- **Search** by name or company
- **Filter by status**: Actionable / Partial / Incomplete
- **Sort** by various columns
- **Click a contact row** → opens **ContactDrawer** with:
  - Full profile (name, title, email, phone, LinkedIn)
  - Company details
  - Action history (all past calls/emails)
  - Quick action buttons (call, email, add note)

### Edit a Contact
1. Open ContactDrawer
2. Click **Modifier**
3. Update fields → **Sauvegarder**

### Delete a Contact
1. Open ContactDrawer → click **Supprimer**
2. Confirm → contact removed from this list
3. Note: their action history is preserved

---

## Prospect Pipeline (AI-Scored Prospects)

The prospect pipeline is a separate workflow for **auto-scored inbound leads** (from web forms, API feeds, or CSV uploads via Prospect Sources).

### Review Queue (`/manager/prospects/review`)
1. Go to `/manager/prospects` → click **Révision** tab
2. Each card shows: name, email, company, quality score, confidence, reason for review
3. Click **Approuver** → prospect moves to APPROVED, can be assigned to a mission
4. Click **Rejeter** → prospect moves to REJECTED, stays in history

### Prospect Statuses
| Status | Meaning |
|--------|---------|
| PENDING | Newly received, not yet reviewed |
| IN_REVIEW | Flagged for human review |
| APPROVED | Passed qualification, ready to use |
| REJECTED | Did not pass qualification |
| ACTIVATED | Assigned and active in a mission |
| DUPLICATE | Detected as duplicate of existing contact |

---

## Prospect Qualification Rules (`/manager/prospects/rules`)

Rules define automatic scoring and routing:

1. Go to `/manager/prospects/rules` → click **"+"**
2. Define conditions: company size, industry, email domain, keywords in notes, etc.
3. Set action: auto-approve, auto-reject, or flag for review
4. Set priority (rules evaluated in order)
5. **Enable** the rule → it applies to all new prospects

### Test Rules
Use the **Sandbox** at `/manager/prospects/sandbox`:
1. Paste a sample prospect record (JSON or form)
2. Click **Tester** → see which rules fire and what decision is made
3. Adjust rules until behavior is correct

---

## Prospect Sources (`/manager/prospects/sources`)

Sources define where prospects come from:
- **WEB_FORM** — website contact form
- **CSV_IMPORT** — manual CSV upload
- **API** — automated feed from external system
- **PARTNER_FEED** — partner data push
- **MANUAL_ENTRY** — typed in manually

### Add a Source
1. Go to `/manager/prospects/sources` → click **"+"**
2. Set name, type, and configuration (webhook URL, API key, form mapping)
3. Click **Tester** to verify the connection
4. **Activer** the source

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Contacts not appearing in SDR's queue | Check contact status is "Actionable" (Complet) — incomplete contacts are hidden from call queue |
| CSV import fails | Verify UTF-8 encoding, check for merged cells, ensure required columns (name, company) are present |
| Duplicate contacts after import | Enable duplicate detection on import — or manually merge from ContactDrawer |
| Enrichment returns no phones | Company too small for data sources, or website URL is incorrect — try enriching with fuller company name |
| Prospect stuck in PENDING | Check rules at `/manager/prospects/rules` — may be no rule matching this prospect's profile |
