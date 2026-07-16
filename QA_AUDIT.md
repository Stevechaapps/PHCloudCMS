# PHCloud CMS — Comprehensive Functional Testing Audit

**Auditor**: Test Results Analyzer (20-year QA perspective)
**Date**: 2026-07-16
**Codebase Version**: 1.0.0 (Hono 4.12, TypeScript 7.0, Cloudflare Workers)
**Files Reviewed**: 13 source files, 1 config, 1 package manifest
**Test Files Found**: 0 (no automated tests exist)

---

## Executive Summary

| Severity | Count | Description |
|----------|-------|-------------|
| CRITICAL | 4 | Breaking bugs that crash core user flows |
| HIGH | 8 | Security/correctness issues requiring immediate fix |
| MEDIUM | 10 | Functional defects with degraded behavior |
| LOW | 12 | Minor issues and improvement opportunities |
| **TOTAL** | **34** | |

**Overall Assessment**: PHCloud CMS demonstrates solid architectural decisions — PBKDF2 with constant-time comparison, parameterized SQL queries, `SameSite: Lax` cookies, onboarding guard pattern, and a clean plugin hook system. However, the **absence of any automated tests** (0 test files found) has allowed several critical functional defects to reach the codebase. The most severe is that **the new post creation flow is broken** — users are redirected to a 404 page after successfully creating a post. Other critical issues include no JSON error handling across all API endpoints and unhandled unique constraint violations on slug collisions.

---

## CRITICAL Severity Issues

### CRIT-01: New Post Creation Returns No ID — Redirects to 404

**File**: `src/index.ts:232`
**File**: `src/admin.ts:260-264`

**Description**: The `POST /api/admin/posts` endpoint returns `{ ok: true }` without including the newly created post's ID. The admin frontend's `newPostBody()` script expects `p.id` to redirect the user to `/admin/edit/{id}`.

**Steps to Reproduce**:
1. Log in to `/admin/login`
2. Navigate to `/admin/new`
3. Fill in title, slug, content
4. Click "Save Post"
5. Observe "Saved! Redirecting..." status message
6. Browser redirects to `/admin/edit/undefined`
7. Server responds with 404 Not Found

**Expected Behavior**: Post is created, user is redirected to `/admin/edit/{actual_post_id}` to continue editing.

**Actual Behavior**: Post IS created in the database (data is not lost), but user is redirected to `/admin/edit/undefined` which returns a 404 page. The post is effectively orphaned from the editor UI until the user manually navigates to the post list.

**Root Cause**: Line 232 returns `c.json({ ok: true })` instead of `c.json({ ok: true, id: result.meta.last_row_id })`.

**Impact**: The primary user-facing workflow (create new post → edit) is completely broken. Compare with `POST /api/admin/pages` at line 1036 which correctly returns `c.json({ id: result.meta.last_row_id })`.

**Fix**:
```typescript
// src/index.ts line 232
return c.json({ ok: true, id: postId });
```

---

### CRIT-02: No JSON Parse Error Handling on Any API Endpoint

**File**: `src/index.ts` — lines 81, 185, 283, 466, 622, 646, 676, 950, 990, 1014, 1072

**Description**: Every API endpoint that reads a JSON request body uses `await c.req.json()` without try-catch. If the client sends malformed JSON, an empty body, or a non-JSON content type, the Workers runtime throws an unhandled exception resulting in a generic 500 Internal Server Error with no useful error message.

**Steps to Reproduce**:
```bash
# Send malformed JSON to any API endpoint
curl -X POST http://localhost:8787/api/admin/posts \
  -H "Content-Type: application/json" \
  -d '{invalid json'

# Send empty body
curl -X POST http://localhost:8787/api/admin/posts \
  -H "Content-Type: application/json" \
  -d ''

# Send non-JSON
curl -X POST http://localhost:8787/api/admin/posts \
  -H "Content-Type: text/plain" \
  -d 'hello'
```

**Expected Behavior**: 400 Bad Request with descriptive error message like `{ "error": "Invalid JSON in request body" }`.

**Actual Behavior**: 500 Internal Server Error with no body or a generic Workers error page.

**Impact**: Affects all 11 API endpoints that parse JSON bodies. Any client bug, proxy misconfiguration, or malicious request causes a server error. Makes debugging difficult in production.

**Affected Endpoints**:
- `POST /api/auth/login` (line 81)
- `POST /api/admin/posts` (line 185)
- `PATCH /api/admin/posts/:id` (line 283)
- `POST /api/preview` (line 466)
- `PATCH /api/admin/plugins/:id` (line 622)
- `PATCH /api/admin/settings` (line 646)
- `POST /api/admin/images` (line 676)
- `POST /api/admin/tags` (line 950)
- `POST /api/admin/nav` (line 990)
- `POST /api/admin/pages` (line 1014)
- `PATCH /api/admin/pages/:id` (line 1072)

---

### CRIT-03: Duplicate Slug Causes Unhandled 500 on Post Create/Update

**File**: `src/index.ts:201-216` (create), `src/index.ts:301-315` (update)

**Description**: The `posts` table has a `UNIQUE` constraint on the `slug` column (`src/cms/d1.ts:16`). When a user creates or updates a post with a slug that already exists in the database, SQLite throws a UNIQUE constraint violation. This exception is not caught, resulting in an unhandled 500 error.

**Steps to Reproduce**:
1. Create a post with slug "hello-world" (succeeds)
2. Create a second post with slug "hello-world"
3. Observe 500 Internal Server Error

**Expected Behavior**: 409 Conflict or 422 Unprocessable Entity with `{ "error": "A post with this slug already exists" }`.

**Actual Behavior**: Unhandled SQLite exception → 500 error. No user-friendly message. The frontend's error handling shows "Error saving post" but the root cause is invisible.

**Additional Impact on Update**: When editing a post and changing its slug to match another post's slug, the same 500 error occurs. The `UPDATE` statement at line 301 does not have a WHERE clause that would gracefully handle this — the UNIQUE constraint fires on the slug column before the update completes.

**Fix**: Wrap the INSERT/UPDATE in try-catch and check for `SQLITE_CONSTRAINT` or `UNIQUE` in the error message. Alternatively, pre-check slug uniqueness before the write.

---

### CRIT-04: Empty Slug Creates Orphaned Posts + Second Empty Slug Crashes

**File**: `src/index.ts:199-207` (post create), `src/index.ts:295-306` (post update)

**Description**: The server does not validate or transform slugs. If no slug is provided, it defaults to `""` (empty string). An empty slug means:
1. The post is accessible at `/:slug?` only as the catch-all homepage route (`/`), not as a distinct post URL
2. Creating a second post with empty slug triggers a UNIQUE constraint violation (500 error)

**Steps to Reproduce**:
1. Create post with title "Test" and slug "" (empty)
2. Post is created successfully with slug=""
3. Navigating to `https://site.com/` shows the homepage, not this post
4. Try creating another post with empty slug
5. 500 error from UNIQUE constraint on slug

**Expected Behavior**: Server should either reject empty slugs with a 400 error or auto-generate a slug from the title.

**Actual Behavior**: Empty slug is stored. Post becomes inaccessible. Subsequent empty-slug posts crash.

**Note**: The client-side auto-generates slugs from titles (`src/admin.ts:234`), but the server doesn't enforce this. A direct API call bypasses client-side validation.

---

## HIGH Severity Issues

### HIGH-01: Install Wizard Accepts Empty Username and Site Name

**File**: `src/index.ts:389,417`

**Description**: The install endpoint only validates password length (>=8 characters). The `siteName` and `adminUsername` fields accept empty strings with no server-side validation.

**Code Path**:
```typescript
// line 389 — empty string passes through
const siteName = String(body.siteName ?? "My Site");
// line 417 — empty string passes through
const adminUsername = String(body.adminUsername ?? "admin");
```

**Steps to Reproduce**:
```bash
# Submit install with empty site name
curl -X POST http://localhost:8787/api/install \
  -F "siteName=" -F "adminUsername=" -F "adminPassword=12345678"
```

**Expected Behavior**: 400 error requiring non-empty site name and admin username.

**Actual Behavior**: Installation completes with empty site name (renders blank titles across the site) and empty admin username (admin account exists but cannot log in with empty username through the login form since the form requires `required` attribute, but the account exists).

**Note**: The install form HTML has `required` on these fields (`src/cms/middleware.ts:92,95`), but direct API calls bypass this.

---

### HIGH-02: Plugin Toggle API Accepts Arbitrary Plugin IDs

**File**: `src/index.ts:618-628`

**Description**: The `PATCH /api/admin/plugins/:id` endpoint uses `INSERT OR REPLACE` without validating that the plugin ID exists in `AVAILABLE_PLUGINS`. Any arbitrary string is accepted as a plugin ID.

**Steps to Reproduce**:
```bash
# Create a non-existent plugin entry
curl -X PATCH http://localhost:8787/api/admin/plugins/fake-plugin-xyz \
  -H "Content-Type: application/json" \
  -d '{"active": true}'
```

**Expected Behavior**: 404 if plugin ID not found in `AVAILABLE_PLUGINS`.

**Actual Behavior**: A new row is inserted into the `plugins` table with `id = "fake-plugin-xyz"` and `active = 1`. This pollutes the database and would appear in the plugins manager UI on next page load (though without metadata from `AVAILABLE_PLUGINS`).

**Fix**: Validate `id` against `AVAILABLE_PLUGINS.map(p => p.id)` before the database write.

---

### HIGH-03: Image Upload MIME Type Not Verified Against Content

**File**: `src/index.ts:681-687`

**Description**: The image upload endpoint extracts the MIME type from the `data:image/xxx;base64,...` URL prefix rather than inspecting the actual file content. An attacker could craft a data URL with a `data:image/png` prefix but contain SVG or HTML content with embedded JavaScript.

**Steps to Reproduce**:
```bash
# Create a file with SVG content but PNG data URL prefix
echo '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>' > evil.svg
# Base64-encode and prefix as PNG
PNG_B64="data:image/png;base64,$(base64 < evil.svg)"
# Upload to the image endpoint
curl -X POST http://localhost:8787/api/admin/images \
  -H "Content-Type: application/json" \
  -d "{\"data\":\"$PNG_B64\",\"filename\":\"evil.png\"}"
```

**Expected Behavior**: Server should verify the file's magic bytes match the claimed MIME type. SVG/HTML content should be rejected.

**Actual Behavior**: File is stored with `mime = "image/png"` but the actual content is SVG with JavaScript. When served via `/img/:id`, the browser renders it as an SVG image, potentially executing embedded scripts if the Content-Type is `image/svg+xml` (though it's stored as `image/png`, the `Cache-Control: immutable` header means the browser won't re-validate).

**Risk**: Stored XSS via image upload. Mitigated somewhat by the fact that the image is served with `Content-Type: image/png` (which browsers won't render as SVG), but this is a defense-in-depth failure.

**Additional Concern**: The `marked` markdown library allows raw HTML in posts. If an admin embeds a reference to such a poisoned image via `![](/img/123)`, the image is served with `image/png` MIME but contains SVG content. Browser behavior varies — some may still execute scripts.

---

### HIGH-04: No Content-Security-Policy Headers

**File**: `src/index.ts:1321-1344` (shellFull), `src/admin.ts:8-89` (adminShell)

**Description**: Neither the public pages nor the admin panel include Content-Security-Policy (CSP) headers. This means if any XSS vulnerability is exploited (e.g., through the raw HTML in markdown or the image upload issue), there are no CSP mitigations to limit the impact.

**Impact**:
- Admin panel uses inline `<script>` blocks extensively (no external scripts)
- Public pages inject theme CSS inline
- No restriction on script sources, frame ancestors, or connect URLs
- Combined with the lack of HTML sanitization in `marked`, any XSS would have full impact

**Recommended CSP**:
```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'none'
```

---

### HIGH-05: Preview Token Leaked in HTML Source

**File**: `src/admin.ts:363-365`

**Description**: The edit post form includes a preview link for unpublished posts that contains the full preview token in the HTML source. Anyone who views the page source (browser DevTools, view-source, cached pages) can extract the token and access unpublished drafts.

**Code**:
```typescript
var previewLink = post.preview_token
    ? "/" + post.slug + "?preview=" + post.preview_token
    : "";
```

**Impact**: Unpublished draft content can be accessed by anyone who obtains the preview token. While UUID v4 tokens are hard to brute-force, leaking them in HTML source means they can be captured by browser extensions, corporate proxies, or shared accidentally.

**Fix Options**:
1. Don't embed the full preview URL in the page source; generate it client-side via JavaScript
2. Use a one-time-use token that's invalidated after the first access
3. Add a separate preview API endpoint that generates a short-lived signed URL

---

### HIGH-06: Post Update/Delete Returns Success for Non-Existent Resources

**File**: `src/index.ts:278-333` (update), `src/index.ts:335-346` (delete), `src/index.ts:348-374` (publish/unpublish)

**Description**: The `PATCH`, `DELETE`, `PATCH /publish`, and `PATCH /unpublish` endpoints for posts do not verify that the target post exists before executing the operation. They return `{ ok: true }` regardless of whether any rows were affected.

**Steps to Reproduce**:
```bash
# Delete a non-existent post
curl -X DELETE http://localhost:8787/api/admin/posts/999999
# Response: { "ok": true }  (no post was deleted)

# Update a non-existent post
curl -X PATCH http://localhost:8787/api/admin/posts/999999 \
  -H "Content-Type: application/json" \
  -d '{"title":"Ghost","slug":"ghost","content":"boo"}'
# Response: { "ok": true }  (no post was updated)
```

**Impact**: Users receive false confirmation that operations succeeded. The admin UI shows "Updated!" or the post disappears from the list, but the actual database state is unchanged. This can cause data loss if a user believes a delete succeeded and creates new content without realizing the old content still exists.

**Fix**: Check `result.meta.changes` after each operation and return 404 if zero rows were affected.

---

### HIGH-07: Session ID Exposed in Login JSON Response

**File**: `src/index.ts:96,149`

**Description**: The login endpoint returns the session ID in the JSON response body alongside the HTTP-only cookie. The frontend only checks `data.ok` and doesn't use the session ID, so this is unnecessary data exposure.

**Code**:
```typescript
// line 96 — existing session renewal
return c.json({ ok: true, sessionId: existingSessionId });
// line 149 — new login
return c.json({ ok: true, sessionId });
```

**Impact**: If an XSS vulnerability exists in the admin panel (e.g., through raw markdown HTML or the image upload issue), the attacker can exfiltrate the session ID from `document.cookie` (already accessible via the cookie jar) OR from the fetch response body. Double exposure increases attack surface. The session ID in the response body can be captured by network monitoring, browser extensions, or service workers.

**Fix**: Return only `{ ok: true }` in the login response. The frontend already handles this correctly (redirects to `/admin` on `data.ok`).

---

### HIGH-08: Install Auto-Login Uses Potentially Wrong Admin ID

**File**: `src/index.ts:419-441`

**Description**: The install endpoint uses `INSERT OR REPLACE INTO admins` (line 420-424), which in SQLite deletes the existing row and inserts a new one if the username already exists. The auto-login on line 438-441 uses `result.meta.last_row_id` as the admin ID for the session. If `REPLACE` was triggered (partial re-install), the `last_row_id` is correct for the new row, but:
1. Old sessions referencing the deleted admin ID are orphaned
2. The `INSERT OR REPLACE` silently deletes the old admin without warning

**Scenario**: If the install process partially completes (e.g., tables created but `status` setting not set), the user can re-trigger install. The `isConfigured()` check passes (status is not 'configured'), so install runs again. The admin with the same username is deleted and recreated with a new ID.

**Mitigation**: The install form HTML is only served when `isConfigured()` returns false, and the `/api/install` endpoint also checks this (line 380). But there's a TOCTOU race condition between the check and the INSERT.

---

## MEDIUM Severity Issues

### MED-01: Cache Invalidation Bug — Post Delete Clears Settings Cache

**File**: `src/index.ts:344`

**Description**: The `DELETE /api/admin/posts/:id` handler deletes `cms:settings` from the KV cache (line 344), which is unrelated to posts.

**Code**:
```typescript
await c.env.DB.prepare("DELETE FROM posts WHERE id = ?").bind(c.req.param("id")).run();
await c.env.CACHE.delete("cms:posts:pub");
await c.env.CACHE.delete("cms:homepage");
await c.env.CACHE.delete("cms:settings");  // ← BUG: should not be here
```

**Impact**: After every post deletion, the next page load causes an unnecessary KV read to re-fetch settings. This is a copy-paste error — likely from the settings PATCH handler. The settings cache is correctly invalidated in the settings PATCH handler at line 667.

---

### MED-02: Double KV Cache Deletion on Image Delete

**File**: `src/index.ts:740-741` + `src/cms/images.ts:30-34`

**Description**: The `DELETE /api/admin/images/:id` endpoint deletes KV cache entries directly (lines 740-741) AND passes `c.env.CACHE` to `deleteImage()` (line 739), which also deletes the same cache keys (images.ts lines 31-34). This results in four KV delete operations instead of two.

**Code in index.ts**:
```typescript
await deleteImage(c.env.DB, id, c.env.CACHE);  // deletes img:${id}:data and img:${id}:meta
await c.env.CACHE.delete(`img:${id}:data`);     // redundant
await c.env.CACHE.delete(`img:${id}:meta`);     // redundant
```

**Impact**: Harmless but wasteful. Each KV operation has latency cost. Should remove either the KV pass to `deleteImage` or the explicit deletes in the handler.

---

### MED-03: Navigation Data Not Validated as Array — Corrupted Data Crashes All Pages

**File**: `src/index.ts:1154`

**Description**: The navigation data loaded from the `nav` setting is parsed with `JSON.parse()` inside a try-catch, but there's no `Array.isArray()` check after parsing. If the stored value is valid JSON but not an array (e.g., a string, number, or object), `nav.map()` in `shellFull()` (line 1327) will throw a TypeError, crashing every public page.

**Code**:
```typescript
// line 1154 — only catches JSON.parse errors, not type errors
try { nav = JSON.parse(navVal); } catch { nav = []; }
// line 1327 — crashes if nav is not an array
const navHtml = nav.map((n) => '<a href="' + esc(n.url) + '">' + esc(n.label) + "</a>").join("");
```

**Steps to Reproduce**:
```bash
# Corrupt the nav setting directly via D1 console
# Or exploit the nav API by sending non-array data:
curl -X POST http://localhost:8787/api/admin/nav \
  -H "Content-Type: application/json" \
  -H "Cookie: phcloudcms_session=<valid_session>" \
  -d '{"items": "corrupted"}'
```

**Impact**: The entire public site becomes unavailable (500 error on every page) until the nav setting is manually corrected in D1.

**Fix**:
```typescript
try {
  const parsed = JSON.parse(navVal);
  nav = Array.isArray(parsed) ? parsed : [];
} catch { nav = []; }
```

---

### MED-04: Search LIKE Wildcard Characters Not Sanitized

**File**: `src/index.ts:826`

**Description**: User search input is passed directly into SQL `LIKE` clauses as `"%" + q + "%"` without escaping LIKE wildcard characters (`%` and `_`).

**Impact**: Not a security issue (parameterized queries prevent SQL injection), but causes unexpected behavior:
- Searching for `100%` matches any post containing `100` followed by anything (the `%` acts as a LIKE wildcard)
- Searching for `test_me` matches `testXme`, `test-me`, etc. (the `_` matches any single character)

---

### MED-05: Post DELETE Always Returns 200 Even for Non-Existent Posts

**File**: `src/index.ts:335-346`

**Description**: (Covered in HIGH-06) The DELETE endpoint returns `{ ok: true }` without checking if any rows were actually deleted. Specific impact here is that the admin UI deletes the item from the client-side list without server confirmation.

---

### MED-06: Rate Limiter Uses Shared "unknown" Key for Non-Cloudflare Requests

**File**: `src/index.ts:101`

**Description**: The login rate limiter uses `cf-connecting-ip` header, which is only present on Cloudflare-proxied requests. For local development or non-Cloudflare deployments, the IP falls back to `"unknown"`, meaning all users share the same rate limit counter.

**Impact**: In development, one failed login attempt locks out all developers for 5 minutes. In production behind Cloudflare, this works correctly. But self-hosted deployments without Cloudflare would have broken rate limiting.

---

### MED-07: No CSRF Protection on State-Changing Endpoints

**File**: All `POST`, `PATCH`, `DELETE` endpoints

**Description**: No CSRF tokens are generated or validated on any state-changing endpoint. The `SameSite: Lax` cookie attribute provides partial protection — cross-origin POST requests won't include the cookie. However, same-site form submissions (from a malicious page on the same domain) would include the cookie and be authenticated.

**Impact**: In a CMS where the admin is the only user, CSRF is lower risk than in a multi-user system. But if the admin visits a malicious page while logged in, that page could submit forms to create/delete posts, change settings, etc.

---

### MED-08: `esc()` Function Doesn't Escape Single Quotes

**File**: `src/cms/escape.ts:3-9`

**Description**: The `esc()` function escapes `&`, `<`, `>`, and `"` but not single quotes (`'` → `&#39;`).

**Impact**: Low for current usage since `esc()` is used primarily in HTML content contexts, not in single-quoted attributes. However, the `esc()` function is used in nav link generation (`src/index.ts:1328`) and tag link generation (`src/index.ts:1219`) where a future refactor could introduce single-quoted attributes. The `escAttr()` function (escape.ts:11-17) also lacks single-quote escaping.

---

### MED-09: Inconsistent API Response Formats Between Posts and Pages

**File**: `src/index.ts:232` vs `src/index.ts:1036`

**Description**: `POST /api/admin/posts` returns `{ ok: true }` (no ID), while `POST /api/admin/pages` returns `{ id: result.meta.last_row_id }` (no `ok` field). This inconsistency makes frontend development error-prone and violates API design principles.

| Endpoint | Response | ID included? |
|----------|----------|-------------|
| POST /api/admin/posts | `{ ok: true }` | No (BUG) |
| POST /api/admin/pages | `{ id: N }` | Yes |
| POST /api/admin/tags | `{ ok: true }` | No (OK) |
| DELETE /api/admin/posts/:id | `{ ok: true }` | N/A |
| DELETE /api/admin/images/:id | `204 No Content` | N/A |
| DELETE /api/admin/pages/:id | `{ ok: true }` | N/A |
| DELETE /api/admin/tags/:id | `{ ok: true }` | N/A |

---

### MED-10: No X-Frame-Options Header on Admin Panel

**File**: `src/admin.ts:8-89` (adminShell)

**Description**: The admin panel HTML is served without `X-Frame-Options` or CSP `frame-ancestors` headers. This means the admin panel can be embedded in an iframe on any domain, enabling clickjacking attacks where a malicious site overlays invisible iframes of admin actions over visible UI elements.

---

## LOW Severity Issues

### LOW-01: Slug Auto-Generation Strips All Non-ASCII Characters

**File**: `src/admin.ts:234`, `src/admin.ts:422`, `src/admin.ts:750`, `src/admin.ts:805`, `src/admin.ts:845`

**Description**: The client-side slug auto-generation uses `toLowerCase().replace(/[^a-z0-9]+/g, '-')`, which strips all Unicode characters. Titles with accented characters, CJK, or other scripts produce slugs with meaningless fragments.

**Example**: Title "Café R\u00e9sumé \u65e5\u672c\u8a9e" → slug "caf-r-sum"

**Impact**: Internationalized content loses meaning in URLs. Not a functional bug, but poor UX for non-English users.

---

### LOW-02: No Input Length Validation on Any Text Field

**File**: All create/update endpoints

**Description**: Post titles, slugs, content, excerpts, tag names, tag slugs, site name, and SEO description have no maximum length validation. D1 TEXT columns can hold up to 1MB per value.

**Impact**: A user could paste megabytes of text into the content field. While D1 would handle storage, the response latency and bandwidth would be impacted. The markdown renderer (`marked`) would also need to process the entire content synchronously.

---

### LOW-03: `publishScheduled` Runs on Every Catch-All Page Load

**File**: `src/index.ts:1139`

**Description**: The `publishScheduled()` function is called inside the `/:slug?` catch-all handler, meaning it runs on every homepage view and every post/page view. Each call performs a KV read for the debounce check.

**Impact**: Adds latency to every public page request. On high-traffic sites, this could be significant. Consider running it only on a timer or admin actions instead.

---

### LOW-04: Onboarding Guard Allows Static File Extensions to Bypass

**File**: `src/cms/middleware.ts:20`

**Description**: The onboarding guard bypasses for paths matching `\.(css|js|png|ico|svg)$`. These paths don't exist in the app, so they fall through to the catch-all handler and return 404. Not exploitable, but unintended.

---

### LOW-05: RSS Feed Excludes Pages

**File**: `src/index.ts:780`

**Description**: The RSS feed query filters `type = 'post'`, excluding pages. This is standard RSS behavior, but pages that users might want in their feed (e.g., "About" or "Changelog") are not included.

---

### LOW-06: Post List Endpoint Counts All Post Types Including Pages

**File**: `src/index.ts:243`

**Description**: The `GET /api/admin/posts` endpoint's count query (`SELECT COUNT(*) FROM posts`) counts all posts and pages together, but the admin UI labels this as "Total Posts". Pages inflate the count shown in the dashboard.

---

### LOW-07: Tag Slug Not Validated on Creation

**File**: `src/index.ts:950-960`

**Description**: Tag slugs are user-provided strings with no format validation. Slugs with spaces, special characters, or Unicode could cause URL routing issues on the `/tag/:slug` route.

---

### LOW-08: `autoExcerpt` Doesn't Strip HTML Tags

**File**: `src/index.ts:42-48`

**Description**: The `autoExcerpt()` function strips markdown syntax characters but not HTML tags. Since `marked` allows raw HTML in markdown, excerpts could contain raw HTML tags like `<div>`, `<script>`, etc.

**Impact**: Excerpts rendered with `esc()` in the post list are safe, but the auto-generated excerpt itself could contain HTML if the source content has raw HTML.

---

### LOW-09: No Health Check for D1/KV Connectivity

**File**: `src/index.ts:770`

**Description**: The `/health` endpoint returns `{ ok: true }` without verifying that D1 and KV bindings are functional. It should at minimum execute a simple read query.

---

### LOW-10: Empty Site Name Allowed After Install

**File**: `src/index.ts:389`

**Description**: If `siteName` is submitted as an empty string, the install proceeds and stores an empty `site_name`. All public pages render with blank titles.

**Note**: The install form has `required` on the field, but API calls bypass this.

---

### LOW-11: Markdown Preview Endpoint Requires Auth but Renders Raw HTML

**File**: `src/index.ts:463-468`

**Description**: The preview endpoint is correctly protected by auth, but it returns raw HTML from `marked` which includes any raw HTML in the markdown. This is documented as acceptable in `src/cms/markdown.ts:6-8` (admin-only self-XSS risk). However, the admin panel renders this with `pre.innerHTML = data.html` (`src/admin.ts:228`), so any `<script>` tags in the markdown would execute in the admin's browser.

**Mitigation**: This is accepted risk per the codebase documentation. The only user writing markdown is the authenticated admin.

---

### LOW-12: Scheduled Publish Has Race Condition with Concurrent Workers

**File**: `src/index.ts:50-65`

**Description**: The debounce mechanism uses KV with a 60-second TTL, but KV's eventual consistency means two concurrent Workers could both see a stale `lastRun` value and both execute the `UPDATE posts SET published=1` query.

**Impact**: The UPDATE is idempotent, so double-execution doesn't cause data corruption. But it wastes a DB write operation. Acceptable for a low-traffic CMS.

---

## Integration Testing Findings

### INT-01: Onboarding Guard → Install → Auto-Login Flow

**Status**: WORKING (with caveats)
- Onboarding guard correctly shows install wizard when `settings.status != 'configured'`
- Install creates tables, seeds settings, creates admin, sets status to 'configured'
- Auto-login creates session cookie and redirects to `/admin`
- **Caveat**: Empty username/siteName accepted (HIGH-01)

### INT-02: Plugin System Hook Execution

**Status**: WORKING
- `initActivePlugins()` at `src/index.ts:764-768` iterates `AVAILABLE_PLUGINS` and calls `init()` for active plugins
- Plugins register hooks in the CMSRegistry per-request (correct for stateless Workers)
- `executePipeline()` runs hooks sequentially and passes payload through
- Error in one hook is caught and skipped (registry.ts:66-68) — resilient to plugin failures

### INT-03: SEO Plugin Meta Tag Injection

**Status**: WORKING
- `src/plugins/seo.ts:6-8` registers `render:head` hook
- Hook generates `<title>`, `<meta name="description">`, `<link rel="canonical">`, Open Graph, and Twitter Card tags
- Tags are prepended to `markup` field which is inserted into `<head>` via `shellFull()`
- All values are properly escaped via `escapeHtml()`

### INT-04: Sitemap Plugin URL Inclusion

**Status**: WORKING
- Query at `src/index.ts:489-496` fetches published posts with slug and updated_at
- Sitemap plugin generates valid XML with `<url>`, `<loc>`, `<lastmod>`, `<changefreq>`, `<priority>`
- Returns 204 if plugin is inactive (`src/index.ts:485`)
- Note: Only includes posts, not pages

### INT-05: Markdown Rendering

**Status**: WORKING
- `marked` v12 with GFM enabled handles headings, bold, italic, links, code blocks, blockquotes, lists, tables, images
- Link sanitization strips `javascript:` and `data:` URLs (`src/cms/markdown.ts:19`)
- Raw HTML in markdown is passed through (documented accepted risk)

### INT-06: Image Upload → D1 Store → Serve Pipeline

**Status**: WORKING (with caveats)
- Upload: base64 decode → `saveImage()` → D1 BLOB storage → returns `/img/{id}` URL
- Serve: `/img/:id` → KV cache check → D1 query → set cache → return with immutable headers
- Delete: removes from D1 and KV
- **Caveat**: MIME type not verified against content (HIGH-03)

### INT-07: Full User Flow — Install → Login → Create → Publish → View

**Status**: **BROKEN** at step 4
1. Install → Creates admin and site ✓
2. Login → Session cookie set ✓
3. Create post → Post saved in DB ✓
4. Redirect to edit → **404 page** (CRIT-01)
5. View on homepage → Would work if post is published ✓
6. SEO meta tags → Would be injected if SEO plugin active ✓

### INT-08: Cache Header Middleware

**Status**: PARTIAL
- Server-side caching via `getCached()` works correctly (KV-based, per-key TTL)
- Image serving has proper `Cache-Control: public, max-age=31536000, immutable` headers
- No HTTP cache headers on public HTML pages (relies on browser default behavior)
- No ETag or Last-Modified headers for conditional requests

---

## Edge Case Analysis

### EDGE-01: Empty D1 (Fresh Install)
**Status**: HANDLED — Onboarding guard serves install wizard

### EDGE-02: Very Long Post Content
**Status**: NOT HANDLED — No input length validation. D1 TEXT columns support up to 1MB. The `marked` parser processes the full content synchronously. Very large content could hit Workers CPU time limits (10ms on free tier, 30s on paid).

### EDGE-03: Unicode/Special Characters in Slugs
**Status**: PARTIALLY HANDLED — Client-side strips non-ASCII from slugs. Server accepts any string. Unicode slugs would work for URL routing but might not be URL-safe without encoding.

### EDGE-04: Concurrent Requests
**Status**: MOSTLY HANDLED — D1 handles concurrent writes via SQLite locking. `publishScheduled` debounce has theoretical race condition (LOW-12). No optimistic locking on post updates (two editors could overwrite each other's changes).

### EDGE-05: Malformed JSON in API Requests
**Status**: NOT HANDLED — `c.req.json()` throws on malformed input with no catch (CRIT-02)

---

## Recommendations — Priority Order

| Priority | Issue | Effort |
|----------|-------|--------|
| P0 | CRIT-01: Return post ID in POST /api/admin/posts | 5 min |
| P0 | CRIT-02: Add JSON parse try-catch to all API endpoints | 30 min |
| P0 | CRIT-03: Handle UNIQUE constraint violations on slug | 1 hour |
| P0 | CRIT-04: Validate slug is non-empty, auto-generate if missing | 30 min |
| P1 | HIGH-01: Validate install inputs (non-empty username, siteName) | 15 min |
| P1 | HIGH-02: Validate plugin ID against AVAILABLE_PLUGINS | 15 min |
| P1 | HIGH-06: Check row affected count on update/delete | 30 min |
| P1 | MED-03: Add Array.isArray check for nav data | 5 min |
| P1 | MED-01: Remove stale cache delete from post delete handler | 2 min |
| P1 | MED-02: Remove double KV delete on image delete | 5 min |
| P2 | HIGH-03: Verify image MIME type from content | 1 hour |
| P2 | HIGH-04: Add Content-Security-Policy headers | 1 hour |
| P2 | HIGH-07: Remove sessionId from login response | 2 min |
| P2 | MED-06: Improve rate limiter for non-Cloudflare environments | 30 min |
| P2 | MED-08: Add single-quote escaping to esc() | 5 min |
| P3 | HIGH-05: Don't embed preview token in HTML source | 1 hour |
| P3 | MED-04: Sanitize LIKE wildcards in search | 15 min |
| P3 | All LOW issues | Various |

---

## Testing Infrastructure Gap

**Zero automated tests exist in this project.** The codebase has no test files (`**/*.test.*` found: 0), no test framework configured in `package.json`, and no CI/CD test pipeline.

**Recommended Test Suite**:
1. **Unit Tests**: `auth.ts` (hash/verify), `escape.ts` (esc/escAttr/escXml), `markdown.ts` (renderMarkdown), `images.ts` (save/get/delete)
2. **Integration Tests**: Full API endpoint tests using Hono's test utilities or miniflare
3. **E2E Tests**: Playwright tests covering the install → login → create → publish → view flow
4. **Security Tests**: SQL injection attempts, XSS payloads, CSRF token validation, auth bypass attempts

---

**Audit Completed**: 2026-07-16
**Total Source Lines Reviewed**: ~3,400
**Confidence Level**: High — all code paths traced from route definition through business logic to database queries
