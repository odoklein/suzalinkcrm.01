# Captain Prospect CRM — What It Contains

## Roles & access
- **SDR** (Sales Development Rep): lists, contacts, actions, callbacks, calls, emails, opportunities, projects, internal comms.
- **Manager**: dashboard, missions, campaigns, lists, team, planning, prospects, email hub, billing, files, comms.
- **Client**: portal, results, meetings, contact, comms.
- **Business Developer (BD)**: clients, onboarding, missions, campaigns, projects, comms.
- **Developer**: dashboard, projects, tasks, integrations, settings, comms.

## Core sales engine
- **Clients** → **Missions** (channel: Call, Email, LinkedIn) → **Campaigns** (ICP, pitch, script) → **Lists** (SUZALI / CLIENT / MIXED) → **Companies** → **Contacts**.
- **Actions**: per contact/company, channel, result (NO_RESPONSE, INTERESTED, CALLBACK_REQUESTED, MEETING_BOOKED, etc.), notes, callback date.
- **In-app calls**: Call records (inbound/outbound), status, duration, recording; linked to User, Contact, Company, Campaign, Action.
- **Opportunities**: need summary, urgency, estimates, handoff; linked to Contact, Company, email threads.

## Email hub
- **Mailboxes**: Gmail/Outlook/Custom, OAuth, sync, warmup, throttling, tracking domain.
- **Threads & emails**: subject, participants, CRM links (client, mission, campaign, contact, opportunity), assignment, labels, SLA, sentiment/summary.
- **Sequences**: multi-step, scheduling, stop-on-reply/bounce, A/B steps; enrollments per contact.
- **Templates**: reusable (mission-linked for quick-send), variables, categories.

## Prospect orchestration
- **Sources**: Web form, CSV, API, partner feed, manual; per client, optional auto-activate and default mission.
- **Pipeline**: INTAKE → NORMALIZE → VALIDATE → ENRICH → DEDUPLICATE → SCORE → ROUTE → ACTIVATE (or HOLD/REJECT).
- **ProspectProfile**: normalized data, quality/confidence scores, assignment to mission/SDR, review workflow, activation → Contact/Company.
- **Rules**: configurable conditions and actions per step; decision logs for explainability.

## Projects & tasks
- **Projects**: owner, client, status, dates, color, members, milestones.
- **Tasks**: status, priority, assignee, due/start, estimates, time entries, subtasks, dependencies, comments, files.
- **Templates**: project templates with task structure for reuse.

## Internal communication
- **Channels**: Mission, Client, Campaign, Group, Direct, Broadcast.
- **Threads**: subject, status, participants, messages, mentions, attachments, reactions, read receipts; broadcast with audience and receipts.
- **Templates**: message templates with variables, shared or personal.

## Billing
- **Company issuer**: legal info, SIRET, RCS, bank (IBAN/BIC), payment terms, late penalty.
- **Billing clients**: legal details for invoicing.
- **Invoices**: items, HT/VAT/TTC, status (Draft → Validated → Sent → Paid), Factur-X PDF, e-reporting/PDP (EU 2026), credit notes.
- **Payments**: match with Qonto transactions, confirmation by user.

## Other
- **Files & folders**: hierarchy, mission/client/campaign/task links, Google Drive sync (bidirectional), versioning, soft delete.
- **Scheduling**: manager-assigned blocks (SDR + mission + date + time slot) for planning.
- **CRM activity**: per-user daily active time, sessions, leaderboards.
- **Notifications**: in-app notifications with type, link, read state.
- **Permissions**: role-based + user overrides (Permission, RolePermission, UserPermission).
- **Client onboarding**: status, onboarding data, scripts, target launch, completed by BD.

---

## UI & layout
- **App shell**: role-based sidebar (grouped sections: Accueil, Prospection, Suivi, Équipe, Réglages, etc.), collapsible, mobile menu; notification bell; global search modal; email pages use full-screen layout (no sidebar).
- **Role landing**: Manager → `/manager/dashboard`, SDR → `/sdr` (home), BD → `/bd/dashboard`, Developer → `/developer/dashboard`, Client → `/client/portal`.
- **Components**: Cards, Badges, Buttons, Drawers (contact, company, client, unified action), Modals (booking, quick email, onboarding), DataTable with sorting/filtering, Tabs, DateRangeFilter, charts (Recharts: Area, Pie, Line) for dashboards.
- **Drawers**: ContactDrawer and CompanyDrawer for view/edit fiches; UnifiedActionDrawer to log action (result, note, callback); open from lists, dashboard “my actions,” or action page.
- **Permissions**: Nav items gated by permission codes (e.g. `pages.dashboard`, `pages.missions`); PermissionProvider wraps app; unauthorized users redirected to `/unauthorized` or `/blocked`.

## Workflows
- **SDR call workflow**: Choose mission → “Appeler” (/sdr/action) → next-action queue (callback / follow-up / new) → contact/company card with script, booking URL, last action → dial or skip → UnifiedActionDrawer: result (NO_RESPONSE, INTERESTED, CALLBACK_REQUESTED, MEETING_BOOKED, etc.), note, optional callback date → next contact. Keyboard shortcuts (1–6) for quick result; Enter to validate.
- **Callbacks**: “Rappels” (/sdr/callbacks) lists contacts with callback due; open fiche or go to action page filtered by mission.
- **Manager setup**: Create client (BD or Manager) → onboarding (optional) → create mission (channel, dates) → create campaigns (ICP, pitch, script) → create/import lists (SUZALI/CLIENT/MIXED) → assign SDRs → planning blocks (SDR + mission + date + slot).
- **Prospect pipeline**: Source receives data → INTAKE → NORMALIZE → VALIDATE → ENRICH → DEDUPLICATE → SCORE → ROUTE → review queue or auto-activate → activate creates Contact/Company in list.
- **Client portal**: Login → dashboard (stats, missions, opportunities) → “Mes RDV” (meetings), “Résultats” (results), “Contacter” (support); optional onboarding modal (dismissible).

## Views by role
- **SDR**: Accueil (stats, active mission card, “my actions” list, weekly progress); Appeler (queue, contact card, action drawer, booking modal); Rappels; Historique; Mes RDV; Lists (mission/list picker, companies/contacts table, open contact/company drawer); Emails (inbox in new tab), Emails envoyés; Messages (comms); Projets.
- **Manager**: Accueil/dashboard (date range, KPIs, result breakdown, leaderboards, mission summary, recent activity); Listing (search/lists tabs, prospect-style listing); Missions (list, create, edit, mission detail); Appels (prospection view); Clients; Emails (mailboxes, sequences, templates, analytics); Messages; Performance (team); Planning (schedule blocks); Projets; Réglages (users); Facturation (issuer, billing clients, invoices); Fichiers; Prospects (sources, rules, review queue, sandbox).
- **Client**: Accueil (stats, opportunities, missions, CTA); Mes RDV; Résultats; Contacter; Messages (comms).
- **BD**: Accueil; Mes clients (portfolio); Missions; Appeler / Rappels / Historique (shared with SDR); Opportunités; Nouveau client; Messages; Mon profil.
- **Developer**: Dashboard; Projets; Tâches; Intégrations; Paramètres; Messages.
