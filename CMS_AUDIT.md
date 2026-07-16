# PHCloud CMS — Architecture & Integration Audit

**Date:** 2026-07-16
**Auditor:** Senior CMS Application Developer (20yr)
**Scope:** Full codebase — all source files, config, schemas, plugins
**TypeScript:** Compiles clean (`tsc --noEmit` passes)

---

## Summary

| Severity | Count |
|----------|-------|
| **CRITICAL** | 1 |
| **HIGH** | 2 |
| **MEDIUM** | 12 |
| **LOW** | 4 |
| **Total** | **19** |

---

## CRITICAL Findings

### C-1. New Post Creation Returns No ID — Client Redirects to `/admin/edit/undefined`

**File:** `src/index.ts:232`
**Client:** `src/admin.ts:261-264`

The `POST /api/admin/posts` endpoint returns `{ ok: true }` without the created post's ID. The client-side `newPostBody()` editor expects `p.id` in the response to redirect to the edit page:

```typescript
// src/index.ts:232 — Server response
return c.json({ ok: true });
```

```javascript
// src/admin.ts:261-264 — Client expects an id
res.json().then(function(p){
  status.textContent='Saved! Redirecting…';
  setTimeout(function(){location.href='/admin/edit/'+p.id}, 500)
})
```

**Impact:** After creating any new post, the user is redirected to `/admin/edit/undefined` which returns a 404. The post IS created in the database, but the user has no way to navigate to it from the success flow. They must go to the posts list and find it manually.

**Fix:**
```typescript
// src/index.ts:232 — Return the ID
return c.json({ ok: true, id: postId });
```

---

## HIGH Findings

### H-1. SEO Plugin Not Initialized on Search Results Pages

**File:** `src/index.ts:851`

The `/search` handler creates a new `CMSRegistry()` at line 851 but **never calls `initActivePlugins()`**. The registry has zero hooks registered, so the SEO plugin's `render:head` hook never fires. Search result pages are missing all `<title>`, `<meta>`, Open Graph, canonical, and Twitter Card tags.

```typescript
// src/index.ts:851 — Missing: initActivePlugins(registry, plugins);
const registry = new CMSRegistry();
const headPayload = await registry.executePipeline("render:head", {
  // ... no hooks registered, pipeline is a no-op
});
```

**Impact:** Search pages render with no SEO metadata. Search engines and social media crawlers see an empty `<head>`. For a CMS that sells itself on being SEO-friendly, this is a significant gap.

**Fix:** Fetch active plugins from DB/KV and call `initActivePlugins(registry, plugins)` before executing pipelines, exactly as the `/:slug?` handler does.

---

### H-2. SEO Plugin Not Initialized on Tag Pages

**File:** `src/index.ts:919`

Identical issue to H-1. The `/tag/:slug` handler creates a `CMSRegistry()` at line 919 but never calls `initActivePlugins()`. Tag archive pages are missing all SEO metadata.

```typescript
// src/index.ts:919 — Missing: initActivePlugins(registry, plugins);
const registry = new CMSRegistry();
const headPayload = await registry.executePipeline("render:head", {
  // ... no hooks registered
});
```

**Impact:** Tag pages (`/tag/javascript`, etc.) have no `<title>` tag, no meta description, no Open Graph tags. Search engines cannot properly index tag pages. Social media links to tag pages show generic unfurled previews.

**Fix:** Same as H-1.

---

## MEDIUM Findings

### M-1. No Error Handling in Most API Endpoints

**File:** `src/index.ts:181-374` (Posts CRUD), `src/index.ts:463-468` (Preview), `src/index.ts:618-668` (Plugins, Settings)

The majority of API endpoints perform D1 queries without `try/catch`. If a database query fails (D1 timeout, binding mismatch, etc.), the error propagates to Hono's default error handler which returns an opaque `500 Internal Server Error` with no JSON body. The client-side error handlers (which check `res.ok`) cannot display a meaningful error message.

**Affected endpoints:**
- `POST /api/admin/posts` (line 181)
- `GET /api/admin/posts` (line 235)
- `PATCH /api/admin/posts/:id` (line 278)
- `DELETE /api/admin/posts/:id` (line 335)
- `POST /api/preview` (line 463)
- `PATCH /api/admin/plugins/:id` (line 618)
- `PATCH /api/admin/settings` (line 643)
- All tag/nav/page endpoints

**Contrast:** `POST /api/install` (line 378) correctly wraps its logic in `try/catch` and returns structured error JSON.

**Impact:** Operational debugging becomes guesswork. Users see "Error saving post" with no indication of whether it's a binding issue, a constraint violation, or a D1 outage.

**Recommendation:** Add a shared error wrapper or use Hono's built-in `onError` handler to return structured JSON errors.

---

### M-2. Plugin Hook Errors Silently Swallowed

**File:** `src/cms/registry.ts:64-68`

The `executePipeline` method catches all hook errors with an empty `catch` block:

```typescript
try {
  current = await fn(current);
} catch {
  // Skip failed hooks so one bad plugin doesn't break the page
}
```

**Impact:** If a plugin hook throws (due to bad data, network error in tag-cloud, etc.), the error is completely invisible. No logging, no metrics, no way to know a plugin is broken in production. The "skip failed hooks" behavior is correct for resilience, but the lack of observability makes debugging impossible.

**Recommendation:** At minimum, log to `console.error` (visible in Workers logs). Better: add an error counter metric or structured log entry.

---

### M-3. Rate Limiter Does Not Reset on Successful Login

**File:** `src/index.ts:80-150`

After 5 failed attempts, the IP is locked out for 5 minutes. However, the failed-attempt counter (`login:${ip}`) is never cleared on successful login. If a user fails 4 times, then succeeds, the counter stays at 4. The next typo immediately triggers lockout.

```typescript
// Line 128-131: counter incremented on failure
const newCount = attempts + 1;
await c.env.CACHE.put(key, String(newCount), { expirationTtl: 300 });
// No counter reset on successful auth (line 138+)
```

**Impact:** Legitimate users who make occasional typos after a string of failures are disproportionately locked out. The counter persists in KV for up to 5 minutes regardless of successful authentication.

**Recommendation:** Add `await c.env.CACHE.delete(key)` after successful password verification.

---

### M-4. PBKDF2 Iteration Count Is Low for 2026 Standards

**File:** `src/cms/auth.ts:6`

```typescript
const PBKDF2_ITERATIONS = 10_000;
```

OWASP recommends PBKDF2-HMAC-SHA256 with 600,000 iterations as of 2023. At 10,000 iterations, this is 60x below modern recommendations. The comment cites Workers' 10ms CPU limit, but Cloudflare Workers now support up to 30 seconds of CPU time (paid plan) or 10ms for free tier.

**Impact:** A stolen D1 database dump could be brute-forced significantly faster than modern standards allow. For a CMS admin account, this is the single most important credential.

**Recommendation:** Increase to at least 100,000 iterations. For free-tier constraints, consider migrating to argon2id via a Cloudflare binding, or increase to 60,000 as a compromise.

---

### M-5. SQL LIKE Wildcards Not Escaped in Search

**File:** `src/index.ts:825-826`

```typescript
.bind("%" + q + "%", "%" + q + "%")
```

The user's search query is wrapped in `%` wildcards and bound as a parameter (safe from injection), but the query itself is not escaped for SQL LIKE special characters. Searching for `100%` would match `100` followed by any character. Searching for `C_` would match `Ca`, `Cb`, etc.

**Impact:** Unexpected search results for queries containing `%` or `_` characters. Minor for most CMS use cases, but produces incorrect results for technical content.

**Recommendation:** Escape LIKE wildcards: `q.replace(/%/g, '\\%').replace(/_/g, '\\_')` with `ESCAPE '\\'` in the query.

---

### M-6. No Security Headers on Any Response

**File:** `src/index.ts` (global — no middleware for headers)

The application sets no security headers:
- No `Content-Security-Policy` — XSS payloads in post content execute freely
- No `X-Content-Type-Options: nosniff` — MIME type sniffing possible
- No `X-Frame-Options` — admin panel can be iframe-embedded (clickjacking)
- No `Strict-Transport-Security` — HTTPS downgrade possible
- No `Referrer-Policy`

**Impact:** While the admin is single-user and content is admin-authored, the lack of CSP means any HTML/JS in post content executes in the browser. The `marked` library does not sanitize HTML output. If an admin pastes malicious content (or if a plugin injects it), there is no defense-in-depth.

**Recommendation:** Add a response middleware that sets security headers. Cloudflare Pages adds some by default, but Workers do not.

---

### M-7. `POST /api/admin/posts` Returns 200 Without Post ID on Created Post

**File:** `src/index.ts:218-232`

`result.meta.last_row_id` is captured (line 218) and used for tag insertion, but never included in the response. The response is `{ ok: true }`.

Beyond the client-side breakage documented in C-1, this also means:
- API consumers cannot programmatically determine the new post's ID
- No preview token is returned (contrast: `PATCH` at line 332 returns `preview_token`)
- No created_at or slug confirmation

**Recommendation:** Return `{ ok: true, id: postId, preview_token: previewToken }`.

---

### M-8. Unnecessary Cache Invalidation on Post Deletion

**File:** `src/index.ts:344`

```typescript
app.delete("/api/admin/posts/:id", async (c) => {
  // ...
  await c.env.CACHE.delete("cms:posts:pub");
  await c.env.CACHE.delete("cms:homepage");
  await c.env.CACHE.delete("cms:settings");  // <-- Why?
});
```

Deleting a post should never invalidate the settings cache. This appears to be a copy-paste artifact. It forces an unnecessary D1 query on the next request that reads settings.

**Impact:** Minor performance waste. On the next page load, `getAllSettings()` will be called to re-cache settings even though nothing changed.

**Recommendation:** Remove the `cms:settings` cache invalidation from the delete handler.

---

### M-9. `/admin` Returns Raw 401 JSON When Session Expires

**File:** `src/index.ts:511-514`

```typescript
app.get("/admin", async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) return auth;  // Returns raw 401 JSON
  return c.html(adminShell("Dashboard", dashboardBody()));
});
```

When a user's session expires and they visit `/admin`, they see a raw JSON `{"error":"Invalid session"}` with status 401 — not a login page. The login form's redirect check (`getCookie` on line 612) only fires on `/admin/login`, not on `/admin`.

**Impact:** Poor UX. Users with expired sessions see a technical error instead of being redirected to login. The client-side JS in the dashboard DOES redirect on API failure (line 139), but only after the page has already rendered the error.

**Recommendation:** Check if `auth instanceof Response` and redirect to `/admin/login` instead of returning the raw JSON.

---

### M-10. `onboardingGuard` Queries D1 on Every Single Request

**File:** `src/cms/middleware.ts:16-34`

```typescript
app.use("*", onboardingGuard);
```

Every request to the CMS executes `isConfigured(c.env.DB)` which runs `SELECT value FROM settings WHERE key = 'status'`. This adds a D1 round-trip (~1-5ms) to every page load, even after the system is configured.

**Impact:** For a CMS focused on being "the world's lightest," adding a database query per request to check a status that changes exactly once (during install) is unnecessary overhead after initial setup.

**Recommendation:** Cache the configured status in KV after the first successful check. Use `getCached()` with a long TTL, or check a KV key that's only set during install.

---

### M-11. `publishScheduled` Runs on Every Homepage Request

**File:** `src/index.ts:50-65, 1139`

```typescript
app.get("/:slug?", async (c) => {
  await publishScheduled(db, c.env.CACHE);  // Runs on EVERY homepage load
```

While the KV-based throttle (skip if < 60s since last run) mitigates most of the cost, this still means the first request after 60 seconds triggers a D1 `UPDATE` query on the homepage. If D1 is slow or the WHERE clause matches many rows, homepage latency spikes.

**Impact:** Unpredictable latency on the homepage for the first visitor after each 60-second window. No error handling means a D1 failure blocks the homepage entirely.

**Recommendation:** Move scheduled publishing to a Cloudflare Cron Trigger (Worker cron) instead of piggybacking on homepage requests.

---

### M-12. `POST /api/install` Race Condition Allows Double-Install

**File:** `src/index.ts:378-459`

Two concurrent install requests could both pass the `isConfigured()` check (line 380) before either writes `status = 'configured'`. Both would then run `migrate()`, `seed()`, and create the admin account. While `migrate()` and `seed()` are idempotent, the second admin creation with `INSERT OR REPLACE` would overwrite the first admin's password.

**Impact:** Theoretical only — install is a one-time operation performed by one person. But if two browser tabs are open during setup, the second tab could overwrite the admin credentials.

**Recommendation:** Use a KV-based lock (`nx` option) to prevent concurrent installs, or add a unique constraint check before proceeding.

---

## LOW Findings

### L-1. CLAUDE.md Schema Documentation Out of Sync

**File:** `CLAUDE.md` vs `src/cms/d1.ts`

CLAUDE.md documents the `posts` table as:
```sql
CREATE TABLE posts (... content TEXT NOT NULL, excerpt TEXT, published INTEGER DEFAULT 0 NOT NULL, ...)
```

The actual schema (with migrations) includes three additional columns:
- `type TEXT NOT NULL DEFAULT 'post'` — distinguishes posts from pages
- `publish_at TEXT` — scheduled publishing
- `preview_token TEXT` — preview URLs for unpublished posts

**Impact:** Developer confusion. Someone reading CLAUDE.md and writing queries against the documented schema would miss the `type`, `publish_at`, and `preview_token` columns.

---

### L-2. `var` Declarations in Admin Panel Inline Scripts

**File:** `src/admin.ts` (multiple functions)

All inline `<script>` blocks in admin templates use `var` instead of `let`/`const`:

```javascript
var titleEl=document.getElementById('title');
var slugEl=document.getElementById('slug');
```

**Impact:** No functional impact — `var` works correctly. But it signals dated code style and risks accidental hoisting bugs in more complex logic. With `"target": "ES2022"` in tsconfig, modern syntax is available.

---

### L-3. Redundant KV Cache Deletion in Image Delete

**File:** `src/index.ts:734-742`

```typescript
app.delete("/api/admin/images/:id", async (c) => {
  // ...
  await deleteImage(c.env.DB, id, c.env.CACHE);  // Already deletes KV
  await c.env.CACHE.delete(`img:${id}:data`);     // Redundant
  await c.env.CACHE.delete(`img:${id}:meta`);      // Redundant
});
```

The `deleteImage()` function in `images.ts:30-34` already deletes both KV keys when a KV namespace is passed. The subsequent manual deletes are redundant.

**Impact:** Two unnecessary KV delete operations per image deletion. Harmless but wasteful.

---

### L-4. Preview Token URL Construction Missing Base URL

**File:** `src/admin.ts:363-365`

```typescript
var previewLink = post.preview_token
  ? "/" + post.slug + "?preview=" + post.preview_token
  : "";
```

The preview link is a relative path (`/my-post?preview=abc123`). This works for browser navigation, but if the admin panel is ever accessed behind a reverse proxy with a base path (e.g., `/cms/admin`), the link would break. This is a hypothetical concern for the current single-domain deployment.

**Impact:** No impact under normal deployment. Would matter if a base path is introduced.

---

## Passed Checks (No Issues Found)

| Check | Status | Notes |
|-------|--------|-------|
| **Route ordering** | PASS | All admin and API routes registered before `/:slug?` catch-all. Static routes (`/sitemap.xml`, `/feed.xml`, `/search`, `/health`, `/tag/:slug`, `/img/:id`) all precede catch-all. |
| **Import paths** | PASS | All local imports use `.js` extensions. No circular dependencies detected across 14 source files. |
| **Auth flow** | PASS | Login → session creation → cookie → `requireAuth` guard flow is complete. Cookies set with `httpOnly`, `sameSite: Lax`, `secure`. Constant-time password comparison implemented correctly. |
| **Database schema** | PASS | 7 tables created idempotently via `CREATE TABLE IF NOT EXISTS`. Migration system tracks applied changes. ALTER TABLE statements for schema evolution. Indexes on slug, published, type. Backfill logic handles NULL defaults. |
| **Image pipeline** | PASS | Upload: validates MIME (PNG/JPEG/WebP), enforces ~500KB limit, stores as BLOB in D1. Serve: KV-first with D1 fallback, 30-day KV TTL, immutable cache headers. Delete: removes from D1 and KV. |
| **Markdown pipeline** | PASS | Uses `marked` v12 with GFM. Link sanitizer strips `javascript:` and `data:` URIs. Preview endpoint correctly authenticated. |
| **Settings CRUD** | PASS | GET returns all settings. PATCH updates individually with proper cache invalidation. |
| **Preview system** | PASS | Token-based preview URLs for unpublished posts. Token stored in DB, passed as `?preview=` query param. |
| **RSS feed** | PASS | Valid RSS 2.0 XML structure. Uses `escXml` for proper escaping. Filters to published posts of type 'post'. Limits to 50 items. |
| **Sitemap plugin** | PASS | Integrates with `render:sitemap` hook pipeline. Generates standards-compliant XML. Only active when plugin enabled. Returns 204 when inactive. |
| **Onboarding flow** | PASS | Install wizard shown when `settings.status != 'configured'`. Install endpoint validates password length, creates schema, seeds data, sets status last to prevent partial-lock. |
| **Plugin discovery** | PASS | `AVAILABLE_PLUGINS` array in `src/plugins/index.ts` provides manifest, hooks, and init function. `initActivePlugins()` correctly initializes only active plugins. |
| **Pagination** | PASS | All list endpoints (posts, images, search, tag pages) implement offset-based pagination with consistent `page`/`totalPages` response structure. |

---

## Architecture Observations

### Strengths
1. **Impressive bundle size** — Two runtime dependencies (hono, marked), ~60KB. True to the "lightest CMS" promise.
2. **Clean plugin architecture** — Hook-based pipeline system is extensible without modifying core. Manifest system provides good plugin metadata.
3. **Solid auth foundation** — PBKDF2 with constant-time comparison, rate limiting, httpOnly secure cookies, session management via KV.
4. **Smart caching strategy** — `getCached()` helper with TTL prevents redundant D1 queries. Image serving uses KV as L1 cache.
5. **Idempotent migrations** — Schema evolution via `IF NOT EXISTS` and `ALTER TABLE` with error swallowing. Safe to run repeatedly.
6. **No build step** — Wrangler dev serves TypeScript directly. Developer experience is fast.

### Technical Debt
1. **No test suite** — Zero test files in the repository. For a CMS handling auth and data, integration tests for the critical paths would prevent regressions.
2. **Inline HTML templates** — `admin.ts` is 991 lines of template literals with embedded `<script>` tags. Server-rendered HTML mixed with client-side JS makes the admin panel difficult to modify or debug.
3. **No TypeScript types for Hono route parameters** — `c.req.param("id")` returns `string` implicitly. Type-safe routes (`app.get('/admin/edit/:id', ...)` with typed params) would catch binding errors at compile time.
4. **Client-side image processing** — The editor resizes images via Canvas API to 1200px wide and converts to WebP at 0.7 quality. This is clever for size reduction but means the server receives different formats depending on browser capabilities.

---

*End of audit.*
