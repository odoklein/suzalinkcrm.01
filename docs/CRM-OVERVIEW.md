# Captain Prospect CRM — Overview & Architecture

This document describes how the CRM works, all views and pages, and how the main entities relate to each other.

---

## 1. What the CRM Does

**Captain Prospect CRM** is a **sales execution platform** for Suzali Conseil. It centralizes:

- **Prospection**: lists, missions, campaigns, cold calling, email sequences
- **SDR execution**: next action, callbacks, meetings, history, emails
- **Manager oversight**: dashboards, planning, team performance, billing
- **Client visibility**: portal (meetings, results, files, reporting)
- **Internal operations**: projects/tasks, internal comms, billing (invoices, engagements)

Access is **role-based**: SDR, Manager, Business Developer (BD), Client, Developer. Each role has its own layout and navigation.

---

## 2. Roles & Entry Points

| Role | Default path after login | Purpose |
|------|---------------------------|--------|
| **MANAGER** | `/manager/dashboard` | Strategy, missions, team, planning, billing |
| **SDR** | `/sdr/action` | Execute calls, callbacks, meetings, emails |
| **BUSINESS_DEVELOPER** | `/bd/dashboard` | Portfolio, clients, onboarding, SDR-like actions |
| **CLIENT** | `/client/portal` | Portal: meetings, results, files, reporting |
| **DEVELOPER** | `/developer/dashboard` | Projects, tasks, integrations, settings |

- Root `/` redirects unauthenticated users to `/login`; logged-in users are redirected to their role’s default path.
- `getRedirectPath(role)` in `lib/auth.ts` defines these defaults.

---

## 3. Data Model Relations (High Level)

```
Client
  ├── users (CLIENT role)
  ├── missions
  ├── folders / files
  ├── projects
  ├── onboarding (ClientOnboarding)
  ├── commsChannel (CommsChannel)
  ├── prospectSources / prospectRules / prospectPipelineConfig
  ├── engagements → billing
  └── billingClient (billing profile)

Mission (belongs to Client)
  ├── channel (legacy) + channels[] (CALL, EMAIL, LINKEDIN)
  ├── campaigns
  ├── lists → Company → Contact
  ├── sdrAssignments (User as SDR)
  ├── teamLeadSdr (User)
  ├── scheduleBlocks (planning)
  ├── missionPlans
  ├── folders / files
  ├── emailThreads / sentEmails
  ├── commsChannel
  ├── prospectProfiles / prospectSources
  └── emailTemplates (MissionEmailTemplate)

Campaign (belongs to Mission)
  ├── actions (Action)
  ├── files
  ├── emailThreads / emailSequences
  └── commsChannel

List (belongs to Mission)
  └── companies → contacts

Company (belongs to List)
  ├── contacts
  ├── opportunities
  └── actions

Contact (belongs to Company)
  ├── actions
  ├── opportunities
  ├── emailThreads / sequenceEnrollments / sentEmails
  └── unsubscribed (email consent)

Action (SDR activity)
  ├── contact? / company?
  ├── sdr (User)
  ├── campaign
  └── channel, result, callbackDate, note, duration...

Opportunity (qualified lead)
  ├── contact
  ├── company
  └── emailThreads
```

- **User** links to: client (if CLIENT), missions (SDR assignments, team lead), actions, projects/tasks, mailboxes, comms, billing actions, prospect review/assignments, etc.
- **Billing**: Client → Engagements (OffreTarif) → Invoices (CompanyIssuer, BillingClient) → InvoiceItem, InvoicePayment.
- **Email Hub**: Mailbox → EmailThread → Email; EmailSequence → EmailSequenceStep, EmailSequenceEnrollment (Contact).
- **Comms**: CommsChannel (Mission / Client / Campaign / Group / Direct) → CommsThread → CommsMessage.
- **Prospects**: ProspectSource → ProspectEvent → ProspectProfile; ProspectRule, ProspectPipelineConfig (client-level).

---

## 4. Views & Pages by Role

### 4.1 Manager (`/manager/*`)

Manager layout uses `MANAGER_NAV` and `allowedRoles={["MANAGER"]}`.

| Section | Route | Description |
|--------|--------|-------------|
| **Accueil** | `/manager/dashboard` | Dashboard home |
| **Prospection** | | |
| | `/manager/lists` | Listes & prospection (lists index) |
| | `/manager/lists/new` | New list |
| | `/manager/lists/[id]` | List detail |
| | `/manager/lists/[id]/edit` | Edit list |
| | `/manager/lists/import` | Import list |
| | `/manager/missions` | Missions index |
| | `/manager/missions/new` | New mission |
| | `/manager/missions/[id]` | Mission detail |
| | `/manager/missions/[id]/edit` | Edit mission |
| | `/manager/prospection` | Appels (calls overview) |
| **Suivi** | | |
| | `/manager/clients` | Clients index |
| | `/manager/clients/[id]` | Client detail |
| | `/manager/email` | Emails (opens in new tab) |
| | `/manager/comms` | Messages (internal comms) |
| **Équipe** | | |
| | `/manager/team` | Performance (team) |
| | `/manager/team/[id]` | Team member detail |
| | `/manager/planning` | Planning (schedule blocks) |
| | `/manager/projects` | Projets |
| | `/manager/projects/[id]` | Project detail |
| **Réglages / Facturation / Fichiers** | | |
| | `/manager/users` | Réglages (users) |
| | `/manager/billing` | Facturation home |
| | `/manager/billing/invoices` | Factures list |
| | `/manager/billing/invoices/new` | New invoice |
| | `/manager/billing/invoices/[id]` | Invoice detail |
| | `/manager/billing/clients` | Billing clients |
| | `/manager/billing/clients/[id]` | Billing client detail |
| | `/manager/billing/offres` | Offres & tarifs |
| | `/manager/billing/engagements` | Engagements list |
| | `/manager/billing/engagements/[id]` | Engagement detail |
| | `/manager/billing/settings` | Billing settings |
| | `/manager/files` | Fichiers |
| **Email Hub (sub)** | | |
| | `/manager/email/mailboxes` | Mailboxes |
| | `/manager/email/templates` | Templates |
| | `/manager/email/sequences` | Sequences list |
| | `/manager/email/sequences/new` | New sequence |
| | `/manager/email/sequences/[id]` | Sequence detail/edit |
| | `/manager/email/analytics` | Email analytics |
| **Prospects (orchestration)** | | |
| | `/manager/prospects` | Prospects overview |
| | `/manager/prospects/review` | Review queue |
| | `/manager/prospects/[id]` | Prospect profile |
| | `/manager/prospects/sources` | Prospect sources |
| | `/manager/prospects/sources/new` | New source |
| | `/manager/prospects/sources/[id]/edit` | Edit source |
| | `/manager/prospects/rules` | Rules list |
| | `/manager/prospects/rules/[id]/edit` | Edit rule |
| | `/manager/prospects/sandbox` | Rule sandbox |
| **Other** | | |
| | `/manager/campaigns` | Campaigns list |
| | `/manager/campaigns/new` | New campaign |
| | `/manager/campaigns/[id]` | Campaign detail |
| | `/manager/notifications` | Notifications |

---

### 4.2 SDR (`/sdr/*`)

SDR layout uses `SDR_NAV` and `allowedRoles={["SDR", "BUSINESS_DEVELOPER"]}` (BD can use SDR pages).

| Section | Route | Description |
|--------|--------|-------------|
| **Accueil** | `/sdr` | SDR home |
| **Actions** | `/sdr/action` | Appeler (next action / call) |
| | `/sdr/callbacks` | Rappels |
| | `/sdr/history` | Historique |
| | `/sdr/meetings` | Mes RDV |
| **Communication** | `/sdr/email` | Mes emails (new tab) |
| | `/sdr/emails/sent` | Emails envoyés |
| | `/sdr/comms` | Messages |
| **Organisation** | `/sdr/projects` | Projets |
| | `/sdr/projects/[id]` | Project detail |
| **Data** | `/sdr/lists` | Lists (mission lists) |
| | `/sdr/lists/[id]` | List detail (companies/contacts) |
| | `/sdr/contacts/[id]` | Contact detail |
| | `/sdr/companies/[id]` | Company detail |
| | `/sdr/opportunities` | Opportunités |
| **Other** | `/sdr/notifications` | Notifications |

---

### 4.3 Business Developer (`/bd/*`)

BD layout uses `BD_NAV` and `allowedRoles={["BUSINESS_DEVELOPER"]}`. BD also uses many SDR routes (action, callbacks, history, opportunities).

| Section | Route | Description |
|--------|--------|-------------|
| **Accueil** | `/bd` | Redirect / landing |
| | `/bd/dashboard` | BD dashboard |
| **Commercial** | `/bd/clients` | Mes clients (portfolio) |
| | `/bd/clients/[id]` | Client detail |
| | `/bd/clients/new` | Nouveau client |
| | `/bd/missions` | Missions (BD view) |
| | (SDR) `/sdr/action`, `/sdr/callbacks`, `/sdr/history`, `/sdr/opportunities` | Same as SDR |
| **Communication** | `/bd/comms` | Messages |
| | `/bd/settings` | Mon profil (BD settings) |
| **Other** | `/bd/campaigns` | Campaigns |
| | `/bd/projects` | Projects |

---

### 4.4 Client (`/client/*`)

Client layout uses `CLIENT_NAV` and `allowedRoles={["CLIENT"]}`. Users with `clientId` see their company’s data.

| Section | Route | Description |
|--------|--------|-------------|
| **Accueil** | `/client/portal` | Portal home |
| | `/client/portal/meetings` | Mes RDV |
| | `/client/results` | Résultats |
| | `/client/contact` | Messages / Contacter (contact form or inbox) |
| **Outils** | `/client/portal/reporting` | Rapport PDF |
| | `/client/portal/email` | Mon Email |
| | `/client/portal/files` | Mes Fichiers |
| | `/client/portal/aide` | Aide |
| **Compte** | `/client/portal/settings` | Paramètres |
| **Other** | `/client/portal/notifications` | Notifications |
| | `/client/comms` | Comms (if exposed in nav) |

---

### 4.5 Developer (`/developer/*`)

Developer layout is custom (no `AppLayoutShell`); role check is `DEVELOPER` only.

| Route | Description |
|-------|-------------|
| `/developer/dashboard` | Dashboard |
| `/developer/projects` | Projets |
| `/developer/projects/[id]` | Project detail |
| `/developer/tasks` | Tâches |
| `/developer/integrations` | Intégrations |
| `/developer/settings` | Paramètres |

---

## 5. Shared / Global Pages

| Route | Description |
|-------|-------------|
| `/login` | Login (credentials) |
| `/blocked` | Shown when user is disabled |
| `/unauthorized` | Wrong role or permission |

---

## 6. How the Main Flows Connect

### 6.1 Prospection flow

1. **Manager** creates **Client** (or BD creates via onboarding).
2. **Manager** creates **Mission** (client, dates, channels: CALL, EMAIL, LINKEDIN).
3. **Manager** creates **Campaign**(s) under mission (ICP, pitch, script).
4. **Manager** creates/imports **List**(s) under mission; lists contain **Company** → **Contact**.
5. **Manager** assigns **SDRs** to mission (`SDRAssignment`) and can set a **team lead**.
6. **Prospects** can be ingested via **ProspectSource** (web form, CSV, API…) and go through **ProspectProfile** pipeline (review, rules, routing) and optionally create Contact/Company and assign to mission/SDR.

### 6.2 Execution flow (SDR)

1. **SDR** picks a **Mission** (and optionally **List**); selection stored on User (`selectedMissionId`, `selectedListId`).
2. **Next action** comes from **Action** (and config-driven **ActionStatusDefinition** / **ActionNextStep**) for the chosen campaign/list.
3. **SDR** logs **Action** (contact/company, campaign, channel, result, note, callback date, duration).
4. **Callback** and **meetings** are driven by `result` (e.g. CALLBACK_REQUESTED, MEETING_BOOKED) and `callbackDate`.
5. **Opportunities** can be created from actions (e.g. when a status has `triggersOpportunity`); they link Contact + Company and can be handed off.

### 6.3 Planning flow

1. **Manager** defines **MissionPlan**(s) (frequency, days, time preference) per mission and assigns SDRs (**MissionPlanSdr**).
2. **Manager** creates **ScheduleBlock**(s) (SDR, mission, date, start/end time); blocks can be suggested from plan and then confirmed.
3. APIs: `/api/planning`, `/api/planning/[id]`, `/api/schedule-blocks/*`, `/api/planning/copy-week`, `/api/planning/sdrs`.

### 6.4 Email flow

1. **Mailbox** (per user or shared) connects via OAuth (Gmail/Outlook) or SMTP/IMAP; **EmailThread** / **Email** are synced.
2. Threads can be linked to **Client**, **Mission**, **Campaign**, **Contact**, **Opportunity**.
3. **EmailSequence** (steps, delays, templates) enrolls **Contact** via **EmailSequenceEnrollment**; sent **Email** records link to enrollment and optional **Mission**/**Contact**.
4. SDR quick-send: **EmailTemplate** (optionally linked to mission via **MissionEmailTemplate**), sent from mailbox and logged on **Email** with contact/mission.

### 6.5 Internal comms flow

1. **CommsChannel** is created for Mission, Client, Campaign, **CommsGroup**, or Direct (user pair).
2. **CommsThread** lives in a channel; **CommsParticipant** and **CommsMessage** (with mentions, reactions, read receipts) form the conversation.
3. Broadcast threads target audience by role/mission/group and track **CommsBroadcastReceipt**.

### 6.6 Billing flow

1. **OffreTarif** defines pricing (fixe mensuel, prix par RDV).
2. **Engagement** links **Client** to **OffreTarif** (dates, overrides, statut).
3. **Invoice** is created (draft → validated → sent → paid) for **BillingClient** from **CompanyIssuer**; can be engagement-driven (fixed + RDV count) with **missionBreakdown**.
4. **InvoicePayment** links to bank transactions (e.g. Qonto) and can be confirmed by a user.
5. E-reporting/PDP: **transactionType**, **pdpSubmissionStatus**, **pdpSubmissionId** for EU compliance.

### 6.7 Projects & tasks (shared)

1. **Project** (owner, optional client); **ProjectMember**; **ProjectMilestone**.
2. **Task** (project, assignee, status, priority, due date, optional milestone, parent task, dependencies).
3. **TaskComment**, **TaskTimeEntry**, **ProjectActivity**; **File** can attach to task.
4. Used by Manager, SDR, BD, Developer (role-based visibility).

### 6.8 Files

1. **Folder** (optional parent, optional mission/client); **File** (folder, uploadedBy, optional mission/client/campaign/task).
2. **GoogleDriveSync** links user and CRM folder to a Drive folder (sync direction, interval).

---

## 7. API Surface (Grouped by Domain)

- **Auth**: `/api/auth/[...nextauth]`
- **Users**: `/api/users`, `/api/users/[id]`, permissions, status, profile
- **Missions / Campaigns / Lists**: `/api/missions`, `/api/campaigns`, `/api/lists`, list export, mission assign, action-statuses
- **Companies / Contacts**: `/api/companies/[id]`, `/api/contacts`, `/api/contacts/[id]`
- **Actions**: `/api/actions`, `/api/actions/next`, `/api/actions/[id]`
- **Opportunities**: `/api/opportunities`
- **SDR**: `/api/sdr/stats`, `/api/sdr/missions`, `/api/sdr/callbacks`, `/api/sdr/activity`, `/api/sdr/emails/sent`, `/api/sdr/email`
- **Planning**: `/api/planning`, `/api/planning/[id]`, `/api/planning/sdrs`, `/api/planning/copy-week`, `/api/schedule-blocks/*`
- **Email**: `/api/email/*` (accounts, sync, send, threads, templates, tracking, OAuth, webhooks, quick-send, analytics)
- **Comms**: `/api/comms/*` (threads, messages, groups, templates, events, inbox stats)
- **Files**: `/api/files`, upload, download, share
- **Projects / Tasks**: `/api/projects`, `/api/tasks`, reorder, dependencies, activity, time-entries, milestones
- **Billing**: `/api/billing/*` (invoices, clients, stats, export, rdv-count, audit-log, cancel, credit-note, pdf)
- **Prospects**: `/api/prospects/*` (profiles, review, intake, sources, rules, sandbox, listing/apollo, apify)
- **Client**: `/api/client/*` (reporting PDF, mailbox, files, contactable-sdrs, email-activity)
- **Config**: `/api/config/action-statuses`
- **AI**: `/api/ai/*` (onboarding, mistral: project-report, note-improve, email-draft, task-enhance, task-suggest)
- **Analytics**: `/api/analytics/daily-activity`, team-trends
- **Notifications**: `/api/notifications/[id]`
- **Integrations**: `/api/integrations/google-drive/*`
- **BD / Developer**: `/api/bd/stats`, `/api/developer/stats`
- **Playbook**: `/api/playbook/import`

---

## 8. Permissions

- **Permission** and **RolePermission** define what each **UserRole** can do; **UserPermission** overrides per user.
- Nav items can require a `permission` (e.g. `pages.dashboard`, `pages.missions`, `pages.billing`); `AppLayoutShell` and route checks enforce access.
- Pages may also check role or `clientId` (e.g. Client users only see their client’s data).

---

## 9. Summary Diagram (Conceptual)

```
                    ┌─────────────┐
                    │    Client   │
                    └──────┬──────┘
           ┌──────────────┼──────────────┐
           ▼              ▼               ▼
     ┌──────────┐  ┌──────────┐   ┌─────────────┐
     │ Mission  │  │ Onboard  │   │ Engagement  │
     └────┬─────┘  └──────────┘   └──────┬──────┘
          │                              │
    ┌─────┴─────┐                        ▼
    ▼           ▼                 ┌─────────────┐
 Campaign    List                 │  Invoice    │
    │           │                 └─────────────┘
    │           ▼
    │     Company → Contact
    │           │
    ▼           ▼
 Action    Opportunity
 (SDR)     (handoff)

 User ←→ SDR / Manager / BD / Client / Developer
         ↓
 Mailbox → EmailThread → Email
 CommsChannel → CommsThread → CommsMessage
 Project → Task
 ProspectSource → ProspectProfile (→ Contact/Company)
```

This file is the single reference for how the CRM functions, which pages exist in each view, and how the main entities and flows relate.
