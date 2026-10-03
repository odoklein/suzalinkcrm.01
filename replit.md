# Captain Prospect — Next.js App on Replit

## Overview
A full-stack Next.js 16 CRM/sales application migrated from Vercel. Features include prospect management, email orchestration, calendar/appointment booking, PDF generation, and role-based access control.

## Tech Stack
- **Framework**: Next.js 16.1.1 (App Router, Turbopack)
- **Database ORM**: Prisma with PostgreSQL (DATABASE_URL required)
- **Auth**: NextAuth v4 (NEXTAUTH_SECRET required)
- **Storage**: Supabase (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
- **Email**: Nodemailer via SMTP (SYSTEM_SMTP_* vars)
- **Queue**: BullMQ + ioredis
- **PDF**: pdfkit + puppeteer + @sparticuz/chromium-min

## Running the App
The app runs via the "Start application" workflow on port 5000.

```
npm run dev   # dev server on port 5000
npm run build # prisma generate + next build
npm run start # production start on port 5000
```

## Required Environment Variables
Set these in Replit Secrets before using the app:

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (pooled) |
| `DIRECT_URL` | PostgreSQL direct connection (for migrations) |
| `NEXTAUTH_SECRET` | Random secret for NextAuth JWT signing |
| `NEXTAUTH_URL` | Full URL of the app (e.g. https://your-repl.replit.dev) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |
| `SYSTEM_SMTP_HOST` | SMTP host for transactional emails |
| `SYSTEM_SMTP_PORT` | SMTP port (default: 587) |
| `SYSTEM_SMTP_USER` | SMTP username |
| `SYSTEM_SMTP_PASS` | SMTP password |
| `ALLO_API_KEY` | Allo/WithAllo API key |
| `WITHALLO_WEBHOOK_SECRET` | Allo webhook secret |

## Replit Migration Notes
- Sentry instrumentation disabled (instrumentation.ts) — re-enable for production deploys with valid SENTRY_DSN
- `next.config.ts` stripped of `withSentryConfig` wrapper to avoid build-time Vercel dependencies
- Dev/start scripts updated to use `-p 5000 -H 0.0.0.0` for Replit preview compatibility
- Puppeteer browser download skipped at install time (`PUPPETEER_SKIP_DOWNLOAD=true`)
- Cross-origin dev origins configured via `REPLIT_DEV_DOMAIN` env var

## Architecture
- `app/` — Next.js App Router pages and API routes
- `components/` — Shared React components
- `lib/` — Server utilities (prisma client, auth, mailer, etc.)
- `prisma/` — Database schema and migrations
- `workers/` — Background job workers (BullMQ)
- `billing/` — Billing-related utilities
- `scripts/` — Build/maintenance scripts
