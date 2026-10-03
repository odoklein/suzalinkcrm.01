# Manual Migration: Mission to Global Statuses

## Objective

Safely migrate legacy `MISSION` action results to active `GLOBAL` statuses, then prevent legacy mission codes from being selected again.

## Scope

- Remaps `Action.result` values with explicit manager-defined mappings.
- Deactivates mapped `MISSION` status definitions.
- Does not delete historical actions.

## Prerequisites

1. Full database backup.
2. Final target `GLOBAL` statuses are created and active.
3. Manager access to `Settings > Statuses > Migration & Mapping`.

## Pre-check SQL

```sql
-- 1) Current usage by action result
SELECT "result"::text AS code, COUNT(*) AS total
FROM "Action"
GROUP BY "result"
ORDER BY total DESC;

-- 2) Active global status definitions
SELECT "code", "label", "isActive"
FROM "actionStatusDefinition"
WHERE "scopeType" = 'GLOBAL' AND "scopeId" = ''
ORDER BY "sortOrder" ASC;

-- 3) Active mission status definitions (legacy candidates)
SELECT "scopeId" AS mission_id, "code", "label", "isActive"
FROM "actionStatusDefinition"
WHERE "scopeType" = 'MISSION'
ORDER BY mission_id, "sortOrder" ASC;
```

## Migration steps (UI)

1. Open `Manager > Settings > Statuses`.
2. Open tab `Migration & Mapping`.
3. For each legacy code in use, choose a target active global code.
4. Review the confirmation summary (mappings + estimated impacted actions).
5. Click `Appliquer`.

## What the backend guarantees

The remap endpoint now enforces:

- target code must be a valid `ActionResult` enum value,
- target code must be an active `GLOBAL` status,
- all updates run in one transaction (all-or-nothing),
- mapped `MISSION` codes are deactivated in the same transaction.

## Post-check SQL

```sql
-- 1) Verify action results moved to expected global codes
SELECT "result"::text AS code, COUNT(*) AS total
FROM "Action"
GROUP BY "result"
ORDER BY total DESC;

-- 2) Verify mapped mission codes are deactivated
SELECT "scopeId" AS mission_id, "code", "isActive", "updatedAt"
FROM "actionStatusDefinition"
WHERE "scopeType" = 'MISSION'
ORDER BY mission_id, "code";
```

## Rollback

- Use database backup restore for full rollback.
- Or run an inverse mapping through the same remap UI/API if you need to revert specific codes and then reactivate mission definitions manually.

## Notes

- The process is idempotent: remapping already-migrated codes results in zero updated rows.
- New action creation uses effective active status config, so deactivated mission codes are not allowed afterward.
