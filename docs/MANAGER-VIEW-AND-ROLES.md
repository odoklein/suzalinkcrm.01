# Captain Prospect CRM — Manager View & System Documentation

This document explains **all manager pages**, **each role's access**, and **how the system works**.

---

## Table of Contents

1. [Manager View — Page by Page](#1-manager-view--page-by-page)
2. [Roles and Access](#2-roles-and-access)
3. [How the System Works](#3-how-the-system-works)
4. [Enricher — Deep Dive](#4-enricher--deep-dive)
5. [Quick Reference](#5-quick-reference--manager-pages-by-section)

---

## 1. Manager View — Page by Page

Managers have the broadest access. All manager routes live under `/manager/*` and require the **MANAGER** role.

### 1.1 Accueil (Home)

| Route | Permission | Description |
|-------|------------|-------------|
| `/manager/dashboard` | `pages.dashboard` | Main performance cockpit: KPIs (RDV, calls, conversion, hot leads), mission stats, RDV leaderboard, recent activity, weekly goal charts. Filters by date range and mission. |

### 1.2 Prospection (Outbound Engine)

| Route | Permission | Description |
|-------|------------|-------------|
| `/manager/lists` | `pages.prospects` | Listes & prospection — index of all lists (companies/contacts). |
| `/manager/lists/new` | — | Create a new list for a mission. |
| `/manager/lists/[id]` | — | List detail: companies, contacts, progress. |
| `/manager/lists/[id]/edit` | — | Edit list metadata. |
| `/manager/lists/import` | — | Import lists from CSV. |
| `/manager/missions` | `pages.missions` | Missions index — search/filter by status, channel. |
| `/manager/missions/new` | — | Create mission (audience, script, review, launch). |
| `/manager/missions/[id]` | — | Mission detail: campaigns, lists, SDRs, stats. |
| `/manager/missions/[id]/edit` | — | Edit mission metadata (client, objective, dates, channels, team lead). |
| `/manager/prospection` | `pages.missions` | Appels — hot leads and callbacks from SDR activity (INTERESTED, CALLBACK_REQUESTED). |

### 1.3 Suivi (Follow-up & Oversight)

| Route | Permission | Description |
|-------|------------|-------------|
| `/manager/clients` | `pages.clients` | Clients list — companies served, mission counts, portal status. |
| `/manager/clients/[id]` | — | Client detail: onboarding, missions, files, reporting, billing shortcuts. |
| `/manager/rdv` | `pages.analytics` | RDV view — meetings with filters and actions (past/upcoming). |
| `/manager/analytics` | `pages.analytics` | Statistics — journal, AI recap, filters by SDR/mission/list. |
| `/manager/emails` | `pages.email` | Email Hub dashboard — health, sequences, activity. |
| `/manager/emails/mailboxes` | — | Mailbox config and health. |
| `/manager/emails/analytics` | — | Email performance stats. |
| `/manager/emails/sequences` | — | Email sequences list. |
| `/manager/emails/contacts` | — | Email contacts management. |
| `/manager/comms` | `pages.comms` | Internal comms — messages, threads. |

### 1.4 Équipe (Team)

| Route | Permission | Description |
|-------|------------|-------------|
| `/manager/team` | `pages.sdrs` | Team performance — SDR/BD stats. |
| `/manager/team/[id]` | — | Team member detail — missions, planning, conflicts. |
| `/manager/sdrs` | — | SDR roster and creation (direct access). |
| `/manager/planning` | `pages.planning` | Planning — missions, SDR capacity, calendar blocks (Allocation & Calendrier tabs). |
| `/manager/planning/conflicts` | — | Planning conflicts view. |
| `/manager/projects` | `pages.projects` | Projects list. |
| `/manager/projects/[id]` | — | Project detail. |

### 1.5 Réglages, Facturation & Fichiers (Settings, Billing & Files)

| Route | Permission | Description |
|-------|------------|-------------|
| `/manager/users` | `pages.sdrs` | User management — roles, permissions. |
| `/manager/settings` | `pages.sdrs` | Notification settings (email). |
| `/manager/notifications` | — | Manager notifications. |
| `/manager/files` | `pages.files` | File manager — client/mission documents. |
| `/manager/billing` | `pages.billing` | Billing dashboard. |
| `/manager/billing/clients` | — | Billing clients list. |
| `/manager/billing/clients/[id]` | — | Billing client detail. |
| `/manager/billing/engagements` | — | Engagements list. |
| `/manager/billing/engagements/[id]` | — | Engagement detail. |
| `/manager/billing/invoices` | — | Invoices list. |
| `/manager/billing/invoices/new` | — | Create invoice. |
| `/manager/billing/invoices/[id]` | — | Invoice detail. |
| `/manager/billing/offres` | — | Offers/catalog. |
| `/manager/billing/settings` | — | VAT, payment terms, invoice config. |

### 1.6 Prospects (Ingestion & Routing)

| Route | Permission | Description |
|-------|------------|-------------|
| `/manager/prospects` | — | Prospect profiles list/search. |
| `/manager/prospects/[id]` | — | Prospect profile — routing, status history. |
| `/manager/prospects/sources` | — | ProspectSource definitions (forms, imports). |
| `/manager/prospects/sources/new` | — | Create prospect source. |
| `/manager/prospects/sources/[id]/edit` | — | Edit prospect source. |
| `/manager/prospects/rules` | — | ProspectRule — scoring and routing rules. |
| `/manager/prospects/rules/[id]/edit` | — | Edit prospect rule. |
| `/manager/prospects/review` | — | Triage queue for new/uncertain prospects. |
| `/manager/prospects/sandbox` | — | Test routing strategies. |

### 1.7 Campaigns

| Route | Permission | Description |
|-------|------------|-------------|
| `/manager/campaigns` | — | Campaigns list. |
| `/manager/campaigns/new` | — | Create campaign. |
| `/manager/campaigns/[id]` | — | Campaign detail. |

### 1.8 Legacy Email (older layout)

| Route | Description |
|-------|-------------|
| `/manager/email` | Legacy email entry. |
| `/manager/email/templates` | Email templates. |
| `/manager/email/sequences`, `/new`, `/[id]` | Email sequences CRUD. |
| `/manager/email/mailboxes` | Mailbox management. |
| `/manager/email/analytics` | Email analytics. |

### 1.9 Tools

| Route | Description |
|-------|-------------|
| `/manager/playbook/import` | Import/sync sales playbook (e.g. Leexi). |
| `/manager/enricher` | CSV enrichment — phone lookup, validation. |

---

## 2. Roles and Access

### 2.1 Role Enum (Prisma)

```
UserRole: SDR | MANAGER | CLIENT | DEVELOPER | BUSINESS_DEVELOPER
```

### 2.2 Role Summary

| Role | Default Path | What They Have |
|------|--------------|----------------|
| **MANAGER** | `/manager/dashboard` | Full management: clients, missions, planning, billing, prospects, team, analytics, email hub, files. Create/edit/delete missions, lists, campaigns, users; manage permissions; create and validate invoices. |
| **SDR** | `/sdr/action` | Execution: action queue, callbacks, meetings, history, emails, projects. Limited to assigned missions. |
| **BUSINESS_DEVELOPER** | `/bd/dashboard` | Portfolio, clients, onboarding, missions, campaigns, lists. SDR-style actions plus client creation and mission management. |
| **CLIENT** | `/client/portal` | Portal for own client: meetings, reporting, files, email activity. Data scoped by `clientId`. |
| **DEVELOPER** | `/developer/dashboard` | Projects, tasks, integrations, settings. |

### 2.3 Manager Navigation Sections

- **Accueil**: Dashboard
- **Prospection**: Listes & Prospection, Missions, Appels
- **Suivi**: Clients, RDV, Statistiques, Email Hub, Messages
- **Équipe**: Performance, Planning, Projets
- **Réglages (divider)**: Réglages, Notifications email, Facturation, Fichiers

### 2.4 SDR Navigation Sections

- **Accueil**: Dashboard
- **Actions**: Appeler, Rappels, Historique, Mes RDV
- **Communication**: Email Hub, Messages
- **Organisation**: Projets
- **Paramètres**: Configuration VOIP

### 2.5 Business Developer Navigation Sections

- **Accueil**: Dashboard
- **Commercial**: Mes clients, Missions, Appeler, Rappels, Historique, Opportunités, Nouveau client
- **Communication**: Messages, Mon profil

### 2.6 Client Navigation Sections

- **Main**: Accueil, Mes RDV, Rapports, Messages
- **Outils**: Mon Email, Base de données, Fichiers, Aide
- **Compte**: Paramètres

### 2.7 Developer Navigation Sections

- **Accueil**: Dashboard
- **Travail**: Projets, Tâches, Intégrations, Paramètres

### 2.8 Permission System

- **Permission**, **RolePermission**, **UserPermission** (Prisma).
- Role defaults define base permissions per role.
- **UserPermission** can add/remove permissions per user.
- Permission codes (e.g. `pages.dashboard`, `pages.clients`, `features.create_mission`, `actions.make_calls`) gate nav items and features.
- `GlobalSidebar` and nav items use `permission`; items are hidden without the required permission.
- API handlers use `requireRole(allowedRoles, request)` for role-based protection.

### 2.9 Route Protection (Middleware)

| Path Prefix | Allowed Roles |
|-------------|---------------|
| `/manager` | MANAGER only |
| `/sdr` | SDR, BUSINESS_DEVELOPER |
| `/bd` | BUSINESS_DEVELOPER only |
| `/client` | CLIENT only |
| `/developer` | DEVELOPER only |

---

## 3. How the System Works

### 3.1 Authentication

- **Provider**: NextAuth with Credentials (email/password).
- **Session**: JWT (`strategy: "jwt"`).
- **Session fields**: `id`, `email`, `name`, `role`, `isActive`, `clientId` (CLIENT).
- **Login**: `/login`. Inactive users get a specific error and are blocked.
- **Redirect**: After login, `getRedirectPath(role)` sends users to their default path.

### 3.2 Middleware

- **File**: `middleware.ts`
- **Matcher**: `/sdr/*`, `/manager/*`, `/client/*`, `/developer/*`, `/bd/*`
- **Rules**:
  1. Valid token required (authorized callback).
  2. `isActive === false` → redirect to `/blocked`.
  3. Role mismatch → redirect to `/unauthorized`.

### 3.3 Layout & Navigation

- **Manager layout**: `app/manager/layout.tsx` → `AppLayoutShell` with `allowedRoles={["MANAGER"]}` and `MANAGER_NAV`.
- **AppLayoutShell**: Uses `useSession()`, redirects unauthenticated to `/login`, enforces `allowedRoles`, renders sidebar from nav config.
- **PermissionProvider**: Loads `/api/users/[id]/permissions`, exposes `hasPermission`, `hasAnyPermission`, `hasAllPermissions`.

### 3.4 Data Scoping

| Role | Scope |
|------|-------|
| **CLIENT** | All data filtered by `session.user.clientId`. |
| **SDR / BD** | Missions via assignments; lists, actions, opportunities scoped by mission. |
| **MANAGER** | No client scoping; full visibility. |

### 3.5 Main Flows

#### Prospection

1. Manager (or BD) creates **Client**.
2. Manager creates **Mission** (client, dates, channels: CALL, EMAIL, LINKEDIN).
3. Manager creates **Campaign**(s) and **List**(s) under mission.
4. Manager assigns **SDRs** to mission.
5. Prospects flow through **ProspectSource** → **ProspectProfile** → rules → routing to missions/SDRs.

#### SDR Execution

1. SDR selects mission and list (stored on User).
2. **Next action** comes from `Action` and config-driven workflow.
3. SDR logs **Action** (result, notes, callback date).
4. Callbacks and meetings driven by `result` (e.g. CALLBACK_REQUESTED, MEETING_BOOKED).
5. **Opportunities** created when configured (e.g. `triggersOpportunity`).

#### Planning

1. Manager defines **MissionPlan**(s) and **MissionMonthPlan**(s).
2. Manager creates **ScheduleBlock**(s) for SDRs.
3. **PlanningConflict** records overload, unscheduled allocations, missing assignments.

#### Billing

1. **Engagement** links Client to **OffreTarif**.
2. **Invoice** created (draft → validated → sent → paid).
3. Invoice lines can be driven by RDV counts from mission stats.

### 3.6 Tech Stack

- **Frontend**: Next.js App Router, React, TypeScript, Tailwind, Recharts.
- **Backend**: Next.js route handlers (`app/api/*`).
- **Database**: PostgreSQL, Prisma.
- **Auth**: NextAuth (credentials, JWT).

---

## 4. Enricher — Deep Dive

The **Enricher** at `/manager/enricher` is a **Company Phone Enricher** tool. It takes a CSV of companies (with optional website/address) and enriches each row with a **phone number** by querying **SerpAPI Google Maps**. It is separate from prospect-pipeline enrichment (Apollo, etc.).

### 4.1 Purpose

- **Input**: CSV with company name and optionally website and/or address.
- **Output**: Same rows plus `phone_number`, `phone_source`, `confidence_score`, and `status`.
- **Use case**: Bulk phone lookup for outbound lists (e.g. before importing into missions or calling).

### 4.2 What It Contains (UI & Flow)

| Step | Description |
|------|-------------|
| **Upload** | Drag-and-drop or file picker; accepts `.csv` only. |
| **Format detection** | Auto-detects format from headers: **Format A** (company_name + website), **Format B** (company_name + address), **Format C** (website only), **Format D** (company_name only). |
| **Column mapping** | User maps CSV columns to: **Company** (required), **Website**, **Address**. Fuzzy matching suggests columns from names like `company_name`, `company`, `nom`, `website`, `url`, `address`, `adresse`, etc. |
| **Run** | Start enrichment; rows are processed with configurable concurrency (5 workers), pause/resume, and retries (2 retries per row). |
| **Results table** | Each row shows original columns plus `phone_number`, `phone_source`, `confidence_score`, `status` (pending / processing / found / not_found / error). Expandable per-row log. |
| **Stats** | Total, Traités (processed), Trouvés (found), Non trouvés (not found), Erreurs (errors). Progress bar and percentage. |
| **Export** | Download enriched data as CSV with added columns. |
| **Reset** | Clear file and results to start over. |

### 4.3 Backend: SerpAPI Lookup

- **API**: `POST /api/enricher/serp-lookup`
- **Body**: `{ company_name?, address?, website? }` — at least `company_name` or `address` required.
- **External dependency**: [SerpAPI](https://serpapi.com/) **Google Maps** engine (`engine=google_maps`, `hl=fr`, `gl=fr`). Requires **`SERP_API_KEY`** in environment; if missing, API returns 503.
- **Logic**:
  - Builds search query from company name + address.
  - Calls SerpAPI; reads `local_results` (title, address, phone, place_id).
  - **Phone validation**: Rejects too short/long, known fake numbers (e.g. 0000000000, 1234567890), and same-digit runs.
  - **Matching**: Uses fuzzy company name score (word overlap, accent normalization) and optional address overlap to pick the best result; assigns a **confidence** (0–100). If no strong match, can fall back to first result with a valid phone (confidence ≥ 40).
- **Response**: `{ phone_number, source, confidence }` with `source: 'serp_google_maps'`, or no phone if none found/valid.

### 4.4 Client-Side Details

- **Phone normalization**: French-style (e.g. `0xxxxxxxxx` → `+33xxxxxxxxx`); digits-only length 7–15, fake-number set and same-digit check aligned with API.
- **Concurrency**: Up to 5 parallel requests (`MAX_CONCURRENCY = 5`); **MAX_RETRIES = 2** per row with 1s/2s backoff.
- **Log**: Pipeline log with elapsed time (`+Xs`), message types (info / ok / warn / err); per-row expandable log with `[START]`, `[SUCCESS]`, `[NOT FOUND]`, `[RETRY n]`, `[ERROR]`.
- **Export filename**: `enriched_phones_YYYY-MM-DD.csv`.

### 4.5 Configuration & Limits

- **Env**: `SERP_API_KEY` must be set for the API to work.
- **Rate limits**: Determined by your SerpAPI plan; the UI does not throttle beyond concurrency 5 and retries.
- **No auth beyond session**: `requireAuth(request)` ensures the user is logged in; role is not restricted in the route (page is under `/manager` so only managers reach it via nav).

### 4.6 Relation to Other “Enrichment” in the App

| Feature | Where | What it does |
|--------|--------|--------------|
| **Manager Enricher** | `/manager/enricher` | Bulk CSV → company phone via SerpAPI Google Maps. |
| **Prospect enrichment** | Prospect pipeline (Apollo, etc.) | Enriches **ProspectProfile** (email, LinkedIn, company) via Apollo/Clearbit; used in pipeline step and optional manual trigger. |
| **VOIP enrichment** | Call handling | Post-call summary/transcript from provider (e.g. Aircall); `enrichmentPending` / `voip:enrichment-ready`. |
| **List import warning** | `/manager/lists/import` | Message that contacts without email “won’t be enriched” (refers to prospect-style enrichment, not this enricher). |

The Enricher is **standalone**: it does not write to Client/Mission/List/Contact; it only returns CSV for download or manual reuse elsewhere.

---

## 5. Quick Reference — Manager Pages by Section

| Section | Pages |
|---------|-------|
| **Accueil** | Dashboard |
| **Prospection** | Lists, Missions, Prospection (Appels) |
| **Suivi** | Clients, RDV, Analytics, Email Hub, Comms |
| **Équipe** | Team, Planning, Projects |
| **Réglages** | Users, Settings, Billing, Files |
| **Prospects** | List, Review, Sources, Rules, Sandbox |
| **Campaigns** | List, New, Detail |
| **Tools** | Playbook Import, Enricher |

---

*For architecture and API details, see `docs/system-overview.md` and `docs/CRM-OVERVIEW.md`.*
