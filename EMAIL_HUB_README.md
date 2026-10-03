# Email Hub - Implementation Guide

## Overview
Enterprise-grade email management system integrated into Captain Prospect CRM with multi-provider support (Gmail, Outlook, IMAP/SMTP), sequences, templates, and analytics.

## Architecture

### Core Components

1. **Providers** (`lib/email/providers/`)
   - `gmail.ts` - Gmail API integration via OAuth2
   - `outlook.ts` - Microsoft Graph API integration
   - `imap.ts` - IMAP/SMTP for custom providers (Yahoo, iCloud, etc.)
   - `types.ts` - Shared interfaces and types

2. **Services** (`lib/email/services/`)
   - `sync-service.ts` - Email synchronization from providers
   - `sending-service.ts` - Email sending with tracking
   - `sequence-service.ts` - Automated sequence engine
   - `ai-service.ts` - AI-powered email analysis
   - `linking-service.ts` - CRM auto-linking
   - `audit-service.ts` - Audit logging and GDPR compliance

3. **Queue System** (`lib/email/queue/`)
   - Background job processing with BullMQ
   - Redis-backed queues for: sync, send, sequences, analytics, AI
   - **Optional**: System degrades gracefully without Redis

4. **API Routes** (`app/api/email/`)
   - Mailbox management, OAuth callbacks
   - Thread/email CRUD operations
   - Sequences, templates, analytics
   - Tracking pixels (open/click)
   - Webhooks (Gmail push notifications, Outlook subscriptions)

5. **UI Components** (`components/email/inbox/`)
   - InboxLayout - 3-column interface
   - ThreadList, ThreadView, EmailComposer
   - MailboxSwitcher, FolderNav, ContextPanel
   - EmailOnboarding - Provider connection flow

## Setup

### 1. Environment Variables

```env
# Database
DATABASE_URL=postgresql://...

# OAuth Providers (Optional - for Gmail/Outlook)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:3000/api/email/oauth/gmail/callback

MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
MICROSOFT_REDIRECT_URI=http://localhost:3000/api/email/oauth/outlook/callback
MICROSOFT_TENANT_ID=common

# Redis (Optional - for background jobs)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# OpenAI (Optional - for AI features)
OPENAI_API_KEY=
```

### 2. Database Migration

```bash
npx prisma db push
npx prisma generate
```

### 3. Seed Permissions

```bash
npx prisma db seed
```

This creates the `pages.email` permission and assigns it to MANAGER, SDR, and BUSINESS_DEVELOPER roles.

## Usage

### Connecting Mailboxes

**Gmail / Outlook (OAuth)**:
1. Navigate to `/manager/email`
2. Click provider card (Gmail or Outlook)
3. Complete OAuth flow
4. Mailbox syncs automatically

**IMAP/SMTP (Manual)**:
1. Navigate to `/manager/email`
2. Click "IMAP / SMTP" card
3. Enter:
   - Email address
   - Password (or App Password for Gmail)
   - IMAP server (e.g., `imap.gmail.com:993`)
   - SMTP server (e.g., `smtp.gmail.com:587`)
4. Connection is tested before creation
5. Click "Sync" button to manually sync emails

### Syncing Emails

**Automatic** (with Redis):
- Syncs trigger via background queue
- Webhook-driven for real-time updates

**Manual** (without Redis or on-demand):
1. Go to `/manager/email/mailboxes`
2. Click sync button (⟳) next to mailbox
3. Sync runs synchronously in API route

### Creating Sequences

1. Navigate to `/manager/email/sequences`
2. Click "Nouvelle séquence"
3. Configure:
   - Name, description
   - Sending mailbox
   - Campaign (optional)
   - Steps (subject, content, delays, skip conditions)
   - Send window & rules
4. Enroll contacts from sequence detail page

### Email Templates

1. Navigate to `/manager/email/templates`
2. Create reusable templates with variables
3. Categories: intro, follow-up, sales, meeting, etc.
4. Use in composer or sequences

## Production Deployment

### Redis Setup (Recommended)

**Option 1: Self-hosted**
```bash
# Docker
docker run -d --name redis -p 6379:6379 redis:alpine

# Or install locally
# Ubuntu: sudo apt install redis-server
# macOS: brew install redis
```

**Option 2: Cloud**
- Upstash Redis (free tier available)
- Redis Cloud
- AWS ElastiCache
- Azure Cache for Redis

### Background Workers

Create a worker process to handle background jobs:

```typescript
// workers/email-worker.ts
import { 
  createEmailSyncWorker,
  createEmailSendWorker,
  createSequenceProcessWorker 
} from '@/lib/email/queue/workers';

async function startWorkers() {
  const syncWorker = createEmailSyncWorker();
  const sendWorker = createEmailSendWorker();
  const sequenceWorker = createSequenceProcessWorker();

  console.log('Email workers started');
}

startWorkers();
```

Deploy with:
- PM2: `pm2 start workers/email-worker.ts`
- Kubernetes: Deploy as separate pod
- Docker: Separate container

### OAuth Setup

**Gmail**:
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create project → Enable Gmail API
3. Create OAuth 2.0 credentials
4. Add authorized redirect URI: `https://yourdomain.com/api/email/oauth/gmail/callback`
5. Request scopes: `gmail.readonly`, `gmail.send`, `gmail.modify`

**Outlook**:
1. Go to [Azure Portal](https://portal.azure.com)
2. App Registrations → New registration
3. Add redirect URI: `https://yourdomain.com/api/email/oauth/outlook/callback`
4. API Permissions: `Mail.Read`, `Mail.Send`, `Mail.ReadWrite`

### Security Considerations

1. **Token Encryption**: All OAuth tokens and IMAP passwords are encrypted with AES-256-GCM
2. **Rate Limiting**: Implement rate limiting on tracking and OAuth endpoints
3. **CSP Headers**: Configure Content Security Policy for email HTML rendering
4. **Webhook Verification**: Validate webhook signatures (Gmail/Outlook)
5. **RBAC**: Use permission system (`pages.email`, `features.send_email`, etc.)

## Troubleshooting

### Build Error: "Module not found: Can't resolve 'bullmq'"
```bash
npm install bullmq ioredis
```

### "Queue name cannot contain :"
Fixed in v1.1 - queue names now use hyphens (`email-sync` not `email:sync`)

### "Redis not available"
System degrades gracefully - sync works via manual trigger. To enable queues:
1. Start Redis server
2. Set `REDIS_HOST` in `.env`
3. Restart application

### IMAP Sync Not Working
1. Check IMAP credentials are correct
2. For Gmail: use App Password, not account password
3. Click sync button manually: `/manager/email/mailboxes`
4. Check console/logs for detailed error messages

### No Emails Appearing
1. Verify mailbox `syncStatus` is `SYNCED` (not `ERROR`)
2. Check `lastSyncAt` timestamp
3. Trigger manual sync
4. Check `EmailThread` and `Email` tables in database

## API Reference

### Key Endpoints

- `GET /api/email/mailboxes` - List mailboxes
- `POST /api/email/mailboxes` - Create IMAP mailbox
- `POST /api/email/mailboxes/test` - Test IMAP connection
- `POST /api/email/mailboxes/{id}/sync` - Trigger sync
- `GET /api/email/threads` - List threads
- `POST /api/email/send` - Send email
- `GET/POST /api/email/sequences` - Manage sequences
- `GET /api/email/tracking/open` - Open tracking pixel
- `GET /api/email/tracking/click` - Click tracking redirect

See individual route files for full parameter documentation.

## Future Enhancements

### Planned Features
- [ ] Real-time WebSocket updates
- [ ] Attachment cloud storage (S3)
- [ ] Advanced email templates with drag-drop editor
- [ ] Bounce/complaint handling
- [ ] Warmup automation for new mailboxes
- [ ] Email A/B testing in sequences
- [ ] Calendar integration for meeting scheduling

### Performance Optimizations
- [ ] Virtual scrolling for large inboxes
- [ ] Email body lazy loading
- [ ] Database query optimization with selective loading
- [ ] Redis caching for frequently accessed threads

## License

Copyright © 2024 Captain Prospect CRM. All rights reserved.
