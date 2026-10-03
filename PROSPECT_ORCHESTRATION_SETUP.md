# Prospect Orchestration Engine - Setup Summary

## ✅ What's Been Implemented

### Core Components
- ✅ Prisma schema with all POE models
- ✅ Intake API endpoint (`POST /api/prospects/intake`)
- ✅ Pipeline processing service (normalize → validate → score → deduplicate → route → activate)
- ✅ Rule engine for configurable validation/scoring/routing
- ✅ Queue system with BullMQ workers
- ✅ Manager UI pages (list view, exception inbox)
- ✅ Review/approval workflow
- ✅ Activation service (creates Contact/Company)

### Navigation & Permissions
- ✅ "Prospects" added to Manager sidebar navigation
- ✅ Permissions added to seed file:
  - `pages.prospects`
  - `features.manage_prospect_rules`
  - `features.review_prospects`
  - `features.configure_prospect_sources`
  - `features.activate_prospects`

## 🚀 Quick Setup Steps

### 1. Run Database Migration
```bash
npx prisma migrate dev --name add_prospect_orchestration_engine
npx prisma generate
```

### 2. Seed Permissions
```bash
npx prisma db seed
```

### 3. Initialize Workers (Add to your startup)

**Option A: In an API route** (e.g., `app/api/init/route.ts`):
```typescript
import { initializeProspectOrchestration } from '@/lib/prospects/init';

export async function GET() {
  initializeProspectOrchestration();
  return Response.json({ success: true });
}
```

**Option B: In a server startup script** or your main server file:
```typescript
import { initializeProspectOrchestration } from '@/lib/prospects/init';

// Call on server startup
initializeProspectOrchestration();
```

### 4. Create a Test Prospect Source

Via Prisma Studio or SQL:
```sql
INSERT INTO "ProspectSource" (id, name, type, "isActive", "createdAt", "updatedAt")
VALUES (gen_random_uuid()::text, 'Test Web Form', 'WEB_FORM', true, NOW(), NOW());
```

Or add to `prisma/seed.ts`:
```typescript
const testSource = await prisma.prospectSource.create({
  data: {
    name: 'Test Web Form',
    type: 'WEB_FORM',
    isActive: true,
  },
});
```

### 5. Test Intake

```bash
curl -X POST http://localhost:3000/api/prospects/intake \
  -H "Content-Type: application/json" \
  -d '{
    "sourceId": "YOUR_SOURCE_ID",
    "payload": {
      "firstName": "John",
      "lastName": "Doe",
      "email": "john.doe@example.com",
      "phone": "+33612345678",
      "company": "Acme Corp"
    }
  }'
```

### 6. Access Manager UI

1. Login as Manager
2. Click "Prospects" in sidebar
3. View prospects at `/manager/prospects`
4. Review prospects at `/manager/prospects/review`

## 📁 File Structure

```
lib/prospects/
├── init.ts                    # Initialization helper
├── intake-service.ts          # Lead intake logic
├── normalization-service.ts   # Field standardization
├── rule-engine.ts             # Rule evaluation
├── scoring-service.ts         # Quality/confidence scoring
├── pipeline-service.ts        # Pipeline orchestration
├── routing-service.ts         # Mission/SDR assignment
├── activation-service.ts      # Contact/Company creation
└── queue/
    ├── index.ts               # Queue definitions
    └── workers.ts             # Background workers

app/api/prospects/
├── intake/route.ts            # Public intake endpoint
├── profiles/route.ts           # List profiles
├── profiles/[id]/route.ts     # Get profile details
├── profiles/[id]/review/route.ts  # Review endpoint
├── rules/route.ts             # List/create rules
└── rules/[id]/route.ts        # Get/update/delete rule

app/manager/prospects/
├── page.tsx                   # Main prospects list
└── review/page.tsx            # Exception inbox
```

## 🔧 Configuration

### Pipeline Config (per client)
- Score thresholds
- Enrichment settings
- Deduplication settings
- Routing strategy

### Rules (manager-configurable)
- Validation rules
- Scoring rules
- Routing rules

## 📊 Monitoring

Check these for pipeline health:
- Queue job counts (waiting, active, failed)
- Exception inbox size
- Activation rate
- Decision logs

## 🐛 Troubleshooting

See `PROSPECT_ORCHESTRATION_TESTING.md` for detailed testing guide and common issues.
