---
routes: ["/manager/team", "/manager/users", "/manager/team?tab=reglages"]
roles: ["MANAGER", "DEVELOPER"]
keywords: ["add user", "create user", "new user", "new sdr", "delete user", "edit user", "reset password", "permissions", "role", "team", "utilisateur", "ajouter utilisateur", "créer utilisateur", "supprimer utilisateur", "mot de passe", "permission", "équipe", "accès", "droits", "désactiver", "activer"]
priority: 10
---

# Team & User Management

## Where to Find It

Go to: **Équipe → Performance** in the sidebar → click the **Réglages** tab at the top of the page.

Direct URL: `/manager/team?tab=reglages`

> Note: `/manager/users` redirects automatically to this same page.

---

## Add a New User

1. Go to `/manager/team?tab=reglages`
2. Click the **UserPlus icon** (top-right of the page) or the **"+" button**
3. Fill in the form:
   - **Prénom** (First name)
   - **Nom** (Last name)
   - **Email** — this is their login
   - **Rôle** — choose: SDR, BOOKER, MANAGER, BUSINESS_DEVELOPER, DEVELOPER
   - **Mot de passe** — temporary password (user should change it on first login)
4. Click **Créer**
5. The user can now log in immediately at `/login`

---

## Edit a User

1. Go to `/manager/team?tab=reglages`
2. Find the user in the list (search by name)
3. Click the **Edit (pencil) icon** on their row
4. Update name, email, or role
5. Click **Sauvegarder**

---

## Reset a User's Password

1. Go to `/manager/team?tab=reglages`
2. Find the user
3. Click **Edit** → update the **Mot de passe** field with a new temporary password
4. Click **Sauvegarder**
5. Tell the user their new temporary password

Alternatively, the user can self-reset via `/forgot-password` — they'll receive an email with a reset link.

---

## Deactivate / Reactivate a User

1. Go to `/manager/team?tab=reglages`
2. Find the user
3. Click the **toggle or status button** on their row (Active/Inactive)
4. Confirm — the user can no longer log in while deactivated
5. To reactivate: same toggle, flip back to Active

---

## Delete a User

1. Go to `/manager/team?tab=reglages`
2. Find the user
3. Click the **Delete (trash) icon**
4. Confirm in the dialog

> ⚠️ Deletion is permanent. The user's historical actions (calls, meetings) remain in the database but lose the user association.

---

## View Team Performance (Performance Tab)

The **Performance** tab (default at `/manager/team`) shows:

- Each SDR's **online/offline status** (colored dot: green = online, gray = offline)
- **Calls today**, calls this week, calls this month
- **Meetings booked** (weekly)
- **Conversion rate** (meetings ÷ calls)
- **Last activity** ("Actif il y a X minutes")
- **Current mission** if assigned to a block right now

**Filters available:**
- Search by name
- Filter by status: Online / Offline / Busy / Away
- Sort by: Performance / Activity / Name
- Toggle: Grid view / List view

Click any SDR card to open their **detail drawer** with full stats breakdown.

---

## User Roles — What Each Can Access

| Role | Dashboard | Manager pages | SDR pages | Client Portal | Billing |
|------|-----------|---------------|-----------|---------------|---------|
| MANAGER | `/manager/dashboard` | ✅ All | Limited | ❌ | ✅ |
| SDR | `/sdr` | ❌ | ✅ All | ❌ | ❌ |
| BOOKER | `/sdr` | ❌ | Subset | ❌ | ❌ |
| BUSINESS_DEVELOPER | `/bd/dashboard` | Partial | ✅ Calling | ❌ | ❌ |
| CLIENT | `/client/portal` | ❌ | ❌ | ✅ All | ❌ |
| COMMERCIAL | `/commercial/portal` | ❌ | ❌ | Partial | ❌ |
| DEVELOPER | `/developer/dashboard` | Partial | ❌ | ❌ | ❌ |

---

## Manage Granular Permissions

Beyond roles, individual permissions can be overridden:

1. Go to `/manager/team?tab=reglages`
2. Click **Edit** on a user
3. Click **Gérer les permissions** (Manage permissions)
4. Toggle individual permissions ON/OFF (pages, features, actions)
5. These override the default role permissions

Use this to, for example, give an SDR access to analytics without making them a manager.

---

## Master Password (Emergency Access)

Managers can access all accounts using the **Master Password** configured in system settings.

Location: `/manager/settings` → look for Master Password section.

> Only use for emergencies (locked out user, urgent data retrieval).

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| User can't log in | Check if account is Active in Réglages tab. Reset password if needed. |
| User doesn't see a page | Check their role and individual permissions in Réglages. |
| Can't find the user | Use the search bar in the team list. Check they weren't deleted. |
| User stuck at /unauthorized | Their role doesn't have permission for that page. Edit their permissions. |
