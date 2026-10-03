# Performance Audit – Slow Loading Fixes

## Root causes identified

### 1. **N+1 in `/api/actions/stats` (critical)**
- **Issue:** For each SDR/BD user, the API ran 9+ Prisma queries (groupBy, count, findMany). With 10 users this was 90+ database round-trips per request.
- **Fix:** Refactored to bulk queries: one `groupBy([sdrId, result])` per time range (range/week/day/month) and one `findMany` for mission breakdown. Total **5 queries** regardless of user count.
- **File:** `app/api/actions/stats/route.ts`

### 2. **N+1 on manager team page (critical)**
- **Issue:** After fetching users, planning, and actions, the page called `/api/sdr/activity?userId=X` once per SDR/BD (N extra requests).
- **Fix:** New batch endpoint `GET /api/sdr/activity/batch?userIds=id1,id2,...`. Team page now does a single batch request; activity status is resolved in one DB query.
- **Files:** `app/api/sdr/activity/batch/route.ts` (new), `app/manager/team/page.tsx`

### 3. **Heavy comms bundle on first load**
- **Issue:** ThreadView, NewThreadModal, and SearchPanel were imported eagerly on the manager comms page, increasing initial JS.
- **Fix:** These components are loaded with `next/dynamic` and `ssr: false`, so they are fetched when the thread list is shown or when the user opens the modal/panel.
- **File:** `app/manager/comms/page.tsx`

### 4. **No response caching for stats**
- **Issue:** Dashboard and team stats were recomputed on every request.
- **Fix:** Added `Cache-Control: private, s-maxage=15, stale-while-revalidate=30` on `/api/actions/stats` so short-lived caching can be used where applicable.
- **File:** `app/api/actions/stats/route.ts`

## Already in good shape

- **Manager dashboard:** Uses `Promise.all` for stats, missions, and files; no change needed.
- **Planning page:** Uses `Promise.all` for sdrs, planning, missions; no change needed.
- **Comms page:** Initial `fetchThreads` and `fetchStats` were already triggered together in one `useEffect` (both run in parallel).
- **Root layout:** Uses Next.js `next/font` (Geist); fonts are optimized by the framework.

## Recommendations for later

1. **Prospects page:** Confirm list API uses cursor/offset pagination and indexes; add loading skeletons if not present.
2. **API routes:** Consider `unstable_cache` or Redis for frequently hit read-only endpoints (e.g. dashboard stats) if traffic grows.
3. **Images:** Use `next/image` and explicit dimensions where applicable to avoid layout shift and improve LCP.
4. **Lighthouse:** Run Lighthouse on key routes (dashboard, team, comms) and fix any remaining LCP/CLS/blocking resource issues.
