---
routes: ["/sdr/action", "/sdr/callbacks", "/sdr/history", "/sdr/meetings", "/sdr", "/sdr/dashboard", "/manager/prospection", "/manager/rdv"]
roles: ["SDR", "BOOKER", "MANAGER", "BUSINESS_DEVELOPER"]
keywords: ["call", "appel", "action", "log", "result", "résultat", "disposition", "callback", "rappel", "meeting", "rdv", "note", "history", "historique", "book meeting", "réserver", "prendre rdv", "prospecter", "travailler", "démarrer", "start", "next contact", "prochain", "qualification", "MEETING_BOOKED", "CALLBACK_REQUESTED", "NO_RESPONSE", "INTERESTED", "BAD_CONTACT"]
priority: 10
---

# SDR Call & Action Workflows

## Starting a Session

1. Log in → auto-redirects to `/sdr` (SDR dashboard)
2. Review **stats cards**: calls today, meetings booked, callbacks pending
3. Check **callbacks tab** first for any overdue callbacks
4. Click **Appeler** in the sidebar → goes to `/sdr/action`

---

## The Call Interface (`/sdr/action`)

The call screen auto-loads the **next contact** from your queue based on mission assignment and priority.

### What you see:
- **Contact name, title, company** with phone number highlighted
- **Company details**: industry, website, size
- **Previous actions** on this contact (history panel on right)
- **Campaign script** — intro, discovery, objections, closing (expandable)
- **Result picker** (disposition buttons)
- **Note field**
- **Callback scheduler** (appears when CALLBACK_REQUESTED is selected)

### Call Workflow:
1. Review contact info and script
2. Make the call (dial the number shown)
3. Select the **result** (disposition) from the buttons:

| Result | When to use |
|--------|------------|
| **MEETING_BOOKED** | Contact agreed to a meeting — fill meeting details |
| **CALLBACK_REQUESTED** | Contact wants to be called back later |
| **INTERESTED** | Positive signal but no meeting yet |
| **NO_RESPONSE** | No answer, voicemail, line busy |
| **BAD_CONTACT** | Wrong number, person left company |
| **DISQUALIFIED** | Out of ICP, explicitly not interested |
| **RELANCE** | Follow-up scheduled |

4. Add a **note** — describe the conversation (this is visible to managers)
5. If **MEETING_BOOKED**: fill the meeting date, time, type (video/phone/on-site), and address or join URL
6. If **CALLBACK_REQUESTED**: set the callback date and time
7. Click **Valider** → action saved, next contact loads automatically

---

## Booking a Meeting

When a contact agrees to a meeting:

1. Select result: **MEETING_BOOKED**
2. A form expands:
   - **Date** — pick the meeting date
   - **Heure** — meeting time
   - **Type** — Video call / Phone / In-person
   - **Adresse / Lien** — meeting room or video link
   - **Notes** — any relevant context
3. Click **Valider**
4. Meeting appears in **Mes RDV** (`/sdr/meetings`) and in manager's **SAS RDV** (`/manager/rdv`)

---

## Managing Callbacks (`/sdr/callbacks`)

This page shows all contacts where result was CALLBACK_REQUESTED.

### Columns:
- Contact name, company, channel
- Scheduled callback date/time
- Original note

### Actions per callback:
- **Rappeler** — opens the call interface for this contact
- **Ignorer** — skip/dismiss the callback
- **Historique** — view full action history for this contact

### Filters:
- By mission
- By date range
- By status (upcoming, overdue, done)

> 💡 Always check callbacks at the start of each session — overdue callbacks hurt conversion rates.

---

## Viewing Action History (`/sdr/history`)

All your past logged actions.

### Filters:
- **Date range presets**: Last 7 days, Last 4 weeks, This month, Last 6 months, All time
- **Result type**: Filter by specific dispositions (MEETING_BOOKED, etc.)
- **Contact name** search
- **Free text** search

### Each row shows:
- Date/time of action
- Contact name + company
- Channel (CALL/EMAIL/LINKEDIN)
- Result badge (color-coded)
- Duration (for calls)
- Note snippet

Click a row to expand and see the full note, or click the contact name to open the ContactDrawer.

---

## My Meetings (`/sdr/meetings`)

Shows all meetings you've booked.

- **Status**: Pending confirmation / Confirmed / Completed / Cancelled
- Manager confirms meetings in `/manager/rdv`
- After the meeting: manager adds feedback (outcome, recontact preference)

---

## Tips for Note Quality

Good notes make coaching easier and improve the team:

✅ **Good note**: "Spoke to Marketing Director. Interested in Q3 pilot but budget not confirmed until July. Requested callback week of July 14."

❌ **Bad note**: "Rappelé" / "No" / "Busy"

Notes should include:
- Who you spoke to (if different from contact)
- Key signal (positive/negative/neutral)
- Any specific objection raised
- Next step context (why this callback date)

---

## Viewing Assigned Lists (`/sdr/lists`)

- Shows all prospect lists linked to your missions
- Each list shows: type, mission, companies count, contacts count, progress %
- Click a list → see all contacts with status indicators
- Click a contact row → opens **ContactDrawer** with full profile + action buttons

---

## My Schedule (`/sdr/calendar`)

- Shows your assigned schedule blocks by day/week
- Each block: mission name, time range, color-coded by mission
- Read-only — only managers edit the schedule
- Use this to plan your calling sessions day by day

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| No contacts loading on call screen | Check you have active schedule blocks today at `/sdr/calendar` and active lists assigned |
| Wrong mission loading | Check your current schedule block — the mission is determined by today's planning allocation |
| Can't find a past action | Go to `/sdr/history` → clear all filters → search by contact name |
| Meeting not showing up | Check `/sdr/meetings` → if not there, it may not have been saved — re-log the action |
| Callback not showing | Check `/sdr/callbacks` filter — may be filtered to "upcoming only" — clear date filter |
