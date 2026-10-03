## System Overview

This document explains how the app works **role by role**, page by page, and how everything connects down to the **data schema** and **tech stack**.

---

## Manager Area (`/manager`)

Managers steer the whole operation: they monitor performance, manage clients and missions, drive planning, billing, and the outbound engine.

### Dashboard – `/manager/dashboard`

- **Purpose**: High-level performance cockpit for all missions.
- **Key data**:
  - Aggregated stats from `/api/stats` (`totalActions`, `meetingsBooked`, `opportunities`, `conversionRate`, `activeMissions`).
  - Mission performance summary from `/api/stats/missions-summary`.
  - Recent actions from `/api/actions/recent`.
- **UI**:
  - Date range + mission filters.
  - Hero KPIs (RDV, calls, conversion, hot leads).
  - Call result donut, weekly goal line chart, “missions near goal” list, RDV leaderboard, recent meeting activity.
 - **Implementation details**:
  - Implemented in `app/manager/dashboard/page.tsx` as the `ManagerDashboard` client component.
  - Maintains local state for date range, selected mission, loading flag, and fetched stats; calls the three APIs in parallel and refreshes data every 60 seconds.
  - Uses `DateRangeFilter` (from `components/dashboard`), Recharts charts, and animated counters; provides a CTA to `/manager/missions/new` to create missions directly from insights.
 - **APIs**:
  - `GET /api/stats` – main KPI stats for the selected date range (actions, meetings, conversion, active missions).
  - `GET /api/stats/missions-summary` – per-mission summary for the same range (used for “missions near goal” and mission filter).
  - `GET /api/actions/recent` – recent activity feed (calls/meetings) powering the bottom-right list.

### Clients – `/manager/clients` and `/manager/clients/[id]`

- **Purpose**: Manage clients (companies being served) and their onboarding.
- **List page**:
  - Loads `/api/clients` with role-based filters.
  - Shows per-client card with contact info, number of missions, users, and portal status.
  - Integrates with Leexi recaps to convert call recaps into new clients.
- **Detail page**:
  - Focus on one client: onboarding status, related missions, files, reporting shortcuts.
  - Opens drawers/modals for editing client data and launching new missions.
 - **Implementation details**:
  - List view lives in `app/manager/clients/page.tsx`, uses a manager-only layout and calls `/api/clients` (which includes `_count` fields and a subset of active missions).
  - Client creation and onboarding go through `ClientOnboardingModal`, which posts to `/api/clients` with optional onboarding payload and mission bootstrap data.
  - The `[id]` page (`app/manager/clients/[id]/page.tsx`) reads a single client with missions, onboarding, files and shortcuts; most edits are done via side drawers that call `PATCH`/`PUT` APIs rather than full-page forms.
 - **APIs**:
  - `GET /api/clients` – list all visible clients with mission/user counts (role-filtered).
  - `POST /api/clients` – create a new client, optional onboarding data, and optional initial mission.
  - `GET /api/clients/:id` – fetch a single client with its missions, onboarding, billing, and files summary.
  - `PATCH /api/clients/:id` – update client fields (contact info, industry, booking URL, etc.).
  - `GET /api/clients/:id/meetings` – retrieve meetings for a given client (used for quick access links).

### Missions – `/manager/missions`, `/manager/missions/new`, `/manager/missions/[id]`, `/manager/missions/[id]/edit`

- **Purpose**: Define and manage missions (outbound projects) per client.
- **List page**:
  - Fetches `/api/missions` with filters for active/paused and by channel.
  - Each card shows mission name, client, objective, channels, SDRs, campaign/list counts, and progress.
- **Creation**:
  - New mission dialog posts to mission API with client, channels, dates, objectives, and optional playbook.
- **Detail page**:
  - Uses `/api/missions/[id]`:
    - Includes client, campaigns, lists, SDR assignments, team lead, stats (actions, RDV, opportunities).
  - Entry point for configuring structure (campaigns, lists) and assignments.
- **Edit page**:
  - Adjusts mission fields (client switch, objective, start/end, channels, team lead) with validation on assignments.
 - **Implementation details**:
  - Backed by `app/api/missions/route.ts` (list/create) and `app/api/missions/[id]/route.ts` (detail/update/delete/assign); these enforce role checks and ensure the team lead is among assigned SDRs.
  - The list page (`app/manager/missions/page.tsx`) defines its own `Mission` type that matches the API payload and provides search, filter by status/channel, and quick stats at the top.
  - The detail `[id]` page composes subcomponents for campaigns, lists, SDR assignments, and activity metrics, so that changing one area (e.g., assigning an SDR) reuses shared components already used in SDR views.
 - **APIs**:
  - `GET /api/missions` – list missions with basic client and assignment info (filterable by status/channel).
  - `POST /api/missions` – create a new mission for a client (name, objective, channels, dates, playbook).
  - `GET /api/missions/:id` – full mission details including client, campaigns, lists, SDRs, stats.
  - `PUT /api/missions/:id` – update mission metadata (client, objective, dates, channels, team lead).
  - `PATCH /api/missions/:id` – add/remove SDR assignments via `SDRAssignment`.
  - `DELETE /api/missions/:id` – delete a mission (hard delete).
  - `GET /api/missions/:id/action-stats` – mission-level action/meeting statistics (used in some detail widgets).
  - `GET /api/missions/:id/action-statuses` / `POST /api/missions/:id/action-statuses/copy-default` – manage action workflows per mission.

### Planning – `/manager/planning`, `/manager/planning/conflicts`

- **Purpose**: Turn contract expectations into concrete SDR schedules and spot issues.
- **Main planning page**:
  - Loads `/api/planning/month?month=YYYY-MM` (missions, SDRs, allocations, schedule blocks, conflicts, health summary).
  - Two main tabs:
    - **Allocation**: Mission and team panels to edit `MissionMonthPlan.targetDays` and `SdrDayAllocation.allocatedDays`, assign SDRs, and view capacity.
    - **Calendrier**: Month calendar view of `ScheduleBlock`s per SDR/mission.
- **Conflicts page**:
  - Focused view of `PlanningConflict`s for the month.
  - Allows drilling down to missions/SDRs causing overloads, unscheduled allocations, or missing assignments.
 - **Implementation details**:
  - Main UI in `app/manager/planning/page.tsx` uses a `PlanningMonthProvider` context that wraps mission and team panels plus the calendar; it centralizes the `/api/planning/month` response and derived health summaries.
  - The allocation tab edits mission and SDR allocations, which update Prisma `MissionMonthPlan` and `SdrDayAllocation` rows; creating or modifying schedule blocks ties back to those allocations to keep `scheduledDays` in sync.
  - The conflicts page (`app/manager/planning/conflicts/page.tsx`) reads `PlanningConflict` entries for a given month and deep-links back into the main planning view with filters that highlight the problematic mission or SDR.
 - **APIs**:
  - `GET /api/planning/month` – main month snapshot (missions, SDRs, allocations, schedule blocks, conflicts).
  - `GET /api/planning` / `GET /api/planning/weekly` – supporting endpoints for higher-level or weekly summaries.
  - `GET /api/planning/conflicts` – list conflicts for a given month, optionally filtered by mission/SDR.
  - `GET /api/planning/sdrs` – per-SDR planning data (capacities, absences) used in team views.
  - `GET /api/mission-month-plans` / `GET /api/mission-month-plans/:id` – read month plans per mission.
  - `POST /api/mission-month-plans` / `PATCH /api/mission-month-plans/:id` – create/update mission month plans and their target days.
  - `GET /api/mission-plans/:id` / `POST /api/mission-plans/:id/generate` – manage weekly mission plans and generate schedule blocks.
  - `POST /api/schedule-blocks` / `PATCH /api/schedule-blocks/:id` / `POST /api/schedule-blocks/:id/confirm` / `POST /api/schedule-blocks/bulk-confirm` – CRUD and confirmation for `ScheduleBlock`s.
  - `GET /api/sdr-absences` / `POST /api/sdr-absences` / `PATCH /api/sdr-absences/:id` – manage `SdrAbsence` records that affect capacity.

### Prospects – `/manager/prospects/*`

- **Purpose**: Configure and supervise the prospect ingestion and routing pipeline.
- **Pages**:
  - `/manager/prospects`: global prospect list and search.
  - `/manager/prospects/[id]`: prospect profile detail, routing and status history.
  - `/manager/prospects/sources`, `/new`, `/[id]/edit`: manage `ProspectSource` definitions (forms, imports, integrations).
  - `/manager/prospects/rules`, `/[id]/edit`: define `ProspectRule`s (scoring and routing rules to missions/SDRs).
  - `/manager/prospects/review`: triage queue for newly arrived or uncertain prospects.
  - `/manager/prospects/sandbox`: experimentation area for new routing strategies.
 - **Implementation details**:
  - All prospect pages are backed by `app/api/prospects/*` routes plus specialised endpoints for sources, rules and pipeline config; they rely on enums for pipeline steps and statuses.
  - The list page and review page emphasize different filters over the same underlying `ProspectProfile` data: the review page focuses on unassigned / undecided records.
  - Rules and sources editors write JSON-like config into `ProspectRule` and `ProspectPipelineConfig`, which later drive automated routing into `Mission` and `User` assignments.
 - **APIs**:
  - `GET /api/prospects` – list/search of prospect profiles (with filters for status, step, owner).
  - `GET /api/prospects/profiles/:id` – detailed view of a single prospect profile.
  - `POST /api/prospects/profiles/:id/review` – apply a review decision (qualify, disqualify, re-route).
  - `GET /api/prospects/sources` / `POST /api/prospects/sources` / `PATCH /api/prospects/sources/:id` – manage prospect sources (forms, imports).
  - `POST /api/prospects/sources/:id/test-lead` – send a test lead through the pipeline for that source.
  - `GET /api/prospects/rules` / `POST /api/prospects/rules` / `PATCH /api/prospects/rules/:id` – manage scoring/routing rules.
  - `GET /api/prospects/pipeline-config` / `PATCH /api/prospects/pipeline-config` – global prospect pipeline configuration.
  - `GET /api/prospects/listing/*` – integration endpoints (Apify/Apollo, etc.) for external listing sources.

### Campaigns & Lists – `/manager/campaigns*`, `/manager/lists*`

- **Purpose**: Mission-level targeting and messaging.
- **Campaigns**:
  - `/manager/campaigns`: list of campaigns across missions.
  - `/manager/campaigns/new`: create campaign tied to a mission (ICP, scripts, rules).
  - `/manager/campaigns/[id]`: manage content, targeting, and KPIs for one campaign.
- **Lists**:
  - `/manager/lists`: central list index (companies/contacts lists).
  - `/manager/lists/new`, `/[id]/edit`: create or modify list metadata.
  - `/manager/lists/import`: CSV/import configuration for list data.
  - `/manager/lists/[id]`: view one list’s companies, contacts, and progress.
 - **Implementation details**:
  - List and campaign pages heavily use Prisma relations: `Campaign` belongs to `Mission`, `List` belongs to `Mission`, and `Company`/`Contact` belong to `List`, making it easy to scope performance back to missions and clients.
  - Import flows (on `/manager/lists/import`) parse CSVs on the server, deduplicate companies/contacts, and surface any issues before committing to the database.
  - KPIs on campaign/list views reuse the same `Action` and `Opportunity` aggregates that power dashboards, so SDR activity feeds both SDR and manager views consistently.
 - **APIs**:
  - `GET /api/campaigns` / `POST /api/campaigns` – list and create campaigns.
  - `GET /api/campaigns/:id` / `PATCH /api/campaigns/:id` – read/update a specific campaign’s settings.
  - `GET /api/lists` / `POST /api/lists` – list and create lists.
  - `GET /api/lists/:id` / `PATCH /api/lists/:id` / `DELETE /api/lists/:id` – manage a specific list and its metadata.
  - `POST /api/lists/:id/import` – list import handler (CSV/other formats).
  - `GET /api/lists/:id/export` – export list to CSV for reuse.
  - `GET /api/companies/:id` / `GET /api/contacts/:id` – used when drilling down into list items.

### Email (Manager) – `/manager/email*`

- **Purpose**: Oversee outbound email assets and performance.
- **Pages**:
  - `/manager/email`: entrypoint to the manager email hub.
  - `/manager/email/templates`: library of templates (subject/body) tied to missions.
  - `/manager/email/sequences`, `/new`, `/[id]`: define multi-step sequences (steps, delays, content) and attach them to missions/campaigns.
  - `/manager/email/mailboxes`: configure sending accounts/inboxes and their health.
  - `/manager/email/analytics`: aggregate stats on opens, clicks, replies, and bounces.
 - **Implementation details**:
  - Templates and sequences are stored as Prisma models linked to `Mission` and `Campaign`, so any change to a template can be rolled out across multiple campaigns.
  - Mailbox settings pages talk to `/api/email/mailboxes` and related routes to store SMTP/IMAP or provider tokens securely and track deliverability limits.
  - Analytics pages aggregate email events and tie them back to actions/opportunities so you can see not just email performance but downstream meetings and deals.
 - **APIs**:
  - `GET /api/email/templates` / `POST /api/email/templates` / `PATCH /api/email/templates/:id` – manage template library.
  - `GET /api/email/sequences` / `POST /api/email/sequences` / `PATCH /api/email/sequences/:id` – manage email sequences.
  - `POST /api/email/sequences/:id/enroll` – enroll contacts into a given sequence.
  - `GET /api/email/mailboxes` / `POST /api/email/mailboxes` / `PATCH /api/email/mailboxes/:id` – manage mailboxes.
  - `POST /api/email/mailboxes/:id/sync` – trigger a mailbox sync.
  - `GET /api/email/analytics` – high-level email performance analytics.
  - `GET /api/email/threads` / `GET /api/email/threads/:id` – individual thread activity and metadata.

### SDRs & Team – `/manager/sdrs`, `/manager/team`, `/manager/team/[id]`

- **Purpose**: Manage SDR/BD roster, roles, and per-user stats.
- **List pages**:
  - `/manager/sdrs`: list of SDRs with core metrics and mission assignments.
  - `/manager/team`: broader team view (including BDs and managers) with KPIs.
- **Detail page**:
  - `/manager/team/[id]`: per-user dashboard with missions, capacity, planning conflicts, and performance history.
 - **Implementation details**:
  - Backed by `User` plus planning tables (`SdrMonthCapacity`, `SdrDayAllocation`, `PlanningConflict`) to display both productivity and workload.
  - The detail page can surface conflicts specific to that SDR (overload, underutilization, unplanned days) and link directly into `/manager/planning` with pre-filtered context.
  - Role and permission editing uses the `Permission` / `RolePermission` / `UserPermission` tables so you can grant fine-grained access beyond the main role enum.
 - **APIs**:
  - `GET /api/users` – list of users with role and core stats (filtered by role to show SDRs/team).
  - `GET /api/users/:id` / `PATCH /api/users/:id` – user detail and updates.
  - `PATCH /api/users/:id/status` – activate/deactivate users.
  - `GET /api/permissions` / `POST /api/permissions` – manage available fine-grained permissions.
  - `GET /api/planning/sdrs` – planning data per SDR (capacities, allocations, conflicts) used on the team detail page.

### Files & Comms – `/manager/files`, `/manager/comms`

- **Files**:
  - File manager over client/mission documents (decks, scripts, assets).
  - Uses `File`/`Folder` schema with soft delete for safe management.
- **Comms**:
  - Management-level view of cross-channel communication (messages, possibly Slack/email threads).
 - **APIs**:
  - `GET /api/files` / `POST /api/files` – list and upload files.
  - `GET /api/files/:id` / `PATCH /api/files/:id` / `DELETE /api/files/:id` – manage individual file metadata and soft deletion.
  - `POST /api/files/:id/share` – share a file with specific users or clients.
  - `GET /api/folders` / `POST /api/folders` / `PATCH /api/folders/:id` – folder tree management.
  - `POST /api/folders/:id/share` – share entire folders.
  - `GET /api/comms/threads` / `GET /api/comms/threads/:id` – list and read communication threads.
  - `POST /api/comms/threads` / `POST /api/comms/threads/:id/comments` – create threads and comments.
  - `GET /api/comms/search` – search across comms.

### Billing – `/manager/billing*`

- **Purpose**: Link contracts, missions, and invoicing.
- **Entry**: `/manager/billing` – high-level billing dashboard.
- **Subpages**:
  - `/manager/billing/clients`: list of billing clients; `/[id]` for billing-specific client detail.
  - `/manager/billing/engagements`, `/[id]`: engagements/contracts defining mission-level RDV targets and prices.
  - `/manager/billing/offres`: offers/catalog of standard engagement types.
  - `/manager/billing/invoices`, `/new`, `/[id]`: invoices list, creation, and detail.
  - `/manager/billing/settings`: VAT, payment terms, and invoice configuration.
 - **Implementation details**:
  - Engagements link commercial terms (price per RDV, minimums, duration) back to missions and clients, giving planning and dashboards contract context.
  - Invoice creation can pre-fill lines based on engagement stats (e.g., number of meetings delivered vs minimum), and invoice status enums drive payment tracking.
  - Billing settings are centralized so invoice PDFs, numbering, VAT, and bank details remain consistent across all billing flows.
 - **APIs**:
  - `GET /api/billing/clients` / `GET /api/billing/clients/:id` – billing clients list and detail.
  - `GET /api/billing/clients/search` – quick search for billing clients.
  - `GET /api/billing/engagements` / `POST /api/billing/engagements` / `PATCH /api/billing/engagements/:id` – engagements/contract CRUD.
  - `GET /api/billing/offers` – offers catalog (available engagement templates).
  - `GET /api/billing/invoices` / `POST /api/billing/invoices` – invoice list and creation.
  - `GET /api/billing/invoices/:id` / `PATCH /api/billing/invoices/:id` – invoice detail and updates.
  - `POST /api/billing/invoices/:id/send` – send an invoice to the client.
  - `POST /api/billing/invoices/:id/cancel` / `POST /api/billing/invoices/:id/validate` – state changes.
  - `GET /api/billing/invoices/:id/pdf` – generate PDF.
  - `POST /api/billing/invoices/generate` – bulk/automatic generation based on engagements and stats.
  - `GET /api/billing/company-issuer` / `PATCH /api/billing/company-issuer` – billing company settings (VAT, bank, address).

### Notifications – `/manager/notifications`

- **Purpose**: Centralized manager notifications (planning issues, prospect events, billing alerts).
 - **APIs**:
  - `GET /api/notifications` – list notifications for the logged-in manager.
  - `PATCH /api/notifications/:id` – mark notification as read/dismissed.

### Prospection queue – `/manager/prospection`

- **Purpose**: Dedicated view for the hottest leads and callbacks coming from SDR activity.
- **Data**: Uses action results (INTERESTED, CALLBACK_REQUESTED) to prioritize follow-up.
 - **Implementation details**:
  - Built on top of `Action` and `ActionResult` enums; filters for hot/interested results and callbacks with due dates.
  - Managers can reassign or escalate records from this queue, which updates underlying `Action` rows and, when appropriate, creates or updates `Opportunity` records.
 - **APIs**:
  - `GET /api/manager/prospection/action-queue` – pre-filtered queue of hot leads and callbacks for managers.
  - `PATCH /api/actions/:id` – update action result, notes, owner or follow-up date from the queue.
  - `POST /api/opportunities` / `PATCH /api/opportunities/:id` – create or update opportunities from hot leads.

### Playbook import – `/manager/playbook/import`

- **Purpose**: Import/synchronize a sales playbook (often from Leexi call recaps) and attach it to a client/mission.
 - **Implementation details**:
  - Imports either structured JSON (e.g., from Leexi) or manual inputs and stores them in `Client.salesPlaybook` and `Mission.playbook`.
  - Often combined with client onboarding: a single recap can generate a playbook, pre-fill ICP, and propose a first mission configuration.
 - **APIs**:
  - `POST /api/generate-playbook` – accept raw recap/inputs and return structured playbook JSON.
  - `POST /api/playbook/parse` – helper to parse external formats into the internal playbook schema.
  - `POST /api/leexi/calls` – ingest Leexi call recap metadata linked to clients and missions.

---

## SDR Area (`/sdr`)

SDRs live in the `/sdr` space: daily queue, calls, emails, lists, and opportunities.

### SDR Home – `/sdr`

- **Purpose**: Landing page summarizing today’s actions, meetings, callbacks, and main missions.
 - **Implementation details**:
  - Lives in `app/sdr/page.tsx` and aggregates multiple `/api/sdr/*` endpoints.
  - Gives SDRs a quick view of the most urgent tasks pulled from actions, callbacks, and meetings so they know where to start the day.
 - **APIs**:
  - `GET /api/sdr/missions` – missions assigned to the SDR.
  - `GET /api/sdr/lists` – lists available to that SDR.
  - `GET /api/sdr/today-blocks` – today’s schedule blocks for the SDR.
  - `GET /api/sdr/actions` – recent actions for the SDR.

### Action queue – `/sdr/action`

- **Purpose**: Core execution view for SDRs.
- **Behavior**:
  - Surfaces the next best action (call/email/LinkedIn) based on campaign/list and action rules.
  - Logs `Action` entries (result, notes, follow-ups), which update stats and planning.
 - **Implementation details**:
  - Feeds from `Action` definitions and campaign/list membership to decide which contact/company to show next.
  - Writes back to the `Action` table and sometimes updates `Opportunity` or schedules callbacks, which immediately influence dashboards and prospection queues.
 - **APIs**:
  - `GET /api/sdr/missions` / `GET /api/sdr/lists` / `GET /api/sdr/today-blocks` – preload SDR context (missions, lists, today’s blocks).
  - `GET /api/config/action-statuses` – retrieve available action statuses for the selected mission.
  - `GET /api/actions/next` – return the next best action candidate given filters (mission, list, channel).
  - `GET /api/sdr/action-queue` – paginated queue of actions matching filters (used in the side list).
  - `GET /api/contacts/:id` / `GET /api/companies/:id` / `GET /api/missions/:id` – load context for the drawer.
  - `POST /api/actions` – create a new action (log a call/email/LinkedIn touch).
  - `PATCH /api/actions/:id` – update existing actions (result, notes, follow-up, owner).
  - `POST /api/actions/booking-success` – specialized endpoint when an action results in a booked meeting.
  - `POST /api/ai/mistral/note-improve` – AI helper to improve SDR notes.

### Email – `/sdr/email`, `/sdr/emails/sent`

- **Email hub**:
  - `/sdr/email`: compose, send, and manage inbox/outbox tied to missions/contacts.
  - `/sdr/emails/sent`: list of sent emails with filters by mission, campaign, contact.
 - **APIs**:
  - `GET /api/sdr/email` – combined inbox/outbox view scoped to the SDR.
  - `GET /api/email/threads` / `GET /api/email/threads/:id` – retrieve threads.
  - `POST /api/email/quick-send` – send a one-off email from an SDR.
  - `GET /api/sdr/emails/sent` / `GET /api/sdr/emails/sent/:id` – list and detail of sent emails.
  - `POST /api/email/threads/:id/comments` / `POST /api/email/threads/:id/link` – internal comments and linking threads to missions/contacts.

### Meetings – `/sdr/meetings`

- **Purpose**: View upcoming and past meetings booked via outbound actions.
- **Behavior**:
  - Pulls from `Action` results and meeting entities.
  - Links to related companies/contacts and feedback.
 - **Implementation details**:
  - Filters meetings by logged-in SDR and date range; shows meeting details, linked mission, and client.
  - Integrates with `MeetingFeedback` so SDRs can see client feedback on meetings they booked.
 - **APIs**:
  - `GET /api/sdr/meetings` – list meetings for the SDR (past and upcoming, with filters).
  - `GET /api/clients/:id/meetings` – used when cross-linking meetings to specific clients.
  - `GET /api/actions` / `GET /api/actions/stats` – derive meeting-related stats and history from actions.

### Callbacks – `/sdr/callbacks`

- **Purpose**: Manage all “CALLBACK_REQUESTED” leads in a focused queue.
- **Behavior**:
  - Uses action results and planned callback dates to prioritize.
 - **APIs**:
  - `GET /api/sdr/action-queue` – filtered by `CALLBACK_REQUESTED` result and due dates for the SDR.
  - `PATCH /api/actions/:id` – reschedule/complete callbacks or change their result.

### History – `/sdr/history`

- **Purpose**: Full history of SDR’s actions (calls, emails, LinkedIn touches).
- **Behavior**:
  - Allows filtering by mission, company, contact, result.
 - **APIs**:
  - `GET /api/sdr/actions` – full action history for the SDR, with filters (mission, result, date).
  - `GET /api/actions/stats` – aggregate stats over that history (by result, by channel).

### Opportunities – `/sdr/opportunities`

- **Purpose**: Track deals emerging from SDR work.
- **Behavior**:
  - Shows `Opportunity` records linked to companies/contacts and missions.
 - **Implementation details**:
  - Allows filtering by mission, stage, and company.
  - Uses `Opportunity` relations back to companies/contacts to provide context and links into `/sdr/companies/[id]` and `/sdr/contacts/[id]`.
 - **APIs**:
  - `GET /api/opportunities` – list opportunities for the SDR (or team), filterable by mission, stage, value.
  - `POST /api/opportunities` / `PATCH /api/opportunities/:id` – create and update opportunities.
  - `GET /api/companies/:id` / `GET /api/contacts/:id` – resolve related company/contact.

### Projects & Lists – `/sdr/projects*`, `/sdr/lists*`, `/sdr/companies/[id]`, `/sdr/contacts/[id]`

- **Projects**:
  - `/sdr/projects`: missions/projects the SDR is assigned to.
  - `/sdr/projects/[id]`: per-project view with its lists, actions, and KPIs.
- **Lists**:
  - `/sdr/lists`: SDR-oriented list view.
  - `/sdr/lists/[id]`: detail (companies, contacts, status) for execution.
- **Company & contact detail**:
  - `/sdr/companies/[id]`, `/sdr/contacts/[id]`: deep dive into one account or person with full activity history and next steps.
 - **Implementation details**:
  - All these views rely on mission scoping and SDR assignments so SDRs only see the projects and lists they are assigned to.
  - Company and contact pages surface actions, opportunities, and email threads in one place with quick actions to create new calls/emails or move deals forward.
 - **APIs**:
  - `GET /api/sdr/projects` – list of missions/projects assigned to the SDR.
  - `GET /api/projects/:id` – detail view of a specific project, including lists and activity.
  - `GET /api/sdr/lists` / `GET /api/lists/:id` – list views tailored to the SDR.
  - `GET /api/companies/:id` / `PATCH /api/companies/:id` – company detail and updates.
  - `GET /api/contacts/:id` / `PATCH /api/contacts/:id` – contact detail and updates.
  - `GET /api/actions` – activity timeline for a given company/contact.

### Comms & Notifications – `/sdr/comms`, `/sdr/notifications`

- **Comms**:
  - SDR-specific communication hub (chat/threads tied to missions and clients).
- **Notifications**:
  - Personal notifications: new assigned missions, planning changes, hot leads, callbacks.
 - **APIs**:
  - `GET /api/comms/threads` / `GET /api/comms/threads/:id` – threads relevant to the SDR.
  - `POST /api/comms/threads/:id/comments` – post internal comments.
  - `GET /api/notifications` / `PATCH /api/notifications/:id` – personal notifications for the SDR.

### Settings – `/sdr/settings/voip`

- **Purpose**: Configure VoIP/call settings (device, number, integration).
 - **APIs**:
  - `GET /api/voip/config` – read current VoIP configuration for the user.
  - `PATCH /api/voip/config` – update VoIP settings (provider, device, preferences).

---

## Client Portal (`/client/portal`)

Clients see what’s happening on their missions, give feedback, and access shared assets.

### Portal Home – `/client/portal`

- **Purpose**: Overview of performance and missions from the client’s point of view.
- **Data**:
  - Aggregated KPIs, upcoming meetings, key notifications, and shortcuts to reporting and files.
 - **Implementation details**:
  - Located at `app/client/portal/page.tsx`, it uses the logged-in client user’s `clientId` to scope all data.
  - KPIs and upcoming items are derived from the same stats and meeting data managers see, but filtered to that client only.
 - **APIs**:
  - `GET /api/client/me/settings` – client user profile and preferences.
  - `GET /api/client/reporting` – high-level KPIs for the client.
  - `GET /api/client/meetings` – upcoming meetings for quick view.
  - `GET /api/client/files` – recently shared files.
  - `GET /api/client/email-activity` – recent relevant email activity.

### Reporting – `/client/portal/reporting`, `/client/portal/reporting/export`

- **Main reporting**:
  - `/client/portal/reporting`: dashboards for booked meetings, pipeline, and mission performance.
  - Filters by date range, mission, and channel.
- **Export**:
  - `/client/portal/reporting/export`: CSV/Excel export of key report data for offline analysis.
 - **Implementation details**:
  - Reporting views use optimized queries to aggregate meetings, opportunities, and actions per mission/channel within a date range.
  - The export endpoint streams a file that matches the on-screen filters so clients can reconcile with their own CRMs.
 - **APIs**:
  - `GET /api/client/reporting` – main metrics per mission and channel for a client.
  - `GET /api/client/reporting/export` – CSV/Excel export of reporting data.
  - `POST /api/client/reporting/share` – create new `SharedReportLink` tokens for external sharing.
  - `GET /api/client/reporting/pdf` – generate on-demand PDF reports.

### Meetings – `/client/portal/meetings`

- **Purpose**: Full client-facing interface to all booked meetings.
- **Behavior**:
  - Lists past and upcoming meetings with filtering by mission, SDR, date, and outcome.
  - Lets clients open meeting details and submit `MeetingFeedback` (quality, notes, status).
  - Integrates with shared reporting links and client notifications.
 - **Implementation details**:
  - Implemented in `app/client/portal/meetings/page.tsx` as a large client component with rich filtering, search, and detail drawers.
  - Reads meetings and feedback via `/api/client/meetings`-style endpoints scoped by client; posting feedback writes to `MeetingFeedback` linked to the underlying `Action`/meeting record.
  - Also powers shared read-only links via `/app/shared/report/[token]/page.tsx`, so external stakeholders can see a subset of the same data.
 - **APIs**:
  - `GET /api/client/meetings` – list all meetings for the client, with filters and pagination.
  - `POST /api/client/meetings/:id/feedback` – create or update `MeetingFeedback` for a given meeting.
  - `GET /api/clients/:id/meetings` – cross-link used when navigating from manager/client views.
  - `GET /api/shared/report/:token` – shared reporting token endpoint used by `/shared/report/[token]`.

### Email – `/client/portal/email`

- **Purpose**: Client-facing view of email conversations relevant to them (e.g., leads forwarded, summaries).
 - **APIs**:
  - `GET /api/client/email-activity` – list emails, summaries, and forwards relevant to the client.
  - `GET /api/email/threads/:id` – thread details when drilling in.

### Files – `/client/portal/files`

- **Purpose**: Access to all documents shared with the client (call recaps, decks, scripts, reports).
 - **Implementation details**:
  - Uses the same `File`/`Folder` schema as manager views but filtered to files marked as shared with the client.
  - Soft delete ensures that removing a file from the portal does not immediately delete it from the system.
 - **APIs**:
  - `GET /api/client/files` – list files shared with the client.
  - `GET /api/client/files/:id` – get file metadata or download link.
  - `DELETE /api/client/files/:id` – unshare (soft-remove) a file from the portal.

### Notifications – `/client/portal/notifications`

- **Purpose**: Shows updates important for the client (meeting booked/cancelled, new reports, planning changes).
 - **APIs**:
  - `GET /api/notifications` – notifications scoped to client-role users.
  - `PATCH /api/notifications/:id` – mark as read/dismissed from the portal.

### Settings – `/client/portal/settings`

- **Purpose**: Client account settings (company info, booking URL, notification preferences).
 - **APIs**:
  - `GET /api/client/me/settings` – read current settings.
  - `PATCH /api/client/me/settings` – update notification preferences and user-level options.
  - `PATCH /api/clients/:id` – update client-level fields like company info and booking URL.

### Help – `/client/portal/aide`

- **Purpose**: Help center and documentation for how to use the portal and interpret metrics.
 - **APIs**:
  - (Static or CMS-powered content; typically no write APIs. If backed by a CMS, it would call read-only endpoints to fetch help articles.)

---

## Data Model Recap (Prisma Schema – High Level)

- **Core entities**:
  - **Client**: top-level account (company). Has users, missions, onboarding, billing engagements, files, and prospect config.
  - **User**: people using the system. Key fields: `role` (`MANAGER`, `SDR`, `BUSINESS_DEVELOPER`, `CLIENT`, `DEVELOPER`), `clientId?`, and RBAC permissions.
  - **ClientOnboarding**: one-to-one with `Client`. JSON fields for ICP, scripts, launch planning.
  - **Mission**: central project per client, with channels, dates, contract days, and playbook JSON.
  - **SDRAssignment**: join table linking `Mission` and SDR users.
  - **Campaign`, `List`, `Company`, `Contact`, `Action`, `Opportunity`**: execution layer under missions for outbound activity and pipeline.
- **Planning entities**:
  - **MissionPlan**: weekly pattern (days of week, time preferences, assigned SDRs).
  - **MissionMonthPlan**: monthly target days per mission, with status and default working days/hours.
  - **SdrDayAllocation**: per-SDR allocations under a month plan, with `allocatedDays` and `scheduledDays`.
  - **ScheduleBlock**: concrete calendar block (date, start/end) for an SDR on a mission.
  - **SdrMonthCapacity**: effective available days per SDR per month.
  - **SdrAbsence**: time off/reduced availability entries.
  - **PlanningConflict**: stored issues (overload, missing SDR, unscheduled allocations), with types and severities.
- **Prospects**:
  - **ProspectSource**, **ProspectProfile**, **ProspectRule**, **ProspectDecisionLog**, **ProspectEvent**, **ProspectPipelineConfig**: configurable pipeline from raw leads to routed missions/SDRs.
- **Billing**:
  - **BillingClient**, **Engagement**, **Invoice**, **Offer** and related enums for invoice status and engagement lifecycle.
- **Files & Comms**:
  - **File**, **Folder**, **SharedReportLink**, communication threads, email entities, and integration imports (e.g. Leexi).

At the center of everything is **Mission**: it ties together **Client**, **planning entities**, **execution (campaigns, lists, actions, opportunities)**, and **reporting**.

---

## Tech Stack

- **Frontend**:
  - **Next.js (App Router)** with **React** and **TypeScript**.
  - Modern UI with Tailwind CSS, shadcn-inspired components, and `lucide-react` icons.
  - Client components for rich dashboards (Recharts for charts, animated counters, drawers, modals).
- **Backend**:
  - Next.js **route handlers** under `app/api/*` (REST-style).
  - Common helpers for authentication, RBAC, and error handling in `lib` (e.g. `requireRole`, `withErrorHandling`).
- **Database & ORM**:
  - **PostgreSQL** with **Prisma** (`prisma/schema.prisma`, `prisma/migrations/*`).
  - Rich enum-driven workflows (onboarding, actions, prospects, planning, billing).
- **Auth & Permissions**:
  - Session-based auth (NextAuth-style) with user roles and a granular permission system (`Permission`, `RolePermission`, `UserPermission`).
- **Integrations**:
  - Email sending/receiving (mission-linked mailboxes and templates).
  - Leexi call recap imports to seed playbooks and onboarding.
  - Calendar/meeting integration surfaced through meetings and client feedback.

This should give you a **narrative tour**: managers configure clients and missions, planners turn missions into concrete SDR schedules, SDRs execute from their `/sdr` space, and clients monitor everything through the portal.

