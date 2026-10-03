# Bug Fix: "Invalide" Status Saving as "MEETING_CANCELLED"

**Date**: March 21, 2026  
**Status**: ✅ FIXED  
**Severity**: High (data corruption)

---

## Problem

When SDRs clicked the **"Invalide"** status chip in `UnifiedActionDrawer.tsx`, the action was saved to the database with `result: "MEETING_CANCELLED"` instead of `result: "INVALIDE"`. This caused:

- ❌ Invalid contacts appearing as cancelled meetings
- ❌ Wrong counts in the "Annulés" tab on manager RDV page  
- ❌ Confused action history on contact cards
- ❌ Incorrect analytics and reporting

---

## Root Cause

**17 mission-level `ActionStatusDefinition` records** had incorrect code-to-label mappings:

```typescript
// WRONG (the bug):
{ 
  code: "MEETING_CANCELLED",  // ❌ Wrong code
  label: "INVALIDE",          // Correct label
  scopeType: "MISSION",
  scopeId: "cmls410tq0004jo04gkte84cx"
}

// CORRECT (after fix):
{
  code: "INVALIDE",           // ✅ Correct code
  label: "Invalide",          // Correct label
  scopeType: "MISSION",
  scopeId: "cmls410tq0004jo04gkte84cx"
}
```

### Why This Happened

When missions were created with custom status presets, the `INVALIDE` status was accidentally assigned the `MEETING_CANCELLED` code. This created a mismatch where:

1. Frontend displayed "Invalide" label (correct)
2. But sent `code: "MEETING_CANCELLED"` to the API (wrong)
3. Database saved `result: "MEETING_CANCELLED"` (wrong)

---

## The Fix

### 1. Database Correction Script

Created and ran `scripts/fix-invalide-bug.ts`:

```typescript
// Updated 17 mission-level ActionStatusDefinition records
// Changed code from "MEETING_CANCELLED" to "INVALIDE"
// Fixed label from "INVALIDE" to "Invalide" (proper case)
```

**Results**:
- ✅ Updated: 17 records
- ✅ Deleted: 0 duplicate records
- ✅ All missions now have correct `INVALIDE` status

### 2. Affected Missions

The following 17 missions were corrected:

- `cmlqouqo10001la04dco03x4z`
- `cmls410tq0004jo04gkte84cx`
- `cmmadzx990006usm0dj613bsm`
- `cmm0bk2xh0007usn4imx5brur`
- `cmm0h32830004us7otwuhuwq0`
- `cmmc2z4zg0001usm8nc2m5caq`
- `cmm90vbw10004jp04ykgpmqmw`
- `cmmijm6wi0001i604gwh38l4f`
- `cmmjdt47d0004jl047no3pma0`
- `cmmflb50x0006ky043hibtjrw`
- `cmmflb50k0004ky04u0npcp23`
- `cmmaksvos0004ju04klos1yr1`
- `cmmak91v40004i904kd56ffkc`
- `cmmgj76xf0009l404us4pz246`
- `cmmesrhky0004usjwqf7nlj7k`
- `cmmnarsqc0001uss8li3xciun`
- `cmm0kw3yj0004jp04i2tscrs0`

---

## Verification

### Before Fix
```bash
$ npx tsx scripts/check-invalide-bug.ts

🐛 FOUND BUG! 17 records have MEETING_CANCELLED code with "Invalide" label
```

### After Fix
```bash
$ npx tsx scripts/check-invalide-bug.ts

✅ No bug found in ActionStatusDefinition table.
```

---

## Prevention

### 1. Frontend Filter (Already in Place)

`UnifiedActionDrawer.tsx` correctly filters out `MEETING_CANCELLED` from SDR action chips:

```typescript
// Line 727
return raw.filter((opt) => opt.value !== "MEETING_CANCELLED");
```

This prevents SDRs from manually selecting "Meeting cancelled" — that action should only be triggered by managers cancelling confirmed meetings.

### 2. Seed File Validation

The global seed (`prisma/seed.ts`) has correct definitions:

```typescript
{ code: "MEETING_CANCELLED", label: "Meeting annulé", ... },
{ code: "INVALIDE", label: "Invalide", ... },
```

### 3. Mission Preset Validation

`lib/constants/actionStatusPresets.ts` has correct SHORT preset:

```typescript
{ code: "INVALIDE", label: "INVALIDE", ... },
```

---

## Testing

After the fix, verify:

1. ✅ SDR clicks "Invalide" → saves `result: "INVALIDE"` in database
2. ✅ Manager sees "Annulés" tab → only shows genuinely cancelled meetings
3. ✅ Contact history → shows "Invalide" correctly, not "RDV annulé"
4. ✅ Analytics → invalid contacts no longer counted as cancelled meetings

---

## Related Files

- **Fix Script**: `scripts/fix-invalide-bug.ts`
- **Check Script**: `scripts/check-invalide-bug.ts`
- **Seed File**: `prisma/seed.ts` (lines 242-243)
- **Presets**: `lib/constants/actionStatusPresets.ts` (line 29)
- **Frontend**: `components/drawers/UnifiedActionDrawer.tsx` (line 727)
- **Service**: `lib/services/StatusConfigService.ts`
- **Schema**: `prisma/schema.prisma` (ActionResult enum, lines 54-55)

---

## Historical Data

**Note**: Actions created before this fix may have corrupted data where `result: "MEETING_CANCELLED"` but the contact was actually marked as invalid. These can be identified by:

```sql
SELECT * FROM Action 
WHERE result = 'MEETING_CANCELLED' 
  AND (note LIKE '%invalide%' OR note LIKE '%Invalide%')
  AND callbackDate IS NULL;
```

Consider running a data cleanup script if historical accuracy is critical for reporting.
