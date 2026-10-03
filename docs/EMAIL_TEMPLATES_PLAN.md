# Plan: New Email Template Management & Inlined HTML/CSS

## 1. Goals

- **New template management**: Clearer UX, better organization, and a single place to manage all email templates (manager, missions, quick-send).
- **Inlined HTML/CSS**: Support authoring with `<style>` and classes, then automatically inline CSS for maximum compatibility with Gmail, Outlook, and other clients.

---

## 2. Current State (Summary)

| Area | Current |
|------|--------|
| **Template list** | `/manager/email/templates` – grid of cards, category filter, search by name/subject. |
| **Editor** | Modal with: name, category, subject, body (text or raw HTML textarea). No visual preview, no inlining. |
| **Storage** | `EmailTemplate`: `name`, `subject`, `bodyHtml`, `bodyText`, `category`, `isShared`, `variables`, `useCount`. |
| **Usage** | Quick send (QuickEmailModal), missions (MissionEmailTemplate), sequences (step body). |
| **Variables** | `{{firstName}}`, `{{company}}`, etc. Substituted at send time in `template-variables.ts`. |
| **Send pipeline** | `quick-send` → `processTemplate()` (variables) → `/api/email/send` with `bodyHtml`. No CSS inlining. |

---

## 3. New Template Management

### 3.1 Information architecture

- **Single source of truth**: All templates live in the Manager Email Templates section. Missions and quick-send only *reference* templates (by id); no duplicate “template” entities.
- **Views**:
  - **Library** (default): All templates the user can see (own + shared), with filters (category, shared/private, search).
  - **By mission** (optional): Filter “templates assigned to mission X” from the same list or a dedicated mission config page (already exists at `/manager/missions/[id]`).
- **Categories** (keep/extend): general, intro, follow-up, sales, meeting, thank-you. Optional: add “tags” later (e.g. multi-select) if needed.

### 3.2 UI improvements

- **List**
  - Keep card grid; add “preview” hover or small preview pane (optional).
  - Show: name, category, subject snippet, use count, last used, shared/private.
  - Actions: Edit, Duplicate, Delete, “Use in mission” (navigate or open mission picker).
- **Editor**
  - **Full-page or large slide-over** instead of small modal: more room for subject + body + preview.
  - **Tabs or modes**: “Design” (rich editor or blocks) | “Code” (HTML/CSS) | “Preview”.
  - **Preview**: Live preview with variable placeholders or sample data; optional “Preview inlined” to see final email look.
  - **Variables**: Keep `{{var}}`; show a small palette of supported variables (from `SUPPORTED_VARIABLES` in `template-variables.ts`) and insert on click.
- **Creation flow**
  - “New template” → open editor with empty form.
  - Optional: “From template” (duplicate) or “From snippet” (predefined inlined blocks – see 4.3).

### 3.3 Permissions and sharing

- Keep `isShared`: when true, template is visible to other team members (existing API filter: `createdById` or `isShared`).
- No change to Prisma model required for “new management” only; optional later: `folderId` or `tagIds` if you add folders/tags.

---

## 4. Inlined HTML/CSS Email Templates

### 4.1 Why inline?

- Many email clients strip or limit `<style>` and `<link>`; inline `style=""` on elements is the most reliable way to get consistent layout and typography.
- Authors can still write maintainable HTML with `<style>` or classes; we convert to inlined HTML at send time (or at save time – see below).

### 4.2 Pipeline choice

- **Option A – Inline at send time (recommended)**  
  - Store in DB: “source” HTML (with `<style>` and/or class names).  
  - On send: substitute variables → inline CSS (e.g. with `juice`) → pass result to send.  
  - Pros: One source of truth; re-inlining if we improve the inliner; no duplicate storage.  
  - Cons: Small CPU cost per send.

- **Option B – Inline at save time**  
  - On save: run inliner once, store inlined HTML in `bodyHtml`.  
  - On send: only variable substitution.  
  - Pros: No inlining at send.  
  - Cons: If we change inliner, existing templates stay old; need to re-save or migrate.

**Recommendation:** **Option A** – inline at send time. Keep storing whatever the user entered (HTML + `<style>` or plain HTML). Add an inlining step after variable substitution in the send path.

### 4.3 Implementation (inlining)

- **Library**: Use **juice** (npm: `juice`). It inlines `<style>` (and optional `extraCss`) into element `style` attributes; supports width/height attributes and media queries.
- **New module**: e.g. `lib/email/services/inline-styles.ts`:
  - `inlineHtmlForEmail(html: string): string` – call `juice(html)` with options suited to email (e.g. `applyStyleTags: true`, `preserveMediaQueries: true` if needed).
- **Integration points** (run inlining on the final HTML before it goes to the provider):
  - `app/api/email/quick-send/route.ts`: after `processTemplate()`, call `inlineHtmlForEmail(processed.bodyHtml)` then pass to send.
  - `lib/email/services/sending-service.ts`: wherever `bodyHtml` is set for the provider, either accept already-inlined HTML or run inlining inside the service (prefer one place: e.g. in `sending-service` so all sends – quick-send, sequences, etc. – get inlining).
- **Preferred single place**: In **sending-service**, right before building the provider payload (after signature/tracking if any): `bodyHtml = inlineHtmlForEmail(bodyHtml)`. Then quick-send and sequence send both get inlining without duplicating logic.

### 4.4 Authoring experience

- **Code tab**: User can paste or write HTML with `<style>` and classes; e.g.:

```html
<style>
  .title { font-family: Arial; font-size: 18px; color: #1e293b; }
  .body { font-size: 14px; line-height: 1.5; color: #475569; }
</style>
<div class="title">Bonjour {{firstName}},</div>
<div class="body">Merci pour votre intérêt...</div>
```

- At send time: variables are replaced, then juice inlines the CSS so the email client receives inline styles.
- **Optional – Pre-built blocks**: Provide 2–3 “snippets” (e.g. header, CTA button, footer) as pre-inlined HTML fragments users can paste into the Code view. Document in UI or in a “Snippets” dropdown.

### 4.5 Schema and API

- **No schema change required** for inlining: keep storing `bodyHtml` as today (with or without `<style>`).
- Optional later: add `bodyHtmlSource` if you ever want to store both “source” and “inlined” and allow re-inlining from source; for the recommended approach (inline at send), `bodyHtml` alone is enough.
- API: Template create/update unchanged. Send API stays the same; inlining is internal to the send pipeline.

---

## 5. Implementation Outline

### Phase 1 – CSS inlining (backend)

1. Add dependency: `juice` (and `@types/juice` if needed).
2. Add `lib/email/services/inline-styles.ts`:
   - `inlineHtmlForEmail(html: string): string` using juice with email-friendly options.
   - Handle errors (e.g. invalid HTML) and fallback: return original HTML if inlining throws.
3. Integrate in `lib/email/services/sending-service.ts`:
   - After building final `bodyHtml` (variables already applied by callers; signature/tracking already appended), run `bodyHtml = inlineHtmlForEmail(bodyHtml)` before passing to provider.
4. Ensure all send paths use this service (quick-send already goes through `/api/email/send` → sending-service; sequences use sending-service). Verify no raw `bodyHtml` is sent to providers without going through this path.

### Phase 2 – Template management UI

1. **Editor**
   - Replace or extend the current modal in `app/manager/email/templates/page.tsx`:
     - Option A: Full-page editor at `/manager/email/templates/new` and `/manager/email/templates/[id]/edit`.
     - Option B: Large slide-over or expanded modal with tabs: Design / Code / Preview.
   - Add “Code” view: textarea for HTML (pre-filled with `bodyHtml`); keep subject and name.
   - Add “Preview” view: iframe or `dangerouslySetInnerHTML` with sample variable values (and optionally run inliner client-side for “preview inlined” – can use a small WASM or a next API route that returns inlined HTML for preview).
   - Add variable palette: list from `SUPPORTED_VARIABLES`, insert `{{name}}` on click.
2. **List**
   - Keep current list; improve cards (preview snippet, last used).
   - Add “Preview” action that opens a read-only preview (same preview component as in editor).
3. **Navigation**
   - Manager Email section: ensure “Templates” is prominent; optional sub-nav (Library / by category) if needed.

### Phase 3 – Optional enhancements

- **Snippets**: Add 1–2 pre-built inlined blocks (e.g. CTA button, footer) in the editor UI (dropdown or sidebar).
- **Preview API**: `GET /api/email/templates/[id]/preview?contactId=...` that returns `{ subject, bodyHtml }` with variables substituted (and optionally inlined) for a given contact, for safe preview in iframe.
- **Analytics**: Track template usage per mission/campaign (already have `useCount`; optional breakdown by mission).

---

## 6. File / Area Checklist

| Item | File / area |
|------|-------------|
| Add juice, inline-styles service | `package.json`, `lib/email/services/inline-styles.ts` |
| Integrate inlining in send path | `lib/email/services/sending-service.ts` |
| Template list + editor (tabs, preview, variables) | `app/manager/email/templates/page.tsx` or new `templates/[id]/edit/page.tsx` |
| Variable palette (use SUPPORTED_VARIABLES) | Same template editor component |
| Optional preview API | `app/api/email/templates/[id]/preview/route.ts` |
| Quick-send / sequences | No change if sending-service is the single inlining point |
| Mission template assignment | Already exists; no change |

---

## 7. Design System Note

The project rule references `designsystem.txt`; that file was not found in the repo. When implementing UI (buttons, cards, tabs, spacing), reuse existing patterns from:

- `app/manager/email/templates/page.tsx` (cards, filters, modals)
- `components/ui/` (Card, buttons)
- Other manager pages (e.g. sequences, mailboxes) for consistency (indigo/violet gradients, rounded-xl, slate palette).

---

## 8. Summary

- **Management**: One template library under Manager Email; improved editor (Code + Preview, variable palette); optional full-page or slide-over layout.
- **Inlined CSS**: Use **juice** in a new `inline-styles` service; run inlining in **sending-service** once per send so all emails (quick-send, sequences, etc.) get inlined HTML without storing two versions. Authors can use `<style>` and classes; output is email-client friendly.

This plan keeps the current data model and API contract, adds a clear place for inlining, and improves the template authoring and management experience.
