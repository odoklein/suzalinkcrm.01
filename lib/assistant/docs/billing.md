---
routes: ["/manager/billing", "/manager/billing/invoices", "/manager/billing/engagements", "/manager/billing/clients", "/manager/billing/offres", "/manager/billing/settings"]
roles: ["MANAGER", "BUSINESS_DEVELOPER"]
keywords: ["billing", "facturation", "invoice", "facture", "payment", "paiement", "engagement", "contract", "contrat", "client billing", "TVA", "TTC", "HT", "crédit", "credit note", "avoir", "créer facture", "create invoice", "paid", "payé", "overdue", "en retard", "aging", "monthly revenue", "chiffre affaires", "line item", "ligne", "validate", "valider", "send invoice", "envoyer facture"]
priority: 7
---

# Billing & Invoicing

## Billing Hub Overview (`/manager/billing`)

**Navigate to:** Sidebar → **Admin Zone → Facturation** → `/manager/billing`

The billing dashboard shows:
- **Stats cards**: Total invoices | Active clients | Total HT | Total TTC | Draft | Validated | Sent | Paid | Cancelled | Overdue
- **Monthly revenue bar chart**: TTC by month for the last 12 months
- **Trend indicators**: This month vs last month (up/down arrows with %)
- **Recent invoices table**: Invoice number, Status, TTC, Dates
- **Aging buckets**: Current | 30+ days | 60+ days | 90+ days (shows overdue totals)
- **Status pie chart**: breakdown of invoice statuses

### Sub-tabs
From the billing hub, use the top tabs:
- **Factures** — all invoices
- **Engagements** — service contracts
- **Clients** — billing client profiles
- **Offres** — pricing packages
- **Paramètres** — billing configuration

---

## Creating an Invoice

1. Go to `/manager/billing/invoices` → click **"+"**
2. Fill invoice header:
   - **Client** — select from billing clients
   - **Date d'émission** — issue date (usually today or end of month)
   - **Date d'échéance** — due date (typically 30 days after issue)
   - **Type** — INVOICE (standard) or CREDIT_NOTE (avoir)
3. Add line items:
   - Click **Ajouter une ligne**
   - **Description** — service description (e.g. "Prospection téléphonique — Juin 2025")
   - **Quantité** — number of units (e.g. RDV count, or 1 for fixed fee)
   - **Prix unitaire HT** — unit price before tax
   - Totals auto-calculate: HT → TVA → TTC
4. Add multiple lines as needed
5. Choose action:
   - **Sauvegarder comme brouillon** — saves as DRAFT (editable)
   - **Valider** — locks the invoice (not editable after this)
   - **Envoyer** — sends to client by email

---

## Invoice Statuses

| Status | Meaning | What you can do |
|--------|---------|-----------------|
| DRAFT | Created, not finalized | Edit, Delete, Validate |
| VALIDATED | Locked in, not sent yet | Send, Cancel |
| SENT | Emailed to client | Mark as paid, Cancel |
| PAID | Payment received | Generate credit note |
| PARTIALLY_PAID | Partial payment | Add more payments |
| CANCELLED | Cancelled | Generate credit note if needed |

---

## Sending an Invoice

1. Open the invoice (must be VALIDATED or above)
2. Click **Envoyer** button
3. Email is sent to the billing client's email address
4. Status changes to SENT

---

## Marking an Invoice as Paid

1. Open the invoice (status must be SENT)
2. Click **Marquer comme payé**
3. Fill in:
   - **Montant payé** — amount received
   - **Date de paiement** — when payment arrived
   - **Méthode** — bank transfer, check, card, etc.
   - **Référence** — payment reference (bank transaction ID)
4. Click **Confirmer**
5. If fully paid → status becomes PAID
6. If partial → status becomes PARTIALLY_PAID

---

## Generate a Credit Note (Avoir)

When you need to refund or adjust a paid invoice:
1. Open the original PAID invoice
2. Click **Générer un avoir**
3. Fill in the amount to credit (full or partial)
4. Click **Créer l'avoir**
5. A new CREDIT_NOTE invoice is created linked to the original

---

## Managing Billing Clients

A **billing client** is the legal entity that receives invoices (may differ from CRM client).

### Create a Billing Client
1. Go to `/manager/billing/clients` → click **"+"** (or `/manager/billing/clients/new`)
2. Fill:
   - **Raison sociale** — legal company name
   - **Adresse** — full billing address
   - **SIRET / TVA** — tax ID numbers
   - **Email de facturation** — where invoices are sent
   - **Contact** — billing contact person
3. Click **Créer**

### Link to CRM Client
When creating an invoice, the billing client must match the CRM client. Create billing clients for all your clients before generating invoices.

---

## Engagements (Service Contracts)

**Engagements** track the scope and terms of client agreements:

1. Go to `/manager/billing/engagements` → click **"+"**
2. Set:
   - **Client** — which client
   - **Start date / End date** — contract duration
   - **Status** — BROUILLON → ACTIF → RENOUVELE/RESILIE/ARCHIVE
   - **Offre tarifaire** — which pricing package applies
   - **Terms** — specific conditions
3. Use engagements to track which clients have active contracts

### Engagement Statuses
| Status | Meaning |
|--------|---------|
| BROUILLON | Draft — not yet agreed |
| ACTIF | Active contract — invoices can reference this |
| EXPIRE | Expired — past end date |
| RENOUVELE | Renewed — linked to a new engagement |
| RESILIE | Terminated early |
| ARCHIVE | Archived |

---

## Pricing Offers (`/manager/billing/offres`)

Pricing packages define your service structure:

1. Go to `/manager/billing/offres` → click **"+"**
2. Set name, description, base price, and terms (JSON config for complex pricing)
3. Status: ACTIF / ARCHIVE

Offers are referenced when creating engagements and can auto-populate invoice line items.

---

## Billing Settings (`/manager/billing/settings`)

Configure:
- **Invoice numbering format** — prefix + sequence (e.g. "CP-2025-001")
- **Default TVA rate** — standard VAT % applied to all lines
- **Default payment terms** — number of days until due date
- **Invoice email template** — customize the email sent with invoices
- **Company issuer info** — your company's name, address, logo for invoice header

---

## Aging Report

The **Aging buckets** section on the billing dashboard shows how much is overdue:
- **Current** — not yet due
- **30+ days** — past due by 30 days
- **60+ days** — past due by 60 days  
- **90+ days** — past due by 90 days (action required)

Click any bucket to filter the invoice list to that overdue range.

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Can't edit an invoice | Only DRAFT invoices are editable. Validated/Sent invoices are locked. Generate a credit note to adjust. |
| Invoice not sent to client | Check client's billing email is correct in `/manager/billing/clients`. Also check spam. |
| Revenue chart not updating | Check invoice dates — chart uses issue date. New invoices take a few minutes to reflect. |
| Client not in billing dropdown | Create a billing client profile first at `/manager/billing/clients/new` |
| TVA calculated wrong | Check billing settings at `/manager/billing/settings` → verify TVA rate |
