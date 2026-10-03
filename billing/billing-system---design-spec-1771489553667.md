
# Billing System — Design Spec

## Problem
Captain Prospect manages client billing manually via spreadsheets. Need a billing module inside Réglages that handles pricing templates, client engagements, and auto-generated invoices based on RDV counts.

## Domain Model

| Entity | Role | Key Fields |
|--------|------|------------|
| **Offre/Tarif** | Pricing template | Nom, fixe_mensuel (€), prix_par_rdv (€), description, statut (Actif/Archivé) |
| **Engagement** | Client-level contract | Client, offre (template), fixe_override, rdv_override, durée (mois), début, fin, statut |
| **Mission** | Sales campaign under client | Produces RDVs — RDV count rolls up to client engagement |
| **Facture** | Monthly invoice | Période, montant_fixe, nb_rdv, montant_variable, total, statut |

### Key Relationships
- **Client → 1 Engagement** (active at a time) → references 1 Offre template (with optional overrides)
- **Client → N Missions** → each produces RDVs
- **Engagement → N Factures** (one per month while active)
- Pricing is CLIENT-level (same rates across all missions)

## Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Pricing flexibility | Templates + per-client override | Managers pick a template, then adjust rates for negotiated deals |
| Engagement scope | Client-level, not per-mission | Same pricing across all missions simplifies billing |
| Invoice generation | Auto-draft at month-end + manual option | Reduces admin work, but managers can generate ad-hoc |
| Zero-RDV months | Always invoice fixed fee | Engagement guarantees fixed revenue |
| Renewal | Manual, can update pricing | No auto-renew; rates can change on renewal |
| Early termination | Has penalties | Note: penalty rules TBD — include penalty field on engagement |
| Offer combinations | Any combo of fixed + per-RDV (including zero) | Flexible: some clients may be fixed-only or RDV-only |

## Engagement Lifecycle
`Brouillon → Actif → Expiré → Renouvelé/Archivé`
- **Brouillon**: Offre assigned, overrides set, not yet billing
- **Actif**: Monthly invoices auto-generate (fixed + RDV count × rate)
- **Expiré**: Engagement ended, manager notified — must manually renew or archive
- **Résilié**: Early termination with penalty → Archive
- **Renouvelé → Actif**: New term starts, pricing can change

## Invoice Lifecycle
`Brouillon → Validée → Envoyée → Payée`
- Strict progression, no skipping (matches existing CRM constraint)
- Auto-generated as Brouillon — manager reviews before validating

## Screens to Build (4)

### 1. Offres & Tarifs — List + CRUD
- **Location**: Réglages section
- **View**: Table listing all pricing templates
- **Columns**: Nom, Fixe mensuel (€), Prix/RDV (€), Clients actifs (count), Statut
- **Actions**: Créer offre (modal or drawer), Modifier, Archiver
- **States**: Empty state (no offers yet), active list, archived toggle

### 2. Engagement Client — Create/Manage
- **Location**: Accessible from Client management or Client detail page
- **Form fields**: Client (select), Offre (select → pre-fills rates), Fixe override, RDV override, Durée (3/6/custom mois), Date début, Pénalité résiliation
- **Key UX**: When offre selected, show template rates with editable override fields. Show "original: 600€ → custom: 550€" pattern
- **Actions**: Activer, Renouveler (new term + rate update), Résilier
- **States**: Draft form, active engagement summary, expired with renewal CTA

### 3. Factures — List View
- **Location**: Réglages > Facturation
- **View**: Table of all invoices across clients
- **Columns**: N° facture, Client, Période, Montant fixe, RDVs, Montant variable, Total, Statut
- **Filters**: Client, Statut (Brouillon/Validée/Envoyée/Payée), Période (mois)
- **Actions**: Générer facture (manual trigger), bulk validate, bulk export
- **Auto-generation**: Badge/indicator showing auto-generated vs manual

### 4. Facture Detail — Breakdown + Edit
- **Location**: Click-through from Factures list
- **Layout**: Invoice header (client info, period, dates) + line items table
- **Line items**: 
  - Ligne 1: Forfait mensuel — [montant fixe]
  - Ligne 2: RDV (N missions) — [nb] × [prix] = [total variable]
  - Optional: Pénalité résiliation (if applicable)
- **Per-mission RDV breakdown**: Expandable section showing RDV count per mission
- **Edit**: In Brouillon status, manager can adjust lines before validating
- **Status actions**: Valider → Envoyer → Marquer payée (sequential, no skipping)

## Execution Decides
- Visual layout style (card-based vs table, drawer vs modal for CRUD)
- Exact component choices (date pickers, select patterns)
- Color/status badge styling within existing design system
- Responsive considerations
- Invoice PDF preview/export design

## Constraints
- **French UI** — all labels in French (Offre, Tarif, Engagement, Facture, Brouillon, etc.)
- **Réglages section** — fits within existing CRM navigation under settings
- **Factur-X compliance** — invoice PDF must support EU standard (2026 mandate)
- **Invoice status is strict** — Brouillon → Validée → Envoyée → Payée, no skipping
- **Permission gated** — billing screens require appropriate permission codes
