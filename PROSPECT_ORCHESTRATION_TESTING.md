# Prospect Orchestration Engine - Testing Guide

## Quick Start Testing

### 1. Database Migration

First, run the Prisma migration to create the POE tables:

```bash
npx prisma migrate dev --name add_prospect_orchestration_engine
npx prisma generate
```

### 2. Seed Permissions

Run the seed script to add prospect-related permissions:

```bash
npx prisma db seed
```

Or manually run:
```bash
npm run seed
```

### 3. Initialize Queue Workers

Add this to your application startup (e.g., in a server startup script or API route):

```typescript
// In your server initialization file or API route
import { initializeProspectWorkers } from '@/lib/prospects/queue/workers';

// Initialize workers (call this once on server startup)
initializeProspectWorkers();
```

**Recommended location:** Create a file `lib/prospects/init.ts`:

```typescript
import { initializeProspectWorkers } from './queue/workers';

export function initializeProspectOrchestration() {
  if (process.env.NODE_ENV !== 'production' || process.env.ENABLE_PROSPECT_WORKERS === 'true') {
    initializeProspectWorkers();
  }
}
```

Then call it in your main server file or in an API route that runs on startup.

### 4. Create a Prospect Source

Before you can intake leads, you need to create a ProspectSource. You can do this via:

**Option A: Direct Database Insert**
```sql
INSERT INTO "ProspectSource" (id, name, type, "isActive", "createdAt", "updatedAt")
VALUES (gen_random_uuid()::text, 'Test Web Form', 'WEB_FORM', true, NOW(), NOW());
```

**Option B: Via API (after creating Manager user)**
```bash
# First, get your manager user ID and create a source via Prisma Studio or direct SQL
```

**Option C: Add to seed script** (recommended for testing)

Add to `prisma/seed.ts`:
```typescript
// Create test prospect source
const testSource = await prisma.prospectSource.create({
  data: {
    name: 'Test Web Form',
    type: 'WEB_FORM',
    isActive: true,
  },
});
console.log('✅ Created test prospect source:', testSource.id);
```

### 5. Test Intake API

Send a test lead to the intake endpoint:

```bash
# Replace SOURCE_ID with the ID from step 4
curl -X POST http://localhost:3000/api/prospects/intake \
  -H "Content-Type: application/json" \
  -d '{
    "sourceId": "YOUR_SOURCE_ID",
    "payload": {
      "firstName": "John",
      "lastName": "Doe",
      "email": "john.doe@example.com",
      "phone": "+33612345678",
      "company": "Acme Corp",
      "title": "CEO"
    }
  }'
```

Or use a tool like Postman/Insomnia with:
- **URL:** `POST /api/prospects/intake`
- **Body:**
```json
{
  "sourceId": "YOUR_SOURCE_ID",
  "payload": {
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@example.com",
    "phone": "+33612345678",
    "company": "Acme Corp",
    "title": "CEO"
  }
}
```

### 6. Verify in Manager UI

1. **Login as Manager** (role: MANAGER)
2. **Navigate to Prospects** - You should see "Prospects" in the sidebar
3. **View Prospects List** - `/manager/prospects`
   - Should show the test prospect you just created
   - Check status, scores, etc.
4. **View Exception Inbox** - `/manager/prospects/review`
   - Prospects requiring review will appear here

### 7. Test Pipeline Flow

The pipeline processes automatically via queue workers. To verify:

1. **Check Database:**
```sql
-- View prospect profiles
SELECT id, "firstName", "lastName", email, status, "currentStep", "qualityScore", "confidenceScore"
FROM "ProspectProfile"
ORDER BY "createdAt" DESC;

-- View events
SELECT id, "eventType", step, "createdAt"
FROM "ProspectEvent"
ORDER BY "createdAt" DESC;

-- View decision logs
SELECT id, step, outcome, reason, "executedAt"
FROM "ProspectDecisionLog"
ORDER BY "executedAt" DESC;
```

2. **Check Queue Status:**
   - Workers should be processing jobs automatically
   - Check console logs for processing messages

### 8. Test Review Flow

1. **Create a low-quality prospect** (will trigger review):
```bash
curl -X POST http://localhost:3000/api/prospects/intake \
  -H "Content-Type: application/json" \
  -d '{
    "sourceId": "YOUR_SOURCE_ID",
    "payload": {
      "email": "test@gmail.com",
      "firstName": "Test"
    }
  }'
```

2. **Go to Exception Inbox** - `/manager/prospects/review`
3. **Review and Approve/Reject** the prospect

### 9. Test Activation

Once a prospect is approved and routed:
- It should automatically create a Contact and Company
- Check the `activatedContactId` and `activatedCompanyId` fields
- Verify the Contact appears in the CRM

## Common Issues & Solutions

### Issue: "Prospect source not found"
**Solution:** Make sure you created a ProspectSource first (step 4)

### Issue: Workers not processing
**Solution:** 
- Verify Redis is running: `redis-cli ping` should return `PONG`
- Check that `initializeProspectWorkers()` is called on startup
- Check console logs for errors

### Issue: Permission denied
**Solution:**
- Run `npx prisma db seed` to add permissions
- Verify your user has MANAGER role
- Check that `pages.prospects` permission exists

### Issue: Prospects not appearing in UI
**Solution:**
- Check browser console for API errors
- Verify the API endpoint returns data: `GET /api/prospects/profiles`
- Check that you're logged in as MANAGER

## Testing Checklist

- [ ] Database migration successful
- [ ] Permissions seeded
- [ ] Queue workers initialized
- [ ] ProspectSource created
- [ ] Intake API accepts leads
- [ ] Prospects appear in manager UI
- [ ] Pipeline processes prospects
- [ ] Low-quality prospects go to exception inbox
- [ ] Review/approve flow works
- [ ] Activation creates Contacts/Companies

## Next Steps

1. **Create Rules:** Set up validation and scoring rules via UI (when implemented) or directly in database
2. **Configure Sources:** Set up different source types (API, Web Form, etc.)
3. **Monitor Pipeline:** Check decision logs to understand how prospects are processed
4. **Tune Scoring:** Adjust scoring thresholds in ProspectPipelineConfig

## API Endpoints Reference

- `POST /api/prospects/intake` - Intake a new lead
- `GET /api/prospects/profiles` - List prospect profiles
- `GET /api/prospects/profiles/[id]` - Get profile details
- `PATCH /api/prospects/profiles/[id]/review` - Review (approve/reject) prospect
- `GET /api/prospects/rules` - List rules
- `POST /api/prospects/rules` - Create rule
