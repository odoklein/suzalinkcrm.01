# General Email Setup for Clients (Spam Prevention)

To ensure that your clients can connect their custom email accounts (IMAP/SMTP/Google/Outlook) without their emails going to spam, follow these 3 critical steps.

## 1. DNS Configuration (The Foundation)

Before connecting the email to the CRM, the client **MUST** configure their domain DNS records. This is the #1 reason for spam issues.

They need to log into their domain provider (GoDaddy, Namecheap, Hostinger, OVH, etc.) and ensure these records exist:

### A. SPF (Sender Policy Framework)

This tells the world which servers are allowed to send email for them.

- **Type:** `TXT`
- **Name:** `@` (or blank)
- **Value:** `v=spf1 include:_spf.google.com include:spf.protection.outlook.com ~all`
  - _Note:_ If they use GSuite, include google. If Office365, include outlook. If they use a custom SMTP server (like Titan or Hostinger), they must include that specific host (e.g., `include:spf.titan.email`).

### B. DKIM (DomainKeys Identified Mail)

This adds a digital signature to emails.

- The client must generate this in their email provider's admin panel (GSuite Admin, Microsoft 365 Admin, or Hostinger Email panel).
- It will provide a specific `TXT` record Name and Value to add to DNS.

### C. DMARC

This tells receiving servers what to do if SPF/DKIM fails.

- **Type:** `TXT`
- **Name:** `_dmarc`
- **Value:** `v=DMARC1; p=none; rua=mailto:admin@client-domain.com`
  - Start with `p=none` (monitoring mode). Later move to `p=quarantine`.

---

## 2. Custom Tracking Domain (The "Captain Prospect CRM" Fix)

By default, the CRM tracks "Opens" using a shared pixel URL (e.g., `captainprospect-crm.vercel.app`).
**Problem:** If Client A sends a spammy campaign, Google might block `captainprospect-crm.vercel.app`. Now Client B's legitimate emails also go to spam because they use the same link.

**Solution: Whitelabel Tracking**
Every client should use their own transparent domain for tracking.

### Step 2.1: Client DNS Setup

The client adds a CNAME record:

- **Type:** `CNAME`
- **Name:** `track` (or `crm`, `link`)
- **Target:** `captainprospect-crm.vercel.app` (Your app's main domain)

### Step 2.2: Hosting Configuration (Vercel)

**You (The Admin) must add this domain to Vercel:**

1.  Go to Vercel Dashboard -> Project -> Settings -> Domains.
2.  Add `track.client-domain.com`.
3.  Vercel will verify the CNAME.

### Step 2.3: CRM Configuration

1.  Go to the Client's Mailbox settings in your CRM.
2.  Find the field **"Tracking Domain"**.
3.  Enter: `https://track.client-domain.com`
4.  Save.

Now, when this mailbox sends an email, the hidden pixel will look like:
`<img src="https://track.client-domain.com/api/email/tracking/open?id=..." />`

Google looks at this and sees the link matches the sender's domain. **Trust Score: High.**

---

## 3. Warmup (Gradual Ramp-Up)

Even with perfect DNS, sending 500 emails on Day 1 will hit spam.

- **Week 1:** Max 20-30 emails/day.
- **Week 2:** 50 emails/day.
- **Week 3:** 100 emails/day.

The CRM has a "Daily Limit" setting per mailbox. **Use it.** Set it to 20 initially and increase it manually every week.
