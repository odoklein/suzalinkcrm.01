# How to test config-driven action status and workflow

## 1. Apply database changes and seed

From the project root:

```bash
npx prisma migrate deploy
npx prisma generate
npx prisma db seed
```

- **migrate deploy**: applies the migration that adds `ActionStatusDefinition` and `ActionNextStep` (and enums).
- **generate**: regenerates the Prisma client.
- **db seed**: inserts GLOBAL status definitions (same behavior as before; no overrides yet).

If you hit "max clients" on a pooled DB, wait and retry or run migrate/seed when traffic is low.

---

## 2. Start the app

```bash
npm run dev
```

Open **http://localhost:3000**.

---

## 3. Log in

Use a user with role **SDR**, **MANAGER**, or **BUSINESS_DEVELOPER** (e.g. `sdr@suzali.com` / `test123` from seed).

---

## 4. Test the config API

**Get effective statuses for a mission**

1. In the app, go to **Appeler** (`/sdr/action`) and select a mission so you have a `missionId` (e.g. from the network tab or from the missions list).
2. In the browser or with curl (replace `MISSION_ID` and use a valid session cookie if needed):

```bash
# With missionId (from SDR action page after selecting a mission)
curl -s "http://localhost:3000/api/config/action-statuses?missionId=MISSION_ID" -H "Cookie: next-auth.session-token=YOUR_SESSION"
```

Or from the browser console while logged in on `/sdr/action`:

```js
const missionId = document.querySelector('select')?.value; // or from React state
const res = await fetch(`/api/config/action-statuses?missionId=${missionId}`);
const json = await res.json();
console.log(json);
```

You should get `{ success: true, data: { statuses: [...], nextSteps: [] } }` with 8 statuses (NO_RESPONSE, BAD_CONTACT, INTERESTED, CALLBACK_REQUESTED, MEETING_BOOKED, MEETING_CANCELLED, DISQUALIFIED, ENVOIE_MAIL) and labels/requiresNote/priority.

---

## 5. Test the SDR action page (card + table)

1. Go to **Appeler** (`/sdr/action`).
2. Select a **mission** (and optionally a list) that has contacts/companies to call.
3. **Card view**:
   - You should see one “next” contact/company.
   - Result buttons and labels should come from the config API (same as before if GLOBAL only).
   - Choose a result that requires a note (e.g. **Intéressé**, **Rappel demandé**): the note field should show as required (*) and submit should fail without a note.
   - Submit with a valid result and note: action is created; next item loads.
4. **Table view**:
   - Switch to table view; the queue should load with **priority** (Rappel, Suivi, Nouveau, Relance) from config.
   - Filter by “Statut” or “Priorité”; the options should reflect config.
   - Open a row’s drawer and record an action: same result options and note rules.

---

## 6. Test queue ordering (config-driven priority)

1. In **Appeler**, use table view and note the **Priorité** column (e.g. CALLBACK, FOLLOW_UP, NEW, RETRY).
2. These come from `StatusConfigService.getPriorityForResult` using the mission’s effective config (GLOBAL seed = same as before).
3. In **Card view**, click “Suivant” / submit an action and confirm the **next** item is the one with highest priority (e.g. callbacks first, then follow-ups, then new, then retries).

---

## 7. Test drawers

1. From the SDR action table, click a row to open the **UnifiedActionDrawer**.
2. In the “Ajouter une action” section, the result dropdown should list the same statuses as the config API, with correct labels.
3. Select **Rappel demandé** or **Intéressé**: note should be required (*).
4. Record an action and close; queue should refresh and priority should match config.
5. Optionally open **ContactDrawer** or **CompanyDrawer** from lists that have a mission context: same status options and note rules when `missionId` is available.

---

## 8. Quick checklist

| What to check | How |
|---------------|-----|
| Config API returns statuses | `GET /api/config/action-statuses?missionId=...` |
| SDR page uses config for result options | Result buttons/labels and filters match API |
| Note required by config | INTERESTED / CALLBACK_REQUESTED / ENVOIE_MAIL require note; others don’t |
| Queue priority from config | Table “Priorité” and “next” order = Callbacks → Follow-up → New → Retry |
| Creating action validates result | Only codes from config accepted; wrong code → 400 |
| Drawers use config | UnifiedActionDrawer, ContactDrawer, CompanyDrawer show config statuses and note rules when mission is set |

---

## 9. Optional: test with custom config (Phase 2)

To test overrides you’d need to insert rows into `ActionStatusDefinition` for a given **CLIENT**, **MISSION**, or **CAMPAIGN** (e.g. different label or different `requiresNote`). Today there is no admin UI; you can insert via SQL or a one-off script, then reload the SDR page and confirm labels/rules change for that scope.
