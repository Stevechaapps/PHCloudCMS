# PHCloud CMS — Active Task Board
Status: migration complete, beginning Phase 2 security fixes

---

## 🟢 Done
- [x] Create migration tracking system (`src/cms/migrations.ts`)
- [x] Create backfill SQL (`backfill.sql`)
- [x] Wire `/migrate` one-shot endpoint → deployed, ran successfully (11 migrations applied)
- [x] Remove `/migrate` endpoint after successful run
- [x] Cleanup unused import

---

## 🔴 P0 — Security (blocking, do before anything else)

- [ ] Fix broken `ea()` entity encoder (6 instances in admin.ts)
  - Verify each instance with raw-byte inspection
  - Replace only the genuinely broken ones
  - Add regression test pattern to prevent recurrence
- [ ] SVG XSS — whitelist MIME types + magic-byte validation
  - Allowed: image/png, image/jpeg, image/webp
  - Reject with clear 400 error before atob()
- [ ] `escHtml()` missing `"` escape (admin.ts:999)
- [ ] Login rate limit: bypass for sessions with valid auth cookie
- [ ] Image upload: 500KB base64 size limit before atob()

---

## 🟠 P1 — Accessibility (WCAG 2.1 AA)

- [ ] Toolbar buttons: add `aria-label` (8 buttons × 2 forms = 16 instances)
- [ ] Status divs: add `aria-live="polite"` + `role="status"` (5 locations)
- [x] Content textarea: add `for="content"` label association (forms in newPostBody + editBody — pages already had it)
- [ ] Nav inputs: add `<label for>` (navBody, 2 inputs)
- [ ] Public link color: darken from `#f97316` → target ≥4.5:1 on `#f8fafc`

---

## 🟡 P2 — Correctness bugs

- [ ] Fix `catCheckboxes` → `tagCheckboxes` ID mismatch (2 locations)
- [ ] `JSON.parse` without try/catch (middleware.ts:151, index.ts:1117)
- [x] Logout `<a href="#">` → `<button type="button">`
- [ ] Add skip-to-main-content link (adminShell + shellFull)
- [ ] Public 404: add `<head>`, styles, viewport

---

## 🔵 P3 — Polish

- [ ] Plugin pipeline: replace bare `catch {}` with `console.error` logging
- [ ] Standardize topbar/sidebar nav labels
- [ ] Add image library pagination controls
- [ ] Image delete confirm → show filename (match image lib style for posts)
- [ ] Page editor forms: add Markdown toolbar + preview (parity with post editor)

---

## Decision log
- Migration approach: `runMigrations()` in code + standalone `backfill.sql` for manual runs — both exist, endpoint was one-shot and removed
- `ea()` fix: will verify raw bytes before editing, not blind-replacing all 6
