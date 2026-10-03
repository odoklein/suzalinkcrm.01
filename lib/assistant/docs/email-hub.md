---
routes: ["/manager/emails", "/manager/email/mailboxes", "/manager/email/sequences", "/manager/email/templates", "/sdr/emails", "/manager/emails/analytics", "/manager/emails/sent"]
roles: ["MANAGER", "SDR", "BOOKER", "BUSINESS_DEVELOPER"]
keywords: ["email", "mailbox", "boîte mail", "séquence", "sequence", "template", "modèle", "Gmail", "Outlook", "IMAP", "SMTP", "connect mailbox", "warmup", "health", "santé mailbox", "send email", "envoyer email", "bounce", "deliverability", "open rate", "taux ouverture", "email hub", "inbox", "boîte de réception", "enroll", "inscrire", "sequence step", "étape"]
priority: 9
---

# Email Hub

## Overview

The Email Hub manages all email activity: connecting mailboxes, sending outbound emails, running automated sequences, and tracking engagement.

**Main entry point (Manager):** Sidebar → **Suivi → Email Hub** → `/manager/emails`

---

## Email Hub Dashboard (`/manager/emails`)

The dashboard shows at a glance:
- **Health Pulse strip**: Active mailboxes | Warming mailboxes | Emails sent today | Overall open rate
- **Sequence Performance panel**: Top sequences with sparklines, enrollment count, open/reply rates
- **Activity Feed**: Recent email events (sent, opened, replied, clicked, bounced)
- **Mailbox Health Grid**: Each mailbox's health score, sync status, warming progress
- **Pending Actions**: Replies needing review, bounced emails, issues requiring attention

---

## Connecting a Mailbox

### Add Gmail
1. Go to `/manager/email/mailboxes` → click **"+"**
2. Select **Gmail**
3. Click **Connecter avec Google** → complete OAuth flow
4. Grant all requested permissions (read, send, manage)
5. Mailbox appears with status **Connecté**

### Add Outlook / Office 365
1. Go to `/manager/email/mailboxes` → click **"+"**
2. Select **Outlook / Microsoft 365**
3. Click **Connecter avec Microsoft** → complete OAuth flow
4. Grant permissions
5. Mailbox appears with status **Connecté**

### Add Custom IMAP/SMTP
1. Go to `/manager/email/mailboxes` → click **"+"**
2. Select **Custom IMAP**
3. Fill IMAP settings: host, port (993), username, password
4. Fill SMTP settings: host, port (587 or 465), username, password, SSL/TLS
5. Click **Tester la connexion** → verify it's successful
6. Click **Enregistrer**

---

## Mailbox Settings

After connecting, configure each mailbox:
- **Daily send limit** — max emails sent per day (stay under 200/day for new mailboxes)
- **Warmup settings** — gradual ramp-up to build sender reputation
- **Signature** — email signature appended to all outbound
- **Tracking domain** — custom tracking domain for opens/clicks

---

## Mailbox Health Scores

Each mailbox has a health score (0–100):
- **Green (80–100)**: Healthy, good deliverability
- **Yellow (50–79)**: Some issues, monitor closely
- **Red (0–49)**: Deliverability problems, may be disabled

Health degrades when: bounce rate is high, spam complaints, consecutive send failures.

If a mailbox is disabled: go to mailbox settings → resolve the issue → re-enable manually.

---

## Email Sequences

Sequences automate multi-step outbound email campaigns.

### Create a Sequence
1. Go to `/manager/email/sequences/new`
2. Set:
   - **Name** — descriptive name for the sequence
   - **Mailbox** — which mailbox sends these emails
   - **Stop on reply** — yes/no (recommended: yes)
   - **Stop on bounce** — yes/no (recommended: yes)
   - **Track opens / Track clicks** — yes/no
3. Add **steps** (emails in the sequence):
   - Click **Ajouter une étape**
   - Set delay: "Send X days after previous step"
   - Select or create an email template for this step
4. Set status to **ACTIVE** → sequence is ready to use

### Sequence Statuses
| Status | Meaning |
|--------|---------|
| DRAFT | Being built, not active yet |
| ACTIVE | Running — new enrollments are processed |
| PAUSED | No new emails sent, enrollments preserved |
| ARCHIVED | Ended, read-only |

### Enroll Contacts in a Sequence
1. Go to the sequence detail (`/manager/email/sequences/[id]`)
2. Click **Inscrire des contacts** (Enroll contacts)
3. Select contacts from a list or campaign
4. Click **Confirmer**
5. Contacts receive step 1 immediately (or at configured delay)

### Enrollment Statuses
| Status | Meaning |
|--------|---------|
| ACTIVE | Contact is in the sequence, emails being sent |
| PAUSED | Temporarily paused for this contact |
| COMPLETED | All steps completed |
| REPLIED | Contact replied — sequence stopped |
| BOUNCED | Email bounced — sequence stopped |
| UNSUBSCRIBED | Contact opted out |
| MANUAL_EXIT | Manually removed from sequence |

---

## Email Templates

Create reusable email templates:
1. Go to `/manager/email/templates` → click **"+"**
2. Fill: **Name**, **Subject line** (supports variables like `{{first_name}}`), **Body** (rich text editor)
3. Add variables: `{{first_name}}`, `{{company}}`, `{{title}}` — auto-filled from contact data
4. Click **Sauvegarder**

Templates are then available when building sequence steps.

---

## Sending an Individual Email

### From SDR Email Hub
1. Go to `/sdr/emails`
2. Click **Composer** (Compose)
3. Select recipient (from contact database), subject, body
4. Choose mailbox to send from
5. Click **Envoyer**

### Quick-Send from Call Screen
While on the call interface (`/sdr/action`):
1. After selecting a result, click **Envoyer un email**
2. A quick-compose modal opens pre-filled with the contact
3. Select a template or type freely
4. Click **Envoyer**

---

## Email Analytics (`/manager/emails/analytics`)

Metrics available:
- **Open rate** — % of sent emails that were opened
- **Click rate** — % with at least one link clicked
- **Reply rate** — % that received a reply
- **Bounce rate** — % that bounced (hard or soft)
- Charts: over time (daily/weekly), per sequence, per mailbox

---

## Sent Email Archive (`/manager/emails/sent`)

View all sent emails with:
- To address, subject, sent date, status, open count, click count
- Search by recipient or subject
- Filter by mailbox, date range, status
- Option to resend failed emails

---

## Email Sync

Emails sync automatically via:
- **Gmail**: Push notifications (real-time) via webhook
- **Outlook**: Subscription-based (near real-time)
- **IMAP**: Periodic polling

To force a manual sync:
1. Go to `/manager/email/mailboxes`
2. Click the mailbox row → click **Synchroniser maintenant**

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Mailbox shows red health score | Open mailbox settings → check error log → usually requires reconnecting OAuth or fixing SMTP credentials |
| Emails not sending | Check mailbox daily send limit → check if mailbox was disabled → check SMTP credentials |
| Sequence emails not arriving | Verify sequence is ACTIVE → verify contact's enrollment is ACTIVE → check mailbox health |
| Contact not receiving sequence | Check enrollment status → may have BOUNCED or UNSUBSCRIBED |
| Gmail OAuth expired | Go to mailboxes → reconnect Gmail with fresh OAuth flow |
| Open tracking not working | Check tracking pixel not blocked by recipient's email client → this is normal for some clients |
