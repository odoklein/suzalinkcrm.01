---
routes: ["/manager/analytics", "/manager/dashboard", "/manager/team", "/manager/analyse-ia", "/client/portal/reporting", "/shared/report"]
roles: ["MANAGER", "BUSINESS_DEVELOPER", "CLIENT"]
keywords: ["analytics", "stats", "statistiques", "dashboard", "rapport", "report", "performance", "conversion", "taux", "rate", "meeting", "rdv", "calls", "appels", "trend", "tendance", "leaderboard", "SDR ranking", "classement", "metrics", "métriques", "date range", "période", "weekly", "monthly", "hebdomadaire", "mensuel", "analyse", "AI analysis", "export", "PDF", "download"]
priority: 8
---

# Analytics, Reports & Dashboards

## Manager Dashboard (`/manager/dashboard`)

The main dashboard gives a real-time snapshot of all sales activity.

### Stats Cards (top row)
- **Total actions** — all calls/emails/LinkedIn this period
- **Meetings booked (RDV)** — confirmed meetings
- **Opportunities** — contacts marked as interested
- **Active missions** — currently running
- **Conversion rate** — meetings ÷ actions (%)

### Date Range Filter
Click the date range picker (top right) to change the period:
- Last 7 days
- Last 4 weeks
- This month / Last month
- Last 6 months / Last 12 months
- Month-to-date / Quarter-to-date / Year-to-date
- All time

All stats and charts update when you change the date range.

### Charts & Panels
- **Result breakdown pie chart**: visual distribution of call results
- **Leaderboard** (two views): top SDRs by calls and by RDVs (with sparkline mini-charts)
- **Recent activity feed**: live feed of call/email/meeting events
- **Mission summary cards**: each active mission's SDR count, actions this period, meetings booked, weekly RDV goal progress bar

---

## Analytics Page (`/manager/analytics`)

More detailed breakdown than the dashboard.

**Navigate to:** Sidebar → **Suivi → Statistiques** → `/manager/analytics`

### Available Breakdowns
- Actions by result type (bar/pie chart)
- Actions by channel (CALL / EMAIL / LINKEDIN)
- Conversion funnel: contacts reached → interested → meeting booked
- Trends over time (daily, weekly)
- Breakdown by SDR
- Breakdown by mission
- Breakdown by campaign

### Filters on Analytics Page
- **Date range** — same presets as dashboard
- **Mission** — filter to specific mission
- **SDR** — filter to specific team member
- **Channel** — filter by communication channel
- **Campaign** — filter to specific campaign

### AI-Powered Recap
At the top of analytics: click **Générer un récap IA** → system summarizes the period's key insights (what worked, what to improve, unusual patterns).

---

## Team Performance (`/manager/team`)

**Navigate to:** Sidebar → **Équipe → Performance** → `/manager/team`

Shows each SDR with:
- **Online status** (green dot = currently online)
- **Calls today** (live, auto-refreshing)
- **Calls this week** and **this month**
- **Average calls per hour** (efficiency metric)
- **Meetings booked** (weekly)
- **Conversion rate** (%)
- **Last activity** ("Active 5 minutes ago")
- **Current mission** (what they're working on right now)

### Sorting & Filtering
- Sort by: Performance / Activity / Name
- Filter by: Online / Offline / Busy / Away
- Search by SDR name
- Toggle: Grid view / List view

### Identifying Low-Activity SDRs
- Look for SDRs with **gray status dot** (offline during work hours)
- Sort by **Activity** → inactive SDRs float to bottom
- "Actif il y a >2h" = not working in CRM for 2+ hours

### Download Team Report
Click **Télécharger** (top right of team page) → exports team stats to CSV or PDF.

---

## SDR Detail View

Click any SDR card on `/manager/team` → opens a detail drawer showing:
- Full stats: calls, meetings, conversion per period
- Last 7 days activity timeline
- Current mission and schedule
- Absence schedule

---

## AI Analysis (`/manager/analyse-ia`)

**Navigate to:** Sidebar → **Suivi → Analyse IA** → `/manager/analyse-ia`

Runs AI analysis on campaign data:
1. Click **Lancer une analyse** → system analyzes recent actions, meetings, and patterns
2. Results show: key insights, performance signals, recommendations
3. Analysis history is saved — click any past analysis to review

Great for: weekly team reviews, client reporting prep, identifying coaching opportunities.

---

## Client Reports

### Generate a Report (Manager)
1. Go to `/manager/analytics` → apply filters (date range, mission)
2. Click **Exporter en PDF** → downloads a formatted PDF report
3. Or use the **client portal** for ongoing access

### Shared Report Links
1. Create a shareable link from `/manager/clients/[id]` → **Partager un rapport**
2. Configure: date range, missions to include, expiry date
3. Share the link → client accesses `/shared/report/[token]` (no login required)
4. Useful for sending reports via email without giving portal access

---

## Client Portal Reports (`/client/portal/reporting`)

Clients with portal access see their own reports:
1. Log in as CLIENT → go to **Rapports** in sidebar
2. Select date range (or use default which is current month)
3. Optionally compare with previous period
4. Click **Générer**
5. To save as PDF: click **Imprimer** → browser Print → Save as PDF

### What clients see in reports:
- Total actions (calls made on their behalf)
- Meetings booked count
- Contact rate (% of contacts reached)
- Week-by-week chart
- Per-mission breakdown (if multiple missions)
- Comparison with previous period (if selected)

---

## SDR Feedback (`/manager/sdr-feedback`)

**Navigate to:** Sidebar → **Équipe → Avis SDR** → `/manager/sdr-feedback`

SDRs submit daily feedback about their sessions. Manager sees:
- Quality of contacts in lists
- Objections encountered  
- Energy/morale notes
- Blockers

Use this to: identify list quality issues, adjust scripts, spot coaching needs.

---

## Key Metrics Explained

| Metric | Formula | Good benchmark |
|--------|---------|----------------|
| **Conversion rate** | Meetings ÷ Total actions | 3–8% for cold outbound |
| **Contact rate** | Reached ÷ Dialed | 15–30% for phone |
| **Show rate** | Attended ÷ Booked | 70–85% |
| **Actions/hour** | Actions ÷ Active hours | 8–15 for phone |
| **Callbacks pending** | Open callback actions | Should clear daily |

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Stats look wrong | Check date range filter — may include/exclude the period you expect |
| Mission not showing in analytics | Check mission is ACTIVE and within selected date range |
| SDR stats missing | The SDR may not have logged actions — check their history at `/manager/team` → detail view |
| PDF export fails | Try a narrower date range; large exports may time out |
| Client can't see their report | Check their account is ACTIVE and has CLIENT role → they access via `/client/portal` |
