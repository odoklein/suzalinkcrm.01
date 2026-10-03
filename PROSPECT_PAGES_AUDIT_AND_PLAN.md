# Prospect Pages - Functionality Audit & Fix Plan

## Executive Summary

After thorough analysis of all prospect-related pages, I've identified **7 critical issues** that prevent the system from being 100% functional. This document outlines each issue and provides a detailed fix plan.

---

## Current State Analysis

### ✅ Working Pages
1. **Prospects List** (`/manager/prospects/page.tsx`)
   - ✅ Lists prospects with filters
   - ✅ Search functionality
   - ✅ Stats cards
   - ✅ Navigation links
   - ❌ **Issue**: Links to detail page that doesn't exist

2. **Sources List** (`/manager/prospects/sources/page.tsx`)
   - ✅ Lists sources
   - ✅ Test functionality
   - ✅ Delete functionality
   - ❌ **Issue**: Links to edit page that doesn't exist

3. **Review/Exception Inbox** (`/manager/prospects/review/page.tsx`)
   - ✅ Lists prospects requiring review
   - ✅ Review modal
   - ✅ Approve/Reject functionality
   - ❌ **Issue**: Column render function has wrong signature

4. **Rules List** (`/manager/prospects/rules/page.tsx`)
   - ✅ Lists rules
   - ✅ Create wizard
   - ✅ Delete functionality
   - ❌ **Issue**: Links to edit page that doesn't exist

5. **Sandbox** (`/manager/prospects/sandbox/page.tsx`)
   - ✅ Test lead generator
   - ✅ Pipeline viewer
   - ❌ **Issue**: Uses fake setTimeout simulation instead of real pipeline status

---

## Critical Issues & Fix Plan

### 🔴 Issue #1: Missing Prospect Detail Page

**Problem:**
- Prospects list links to `/manager/prospects/${profile.id}` but this page doesn't exist
- Users cannot view detailed information about a prospect
- No way to see full pipeline history, decision logs, events

**Impact:** HIGH - Core functionality missing

**Solution:**
Create `/app/manager/prospects/[id]/page.tsx` with:
- Full prospect information display
- Pipeline viewer showing current step
- Decision logs timeline
- Events history
- Actions (approve, reject, activate)
- Related data (source, mission, SDR)

**API Required:**
- `GET /api/prospects/profiles/[id]` - Already exists ✅

---

### 🔴 Issue #2: Missing Source Edit Page

**Problem:**
- Sources list links to `/manager/prospects/sources/${source.id}/edit` but this page doesn't exist
- Users cannot edit existing sources
- Must delete and recreate to change settings

**Impact:** MEDIUM - Poor UX, inefficient workflow

**Solution:**
Create `/app/manager/prospects/sources/[id]/edit/page.tsx` with:
- Reuse `SourceSetupWizard` component in edit mode
- Pre-populate form with existing source data
- Update API call instead of create
- Show webhook URL / API key (read-only if already generated)

**API Required:**
- `GET /api/prospects/sources/[id]` - Already exists ✅
- `PATCH /api/prospects/sources/[id]` - Already exists ✅

---

### 🔴 Issue #3: Missing Rule Edit Page

**Problem:**
- Rules list links to `/manager/prospects/rules/${rule.id}/edit` but this page doesn't exist
- Users cannot edit existing rules
- Must delete and recreate to change rules

**Impact:** MEDIUM - Poor UX, inefficient workflow

**Solution:**
Create `/app/manager/prospects/rules/[id]/edit/page.tsx` with:
- Reuse `RuleWizard` component in edit mode
- Pre-populate form with existing rule data
- Update API call instead of create

**API Required:**
- `GET /api/prospects/rules/[id]` - Already exists ✅
- `PATCH /api/prospects/rules/[id]` - Already exists ✅

---

### 🟡 Issue #4: Review Page Column Render Bug

**Problem:**
- Review page uses `render: (profile) =>` but DataTable expects `render: (value, row) =>`
- This will cause runtime errors when rendering

**Impact:** MEDIUM - Will break when page is used

**Location:** `app/manager/prospects/review/page.tsx:169`

**Current Code:**
```typescript
render: (profile) => {
    const name = [profile.firstName, profile.lastName].filter(Boolean).join(" ") || "N/A";
    // ...
}
```

**Fix:**
```typescript
render: (_value, profile) => {
    const name = [profile.firstName, profile.lastName].filter(Boolean).join(" ") || "N/A";
    // ...
}
```

---

### 🟡 Issue #5: DataTable Pagination Not Working

**Problem:**
- DataTable has pagination enabled but no way to change pages
- `page` state exists but no handlers to update it
- Users stuck on first page

**Impact:** MEDIUM - Cannot navigate through large lists

**Location:** `app/manager/prospects/page.tsx`

**Current Code:**
```typescript
const [page, setPage] = useState(1);
// ...
<DataTable
    data={profiles}
    columns={columns}
    keyField="id"
    pagination
    pageSize={limit}
/>
```

**Fix:**
- Check if DataTable component supports `currentPage` and `onPageChange` props
- If not, add them to DataTable component
- Wire up page change handlers

---

### 🟡 Issue #6: Sandbox Uses Fake Pipeline Simulation

**Problem:**
- Sandbox page uses `setTimeout` to simulate pipeline progression
- Not showing real pipeline status
- No way to see actual decision logs or real-time updates

**Impact:** LOW - Sandbox is for testing, but should show real behavior

**Location:** `app/manager/prospects/sandbox/page.tsx:126-144`

**Current Code:**
```typescript
// Simulate pipeline progression (in real app, this would come from the profile)
setTimeout(() => {
    setCurrentStep(ProspectPipelineStep.NORMALIZE);
}, 500);
// ... more setTimeout calls
```

**Fix:**
- After test lead is sent, poll or fetch the profile status
- Use real pipeline step from profile
- Show real decision logs from API
- Add refresh button to update status

**API Required:**
- `GET /api/prospects/profiles/[id]` - Already exists ✅

---

### 🟢 Issue #7: Missing Enhanced Profile API Response

**Problem:**
- Profile detail page needs more data than current API provides
- Need full decision logs, all events, source information

**Impact:** LOW - Can be fixed when creating detail page

**Solution:**
- Enhance `GET /api/prospects/profiles/[id]` to include:
  - All decision logs (not just count)
  - All events (not just latest)
  - Source details
  - Full pipeline history

---

## Implementation Priority

### Phase 1: Critical Fixes (Must Have)
1. ✅ Fix Review page column render bug (#4)
2. ✅ Create Prospect Detail Page (#1)
3. ✅ Fix DataTable pagination (#5)

### Phase 2: Important Features (Should Have)
4. ✅ Create Source Edit Page (#2)
5. ✅ Create Rule Edit Page (#3)

### Phase 3: Enhancements (Nice to Have)
6. ✅ Enhance Sandbox with real pipeline status (#6)
7. ✅ Enhance Profile API response (#7)

---

## Testing Checklist

After implementing fixes, test:

- [ ] Can view prospect details from list
- [ ] Can edit existing source
- [ ] Can edit existing rule
- [ ] Review page renders without errors
- [ ] Can paginate through prospects list
- [ ] Sandbox shows real pipeline status
- [ ] All navigation links work
- [ ] All API endpoints return expected data
- [ ] No console errors
- [ ] Mobile responsive

---

## Files to Create/Modify

### New Files
1. `app/manager/prospects/[id]/page.tsx` - Prospect detail page
2. `app/manager/prospects/sources/[id]/edit/page.tsx` - Source edit page
3. `app/manager/prospects/rules/[id]/edit/page.tsx` - Rule edit page

### Files to Modify
1. `app/manager/prospects/review/page.tsx` - Fix column render signatures
2. `app/manager/prospects/page.tsx` - Fix pagination
3. `app/manager/prospects/sandbox/page.tsx` - Use real pipeline status
4. `app/api/prospects/profiles/[id]/route.ts` - Enhance response (optional)
5. `components/ui/DataTable.tsx` - Add pagination props if needed

---

## Estimated Effort

- **Phase 1**: 2-3 hours
- **Phase 2**: 2-3 hours
- **Phase 3**: 1-2 hours
- **Total**: 5-8 hours

---

## Notes

- All required API endpoints already exist
- Can reuse existing components (SourceSetupWizard, RuleWizard, PipelineViewer)
- Follow existing patterns from other detail pages (Client, Mission, Campaign)
- Ensure consistent styling with rest of application
