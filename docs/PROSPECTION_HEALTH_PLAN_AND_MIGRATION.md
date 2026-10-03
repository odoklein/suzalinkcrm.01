# Prospection Health: Plan, Formulas, and Migration Notes

## Scope

Implement an explainable "Prospection Health" layer for manager views:

- Per-list health status (`FULLY_PROSPECTED`, `IN_PROGRESS`, `AT_RISK`, `STALLED`, `INSUFFICIENT_DATA`)
- Predictive ETA signals with confidence scoring
- Actionable hints for managers
- Client-level intelligence (top/bottom performers, stagnation alerts, aggregate progression)
- Filters by SDR, mission, client, and date range

## Data Model Strategy

### V1 (implemented)

- No schema migration required
- Metrics are computed on demand from existing tables:
  - `List`, `Mission`, `Client`
  - `Company`, `Contact`
  - `Action`, `User`
- Aggregation uses SQL CTEs through Prisma raw queries

### V2 (recommended cache model)

Introduce `ListHealthSnapshot` to reduce compute pressure at scale:

- `id`, `listId`, `computedAt`
- `status`, `coverageRate`, `activityScore`
- `actions7d`, `actions30d`, `daysSinceLastAction`
- `etaDays`, `etaConfidence`
- Optional JSON payload for explainability blocks

Refresh strategy:

- Event-driven refresh on new `Action` write
- Scheduled refresh every 6-12h
- Manager page reads latest snapshot with fallback to live compute

## API Surfaces

- `GET /api/lists/[id]/health` -> full metrics for one list
- `GET /api/lists/health` -> bulk summaries for table/dashboard
- `GET /api/lists/intelligence` -> client-level intelligence + rankings + alerts

Supported filters:

- `sdrIds[]`
- `missionId`
- `clientId`
- `listIds[]`
- `from` / `to` (for intelligence range stats)

## Metric Formulas (Explainability)

- `coverageRate = contactedContacts / totalContacts * 100`
- `actionsPerDay7d = actions7d / 7`
- `actionsPerDay30d = actions30d / 30`
- `newContactsPerDay7d = newContacts7d / 7`
- `ETA days = remainingContacts / newContactsPerDay7d` (when velocity > 0)
- Activity score:
  - 40% coverage
  - 20% recent intensity
  - 20% positive rate
  - 20% velocity trend

Threshold constants are centralized in `HEALTH_THRESHOLDS` (`lib/types/health.ts`).

## Sparse/Delayed Data Protections

- `INSUFFICIENT_DATA` if contacts below minimum threshold
- ETA suppressed (`null`) when current cadence is zero
- New-list confidence downgrade for very recent lists
- Status explanations and score explanations always returned for transparency

## UX Integration

- Manager list page:
  - Added "Santé Prospection" tab
  - Added health status column in lists table
- Manager list detail page:
  - Added dedicated prospection health panel
  - Includes formulas, thresholds, trend explanations, and actionable hints

## Performance Constraints and Mitigation

Current:

- Bulk CTE aggregation prevents N+1 access patterns
- Lightweight summaries used for table/list overview

Future:

- Snapshot cache for high-volume tenants
- Index checks to validate:
  - `Action.createdAt`
  - `Action.contactId`
  - `Action.companyId`
  - `Action.sdrId`
  - `Company.listId`
  - `Contact.companyId`

## Rollout Plan

1. Release behind manager-only endpoints/UI (done)
2. Observe query latency and API error rates
3. Validate status distribution against manual samples
4. Enable snapshot cache if P95 latency grows with data volume
5. Add alerting on stalled/at-risk count drift for regressions

## Testing Notes

Added deterministic unit tests for pure computations:

- `lib/services/ListHealthService.test.ts`
- Run with: `npm run test:list-health`

These tests validate:

- health status classification
- velocity trend classification
- ETA confidence behavior
- activity score sanity
- hint generation for quality and cadence issues