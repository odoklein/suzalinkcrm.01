# Manual setup guide

This doc lists everything you need to configure yourself (env vars, cloud consoles, DNS, etc.) to run Captain Prospect CRM.

---

## 1. Environment variables (`.env`)

Create or edit `.env` in the project root. Below are the variables used by the app and what to set.

### Required (core app)

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string (with connection pooling if applicable) | `postgresql://user:pass@host:5432/db?pgbouncer=true` |
| `DIRECT_URL` | Direct PostgreSQL URL (for migrations) | `postgresql://user:pass@host:5432/db` |
| `NEXTAUTH_SECRET` | Secret for NextAuth session signing (min 32 chars) | Generate with `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Base URL of the app (must match the URL you open in the browser) | `http://localhost:3000` or `https://yourdomain.com` |
| `ENCRYPTION_KEY` | Key used to encrypt OAuth tokens and sensitive data (e.g. 32 chars) | Keep secret and stable |

### Gmail / Email Hub OAuth

| Variable | Description | Where to get it |
|----------|-------------|-----------------|
| `GOOGLE_CLIENT_ID` | Google OAuth 2.0 client ID | [Google Cloud Console](#2-gmail-oauth-google-cloud-console) |
| `GOOGLE_CLIENT_SECRET` | Google OAuth 2.0 client secret | Same |
| `GOOGLE_REDIRECT_URI` | Callback URL after Gmail consent | Set to `{NEXTAUTH_URL}/api/email/oauth/gmail/callback` (optional; defaults to that if unset) |

### Outlook / Microsoft 365 OAuth

| Variable | Description | Where to get it |
|----------|-------------|-----------------|
| `MICROSOFT_CLIENT_ID` | Azure AD app (client) ID | [Azure Portal](#3-outlook-oauth-azure-portal) |
| `MICROSOFT_CLIENT_SECRET` | Azure AD client secret | Same |
| `MICROSOFT_REDIRECT_URI` | Callback URL after Outlook consent | Set to `{NEXTAUTH_URL}/api/email/oauth/outlook/callback` (optional; defaults to that if unset) |
| `MICROSOFT_TENANT_ID` | Azure AD tenant (optional) | `common` for any Microsoft account, or your tenant ID for single-tenant |

### Optional (features)

| Variable | Description |
|----------|-------------|
| `REDIS_HOST` | Redis host for email/background queues (default `localhost`) |
| `REDIS_PORT` | Redis port (default `6379`) |
| `REDIS_PASSWORD` | Redis password if required |
| `OPENAI_API_KEY` | For email AI features (e.g. draft/analysis) |
| `GOOGLE_PUBSUB_TOPIC` | Gmail push notifications (advanced) |
| `WEBHOOK_SECRET` | Secret for Outlook webhook validation (e.g. `captainprospect-email-webhook`) |
| `EMAIL_TRACKING_ENABLED` | Set to `false` to disable open/click tracking |
| `EMAIL_TRACKING_DOMAIN` | Custom tracking domain (e.g. `https://track.yourdomain.com`) |

### Other integrations (if used)

| Variable | Description |
|----------|-------------|
| `GOOGLE_DRIVE_CLIENT_ID` / `GOOGLE_DRIVE_CLIENT_SECRET` / `GOOGLE_DRIVE_REDIRECT_URI` | Google Drive integration |
| `PAPPERS_API_KEY` | Pappers API |
| `QONTO_API_KEY` / `QONTO_ORG_ID` | Qonto API |
| `ASW_ACCESS_KEY_ID` / `ASW_SECRET_ACCESS_KEY` / `ASW_REGION` / `ASW_S3_BUCKET` | S3 storage |
| `MISTRAL_API_KEY` | Mistral AI |
| `APOLLO_API_KEY` / `APOLLO_ENABLED` | Apollo.io |
| `EXPLORIUM_API_KEY` | Explorium |
| `NEXT_PUBLIC_SOCKET_URL` / `NEXT_PUBLIC_SOCKET_PATH` | Realtime socket server |

---

## 2. Gmail OAuth (Google Cloud Console)

To let users connect Gmail (Manager / SDR / Developer integrations):

1. Go to [Google Cloud Console](https://console.cloud.google.com/).
2. Create or select a project.
3. **APIs & Services → Library**: enable **Gmail API**.
4. **APIs & Services → Credentials → Create credentials → OAuth client ID**.
5. If prompted, configure the **OAuth consent screen** (External, add your app name and support email).
6. Application type: **Web application**.
7. **Authorized redirect URIs**: add exactly:
   - Local: `http://localhost:3000/api/email/oauth/gmail/callback`
   - Prod: `https://yourdomain.com/api/email/oauth/gmail/callback`
8. Create and copy **Client ID** and **Client secret** into `.env` as `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
9. Set `GOOGLE_REDIRECT_URI` to the same URL you added (or leave unset to use `{NEXTAUTH_URL}/api/email/oauth/gmail/callback`).

---

## 3. Outlook OAuth (Azure Portal)

To let users connect Outlook / Microsoft 365:

1. Go to [Azure Portal](https://portal.azure.com/) → **Microsoft Entra ID** (Azure AD) → **App registrations**.
2. **New registration**:
   - Name: e.g. `Captain Prospect CRM Email`.
   - Supported account types: **Accounts in any organizational directory and personal Microsoft accounts** (or your choice).
   - Redirect URI: **Web** → `http://localhost:3000/api/email/oauth/outlook/callback` (and add production URL when you deploy).
3. After creation, note the **Application (client) ID** → `MICROSOFT_CLIENT_ID`.
4. **Certificates & secrets** → **New client secret** → copy the value once → `MICROSOFT_CLIENT_SECRET`.
5. **API permissions** → **Add a permission** → **Microsoft Graph**:
   - Delegated: `Mail.Read`, `Mail.ReadWrite`, `Mail.Send`, `User.Read`, `openid`, `profile`, `email`, `offline_access`.
6. **Authentication**: under **Web** → **Redirect URIs**, ensure the callback URL above is listed (and add production URL when needed).
7. In `.env` set `MICROSOFT_REDIRECT_URI` to the same callback URL (or leave unset to use `{NEXTAUTH_URL}/api/email/oauth/outlook/callback`). Set `MICROSOFT_TENANT_ID=common` unless you use a single tenant.

---

## 4. Database

- Run migrations: `npx prisma migrate deploy` (or `npx prisma db push` for dev).
- Generate client: `npx prisma generate`.
- Seed permissions/data if needed: `npx prisma db seed`.

---

## 5. NextAuth and login

- Use the app at the **exact** URL set in `NEXTAUTH_URL` (e.g. `http://localhost:3000`), otherwise session cookies may not work.
- If you get 401 after login, clear site cookies and log in again at that URL.

---

## 6. Email deliverability (optional)

For production email and fewer spam issues, see **[CUSTOM_EMAIL_SETUP.md](./CUSTOM_EMAIL_SETUP.md)** (DNS: SPF, DKIM, DMARC; tracking domain; warmup).

---

## 7. Quick checklist

- [ ] `.env` has `DATABASE_URL`, `DIRECT_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `ENCRYPTION_KEY`.
- [ ] Gmail: Google Cloud project, Gmail API enabled, OAuth client (Web), redirect URI added, `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env`.
- [ ] Outlook: Azure app registration, redirect URI added, Graph permissions (Mail.*, User.Read, openid, etc.), client secret; `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET` in `.env`.
- [ ] Database migrated and Prisma client generated.
- [ ] App opened at the same URL as `NEXTAUTH_URL`.
