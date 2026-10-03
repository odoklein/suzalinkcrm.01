# Polymet.ai Design Prompt — Captain Prospect CRM (100x Better)

Copy everything below the line into Polymet.ai to get a full redesign of our CRM.

---

## Product

**Captain Prospect** is a B2B outbound sales CRM for French companies. We run **prospection campaigns** (calls, emails, LinkedIn) for **clients**: SDRs work on **missions** (client + channel + period), call/email **contacts** in **lists**, log **actions** (result, note), book **RDVs** (meetings), and managers track performance and billing. There is also a **client portal**, a **Business Developer** role (client onboarding, portfolio), and a **Developer** role (internal projects/tasks). **All UI is in French.**

## User roles and main flows

1. **Manager** — Dashboard (KPIs, leaderboard, missions), Listing (prospects/contacts), Missions (create/edit, assign SDRs), Appels (call overview), Clients, Emails (sequences, templates, mailboxes, analytics), Performance (team stats), Planning (SDR schedules), Projets, Réglages (users), Facturation (offres, engagements, factures), Fichiers.
2. **SDR** — Accueil, **Appeler** (main flow: next contact to call, script, log result, book RDV), Rappels, Historique, Mes RDV, Mes emails, Emails envoyés, Messages, Projets.
3. **Business Developer (BD)** — Accueil, Mes clients, Missions, Appeler/Rappels/Historique (same as SDR), Opportunités, Nouveau client, Messages, Mon profil.
4. **Client** — Portal: Accueil, Mes RDV, Résultats, Messages, Contacter, Mon Email, Mes Fichiers.
5. **Developer** — Dashboard, Projets, Tâches, Intégrations, Paramètres.

**Critical flow to optimize:** SDR “Appeler” — one screen to see next contact (company + contact + script), log call result (NO_RESPONSE, BAD_CONTACT, INTERESTED, CALLBACK_REQUESTED, MEETING_BOOKED, etc.), add note, optionally book RDV (client booking URL), then get next contact. Speed and zero friction here is top priority.

## Core domain (simplified)

- **Client** → has **Missions** (name, channel: CALL/EMAIL/LINKEDIN, dates), **Engagements** (billing contract), **Lists** (SUZALI/CLIENT/MIXED).
- **Mission** → has **Campaigns** (ICP, pitch, script), **Lists** (companies), **SDR assignments**, **team lead**.
- **List** → **Companies** → **Contacts**. Contacts get **Actions** (channel, result, note, timestamp).
- **Action results:** NO_RESPONSE, BAD_CONTACT, INTERESTED, CALLBACK_REQUESTED, MEETING_BOOKED, MEETING_CANCELLED, DISQUALIFIED, etc. **Priorities:** CALLBACK, FOLLOW_UP, NEW, RETRY, SKIP.
- **Billing:** **Offre** (template: fixe mensuel €, prix/RDV €) → **Engagement** (client, dates, overrides) → **Facture** (monthly, draft → validée → envoyée → payée). RDV count per mission rolls up to invoice variable amount.
- **Prospect pipeline:** intake → normalize → validate → enrich → dedupe → score → route → activate (with rules and review).
- **Email hub:** Mailboxes, Sequences, Templates, Threads, Analytics.
- **Comms:** Internal channels/groups, threads, messages, mentions.
- **Projects/Tasks:** For internal dev work (status, priority, assignee, time entries).

## What we have today

- Next.js 16, React 19, Prisma (PostgreSQL), NextAuth, Tailwind, Recharts, custom UI (cards, data tables, drawers, modals).
- Role-based nav (grouped sections: Prospection, Suivi, Équipe, Réglages, etc.).
- Manager dashboard: date range, KPIs (actions, meetings, conversion), result breakdown, leaderboards, mission summaries, recent activity.
- SDR action page: mission/list selector, “next action” card (contact + company + script), queue table, result buttons, note, booking modal, contact/company drawers, filters.
- Billing: Offres list/CRUD, Engagements per client, Factures list + detail (line items: forfait + RDV × prix), status workflow.
- French labels everywhere; Factur-X / e-invoicing considerations for 2026.

## What we want (100x better)

Design a **complete UX/UI overhaul** so that:

1. **Clarity** — Any role understands in &lt; 5 seconds where they are and what to do next. Obvious hierarchy, no “dashboard soup.” Clear separation: operational (do the work) vs analytical (see results) vs configuration (settings, billing).
2. **Speed** — SDR “Appeler” is **one-glance, one-click** where possible: next contact + script visible without scrolling, result logging in 1–2 clicks, next contact loads instantly. Managers find any client, mission, or invoice in &lt; 3 clicks.
3. **Delight** — Cohesive visual system (not “generic SaaS”): typography, color, spacing, and micro-interactions that feel premium and calm. Thoughtful empty states, loading states, and success feedback. Accessible (contrast, focus, keyboard).
4. **Scale** — Layouts and patterns that work with 10 missions or 500: tables that stay scannable, filters that are visible and fast, lists that don’t overwhelm. Mobile-friendly where it matters (e.g. SDR on the go).
5. **Consistency** — Reusable patterns for: list/detail, create/edit (drawer vs modal vs page), filters, status badges, date ranges, and “primary action” placement. Same mental model for Manager, SDR, BD, Client, Developer.

## Constraints

- **Language:** All copy in **French** (including buttons, labels, empty states, errors).
- **Tech:** We will implement in **Next.js + Tailwind**; prefer designs that translate to components (no one-off artboards only).
- **Billing:** Keep strict invoice status flow (Brouillon → Validée → Envoyée → Payée) and engagement lifecycle (Brouillon → Actif → Expiré → Renouvelé/Archivé/Résilié). Factur-X-ready invoice layout.
- **Permissions:** Some areas are role- or permission-gated; design should not assume everyone sees everything.

## Output we need from you

1. **Design system** — Tokens (colors, type scale, spacing, radii), component patterns (buttons, inputs, cards, tables, badges, nav), and when to use drawer vs modal vs full page.
2. **Information architecture** — Refined sitemap/nav structure for Manager, SDR, BD, Client, Developer (grouped sections, naming, key entry points).
3. **Key screens (wireframes or high-fidelity)**  
   - Manager: Dashboard, Listing (prospects/contacts), Mission detail, Facturation (Offres, Engagements, Factures list + détail).  
   - SDR: Appeler (main call screen), Rappels, Historique.  
   - Client: Portal home, Mes RDV, Résultats.  
   Optional: BD dashboard, Developer dashboard, Email sequences list.
4. **SDR “Appeler” flow** — Step-by-step UX: how the next contact is presented, how result is logged, how RDV is booked, how “next” is triggered. Aim for **minimum steps and maximum speed**   .   
5. **Billing UX** — How Offres, Engagements, and Factures connect visually (e.g. from Client → Engagement → Factures), and how invoice detail shows forfait + RDV breakdown + per-mission RDV.
6. **Responsive and states** — Which screens are desktop-first vs mobile-friendly; empty states, loading, and error states for main views.

Make it **100x better**: clearer, faster, and more enjoyable to use every day. We will implement the best of your proposal in our codebase.
