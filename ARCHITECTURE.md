# PHCloud CMS — Architecture Plan

**The world's lightest CMS.** Running entirely on Cloudflare Workers free tier.

- Hono v4.12 (Workers runtime, not Node)
- TypeScript 7.0, strict
- Cloudflare D1 (SQLite) + KV
- ~50KB bundle, near-zero runtime deps
- 12 files, honest, developer-first

---

## 1. Design Philosophy

PHCloud CMS is intentionally tiny. It doesn't try to be WordPress, Ghost, or Strapi. It's a **single Worker** that:

- Serves a public blog from D1 with KV-cached HTML fragments
- Provides an admin panel rendered as server-side HTML (no SPA, no React, no build step beyond tsc)
- Supports a minimal plugin hook system for SEO, sitemap, and future extensions
- Stores images **locally** in D1 as base64 — no external services, no credit card required

The free-tier constraint is a feature, not a bug. Everything below is shaped by:
- 100K requests/day
- 10GB D1 storage
- 1GB KV storage
- 10ms CPU per request (hono is fast enough; `marked` is fast enough)
- No R2 (needs CC), no external image hosts (all blocked from Workers)

---

## 2. Tech Stack

| Tool | Version | Why |
|------|---------|-----|
| Hono | ^4.12.29 | Fastest Workers-native router; tiny; zero deps |
| marked | ^latest | 28KB, zero deps, GitHub-flavored markdown, the obvious choice |
| TypeScript | 7.0 | Strict type safety, ships in the bundle |
| wrangler | ^4.110 | Cloudflare dev/deploy tooling |
| prettier | ^3.6 | Lint only — tsc handles types |

**No other runtime deps.** `marked` is the second dep ever added. DOMPurify is intentionally excluded — see §7 for sanitization strategy.

---

## 3. File / Directory Structure

### Dead code to delete

- `src/cms/theme.ts` — Theme interface, `registerTheme()`/`getTheme()`. Never imported.
- `src/themes/default.ts` — Theme object with CSS. Never imported.
- `src/themes/` directory itself if it becomes empty.

### Proposed structure

```
phcloud/
├── src/
│   ├── cms/
│   │   ├── registry.ts       # Plugin hook system (unchanged)
│   │   ├── middleware.ts     # onboardingGuard + getCached (unchanged)
│   │   ├── d1.ts             # D1 schema, migrations, queries (+ images + tags tables)
│   │   ├── auth.ts           # PBKDF2 password hashing (unchanged)
│   │   └── markdown.ts       # NEW: marked wrapper + sanitize
│   ├── plugins/
│   │   ├── index.ts          # Plugin registry metadata (+ fix init, + tag-cloud entry)
│   │   ├── seo.ts            # SEO hook (+ accept site_logo, meta.image)
│   │   ├── sitemap.ts        # Sitemap hook (unchanged)
│   │   └── tag-cloud.ts      # NEW: tag-cloud render:body plugin (sidebar-aware via div.tag-cloud)
│   ├── themes/
│   │   └── default.ts        # NEW: theme module { css, layout }, light + dark via prefers-color-scheme
│   ├── admin.ts              # Admin panel HTML (tags UI, fixed paste, settings, pagination nav)
│   └── index.ts             # Main Worker (marked, /img, /tag/:slug, pagination, fixed OG image, imports theme)
├── ARCHITECTURE.md           # This file
├── package.json             # + marked
└── wrangler.toml             # bindings unchanged
```

**14 files** (was 12; +1 `markdown.ts`, +1 `tag-cloud.ts`, +1 `themes/default.ts` [replacing the deleted stale default], −1 `cms/theme.ts` [dead code] = net +2). Dead code deletion: `cms/theme.ts` only. The old `themes/default.ts` is replaced, not kept — the new one is a different shape (no `registerTheme`/runtime registry, just an exported `theme` object).

---

## 4. Database Schema

### Existing tables (keep)

```sql
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL DEFAULT '',
  slug TEXT NOT NULL UNIQUE,
  content TEXT NOT NULL DEFAULT '',
  excerpt TEXT,
  published INTEGER DEFAULT 0 NOT NULL,
  type TEXT DEFAULT 'post' NOT NULL,           -- 'post' | 'page'
  publish_at TEXT,                              -- nullable, ISO datetime
  preview_token TEXT,                           -- nullable, for draft previews
  created_at TEXT DEFAULT (datetime('now')) NOT NULL,
  updated_at TEXT DEFAULT (datetime('now')) NOT NULL
);

CREATE TABLE plugins (
  id TEXT PRIMARY KEY,
  active INTEGER DEFAULT 0 NOT NULL
);

CREATE TABLE admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE DEFAULT 'admin',
  password_hash TEXT NOT NULL
);

CREATE TABLE tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE
);

CREATE TABLE post_tags (
  post_id INTEGER NOT NULL,
  tag_id INTEGER NOT NULL,
  PRIMARY KEY (post_id, tag_id)
);
CREATE INDEX IF NOT EXISTS idx_post_tags_tag ON post_tags(tag_id);
```

### New table: images

```sql
CREATE TABLE IF NOT EXISTS images (
  id TEXT PRIMARY KEY,                          -- uuid
  mime TEXT NOT NULL,                           -- 'image/webp' (preferred) or 'image/png'/'image/jpeg'
  data TEXT NOT NULL,                           -- base64 (no data: prefix, raw base64)
  alt TEXT DEFAULT '',                          -- optional alt text
  width INTEGER,                                -- optional, for rendering hints
  height INTEGER,
  bytes INTEGER NOT NULL,                        -- byte count of decoded data
  created_at TEXT DEFAULT (datetime('now')) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_images_created ON images(created_at DESC);
```

### Migration (drop legacy category tables)

The deployed DB still has `categories` and `post_categories` from the old approach. Migration runs once on the next install/wizard:

```sql
DROP TABLE IF EXISTS post_categories;
DROP TABLE IF EXISTS categories;
CREATE TABLE IF NOT EXISTS tags (...);         -- see above
CREATE TABLE IF NOT EXISTS post_tags (...);    -- see above
CREATE INDEX IF NOT EXISTS idx_post_tags_tag ON post_tags(tag_id);
```

This is destructive — any existing category assignments are lost. Acceptable for a single-author personal CMS where the category corpus is small or empty. If you have shipping categories you want to preserve, say so and I'll write a one-time `INSERT INTO tags (name, slug) SELECT name, slug FROM categories` step before the DROP.

**Storage math:** D1 free tier = 5GB (5GB actually, not 10GB). WebP compressed to <85KB, base64 overhead ≈ 33%, so ~115KB per row. 5GB / 115KB ≈ 45,000 images. Plenty for a personal CMS.

### Settings keys used

| Key | Value |
|-----|-------|
| `status` | `'configured'` after install |
| `site_name` | public site name |
| `nav` | JSON array of `{label, url}` |
| `site_logo` | image id (e.g. `'a1b2c3'`) — NEW, optional |
| `seo_description` | default meta description — NEW, optional |

---

## 5. Route Map

Auth requirement: `S` = session cookie required, `I` = install endpoint (one-time), `P` = public.

### Public routes (P)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/` | Homepage with latest posts list |
| GET | `/:slug` | Single post or page view (supports `?preview=<token>`) |
| GET | `/tag/:slug` | Posts with a given tag |
| GET | `/search?q=` | Search published posts by title/content |
| GET | `/sitemap.xml` | XML sitemap (if sitemap plugin active) |
| GET | `/feed.xml` | RSS 2.0 feed, latest 50 posts |
| GET | `/img/:id` | Serve image from D1 by id — **NEW** |
| GET | `/health` | Uptime check |

### Admin HTML routes (S)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/admin/login` | Login form (redirects to /admin if already logged in) |
| GET | `/admin` | Dashboard with stats + recent posts |
| GET | `/admin/posts` | All posts list |
| GET | `/admin/new` | New post editor |
| GET | `/admin/edit/:id` | Edit post editor |
| GET | `/admin/pages` | Pages list |
| GET | `/admin/pages/new` | New page form |
| GET | `/admin/pages/edit/:id` | Edit page form |
| GET | `/admin/tags` | Tags CRUD |
| GET | `/admin/nav` | Nav menu editor |
| GET | `/admin/settings` | Site settings (name, logo, SEO description) |
| GET | `/admin/plugins` | Plugin manager |

### Admin API routes (S)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/auth/login` | Create session |
| POST | `/api/auth/logout` | Destroy session |
| POST | `/api/install` | One-time setup wizard (I) |
| GET/POST | `/api/admin/posts[/:id]` | List / create posts |
| PATCH | `/api/admin/posts/:id` | Update post |
| DELETE | `/api/admin/posts/:id` | Delete post |
| PATCH | `/api/admin/posts/:id/publish` | Publish now |
| PATCH | `/api/admin/posts/:id/unpublish` | Unpublish |
| GET | `/api/admin/posts/:id/tags` | Post's tags |
| GET/POST/DELETE | `/api/admin/tags[/:id]` | Tags CRUD |
| GET | `/api/admin/tags?popular=N` | Top tags by post count (for tag-cloud plugin) — **NEW** |
| GET/POST | `/api/admin/nav` | Nav menu |
| GET/POST/PATCH/DELETE | `/api/admin/pages[/:id]` | Pages CRUD |
| PATCH | `/api/admin/plugins/:id` | Toggle plugin |
| GET | `/api/admin/settings` | Read settings (site name, logo, description) — **NEW** |
| PATCH | `/api/admin/settings` | Update settings — **NEW** |
| POST | `/api/upload` | Upload image to D1 — **REPLACED** (was Imgur proxy) |

### Route order

Admin routes MUST remain registered before the `/:slug?` catch-all. This is already correct in current code — keep it.

---

## 5.5 Pagination

Public lists paginate at **10 posts/page**, admin posts list at **20/page**, search results at **20/page**. Uses `?page=N` (1-indexed, defaults to 1). No `posts_per_page` setting — keep it simple, change the constant in code if you ever want a different number.

### Query shape (D1)

All paginated post queries switch from `ORDER BY updated_at DESC` (no limit) to `ORDER BY updated_at DESC LIMIT ? OFFSET ?`:

```ts
const PER_PAGE = 10;
const page = Math.max(1, parseInt(c.req.query('page') ?? '1', 10) || 1);
const offset = (page - 1) * PER_PAGE;

const [countRow, rows] = await Promise.all([
  db.prepare("SELECT COUNT(*) AS n FROM posts WHERE published = 1 AND type = 'post'").first<{ n: number }>(),
  db.prepare(
    "SELECT slug, title, excerpt, updated_at FROM posts WHERE published = 1 AND type = 'post' ORDER BY updated_at DESC LIMIT ? OFFSET ?"
  ).bind(PER_PAGE, offset).all<{ slug: string; title: string; excerpt: string; updated_at: string }>(),
]);

const totalPages = Math.max(1, Math.ceil(countRow!.n / PER_PAGE));
```

Tag pages add `JOIN post_tags pt ON p.id = pt.post_id WHERE pt.tag_id = ?`. Search adds the `LIKE` clause and uses `PER_PAGE = 20`.

### Cache keys

Pagination breaks the naive `cms:homepage` cache key — page 1 and page 2 are different responses. Cache key becomes `cms:homepage:p1`, `cms:homepage:p2`, etc. Same for tag pages (`cms:tag:<slug>:p<N>`).

```ts
const cacheKey = `cms:homepage:p${page}`;
const rows = await getCached(c, cacheKey, 600, async () => { ... });
```

Invalidate `cms:homepage:*` on any post mutation. Since KV doesn't do prefix deletes, the simplest correct approach is: on post create/update/delete, also cache-bump a `cms:homepage:gen` counter in KV (just write a unix-ms timestamp). The getCached helper includes the gen in the key:

```ts
async function getCachedPaged(c: Context, base: string, page: number, gen: string, ttl: number, loader: () => Promise<unknown>) {
  return getCached(c, `${base}:g${gen}:p${page}`, ttl, loader);
}
```

Then post mutations do: `await c.env.CACHE.put('cms:gen', String(Date.now()))`. Reads do `const gen = await c.env.CACHE.get('cms:gen') ?? '0'`. One extra KV read per page — cheap.

### Public URLs

Older/newer pagination is plain `?page=2`, not `/page/2`. No new routes, no rewrite rules. Search engines handle `?page=` fine, and the sitemap links to all post URLs directly (not to listing pages), so pagination doesn't affect SEO.

### Render helper change to renderPostList

Currently `renderPostList(posts, siteName)` returns the full HTML for a post list. Add a small pagination footer:

```ts
function paginationHtml(currentPage: number, totalPages: number, basePath: string): string {
  if (totalPages <= 1) return '';
  let html = '<nav style="display:flex;justify-content:space-between;margin-top:2rem">';
  if (currentPage > 1) {
    html += `<a href="${basePath}?page=${currentPage - 1}" style="color:#3b82f6;text-decoration:none">← Newer</a>`;
  } else {
    html += '<span></span>';
  }
  html += `<span style="color:#94a3b8;font-size:0.85rem">Page ${currentPage} of ${totalPages}</span>`;
  if (currentPage < totalPages) {
    html += `<a href="${basePath}?page=${currentPage + 1}" style="color:#3b82f6;text-decoration:none">Older →</a>`;
  } else {
    html += '<span></span>';
  }
  html += '</nav>';
  return html;
}
```

`basePath` is `'/'` for homepage, `/tag/<slug>` for tag pages, `/search?q=...` for search (preserve the query string).

### Sitemap interaction

The sitemap plugin already lists individual post URLs (`/{slug}`), which is correct — no listing pages. Pagination is invisible to sitemap. Good.

### Where this lands in the implementation order

Pagination touches only the read paths (public routes, search route, admin posts list). Write paths are unchanged. So it's a clean addition to **Phase 1** (which already touches `renderPostList`) or a standalone **Phase 2** between markdown and images. Recommend doing it as part of Phase 1 since you're already editing the rendering helpers there.

---

## 6. Image Pipeline

### Client side (admin.ts editor)

The paste handler in `newPostBody()` and `editBody()` replaces the broken Imgur flow:

```js
contentTa.addEventListener('paste', function (e) {
  var files = e.clipboardData.files;
  if (!files.length) return;
  e.preventDefault();
  var file = files[0];
  if (!file.type.startsWith('image/')) return;

  // Client-side WebP compression via canvas
  var img = new Image();
  var reader = new FileReader();
  reader.onload = function () { img.src = reader.result; };
  reader.readAsDataURL(file);

  img.onload = function () {
    var canvas = document.createElement('canvas');
    // Cap longest edge at 1600px
    var max = 1600;
    var scale = Math.min(1, max / Math.max(img.width, img.height));
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    var ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    var quality = 0.82;
    var blob = null;
    canvas.toBlob(function (b) {
      blob = b;
      // If still over 85KB, drop quality until it fits
      if (blob && blob.size > 85 * 1024) {
        canvas.toBlob(upload, 'image/webp', 0.65);
      } else {
        upload(blob);
      }
    }, 'image/webp', quality);
  };

  function upload(b) {
    if (!b) { status.textContent = 'Compression failed'; return; }
    var fd = new FormData();
    fd.append('image', b, 'paste.webp');
    fd.append('alt', '');
    fetch('/api/upload', { method: 'POST', body: fd })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (res.id) {
          var md = '![](  /img/' + res.id + ')';
          var s = ta.selectionStart, en = ta.selectionEnd, v = ta.value;
          ta.value = v.substring(0, s) + md + v.substring(en);
          ta.selectionStart = ta.selectionEnd = s + md.length;
          ta.focus();
          status.style.color = '#16a34a';
          status.textContent = 'Image uploaded (' + Math.round(b.size / 1024) + 'KB)';
        } else {
          status.style.color = '#dc2626';
          status.textContent = res.error || 'Upload failed';
        }
      })
      .catch(function () { status.style.color = '#dc2626'; status.textContent = 'Upload error'; });
  }
});
```

Notes:
- WebP is universally supported in modern workers' browsers (Chrome/Edge/Firefox/Safari 14+). PNG fallback is unnecessary for an admin tool.
- Quality 0.82 keeps photos under 85KB at 1600px in most cases. Quality 0.65 is the fallback for stubborn images.
- Cap is 85KB because base64 encoding + D1 row overhead. 85KB raw → ~115KB stored.

### Server side (index.ts)

**`POST /api/upload`** replaces the dead Imgur proxy:

```ts
app.post('/api/upload', async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) return auth;

  const formData = await c.req.raw.formData();
  const file = formData.get('image') as File | null;
  if (!file) return c.json({ error: 'No image file provided' }, 400);

  const buf = await file.arrayBuffer();
  if (buf.byteLength > 200 * 1024) {
    return c.json({ error: 'Image too large (max 200KB)' }, 400);
  }

  const id = crypto.randomUUID();
  const base64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
  const alt = String(formData.get('alt') ?? '');
  const mime = file.type || 'image/webp';

  await c.env.DB.prepare(
    "INSERT INTO images (id, mime, data, alt, bytes, created_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).bind(id, mime, base64, alt, buf.byteLength, new Date().toISOString()).run();

  return c.json({ id });
});
```

**`GET /img/:id`** serves the image with long cache headers:

```ts
app.get('/img/:id', async (c) => {
  const img = await c.env.DB.prepare(
    "SELECT mime, data FROM images WHERE id = ?"
  ).bind(c.req.param('id')).first<{ mime: string; data: string }>();
  if (!img) return c.notFound();

  const bin = atob(img.data);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

  return new Response(bytes, {
    headers: {
      'Content-Type': img.mime,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
});
```

- Cache-Control `1 year, immutable` since image ids are immutable UUIDs.
- This route is registered BEFORE the `/:slug?` catch-all (it's a specific path).
- Optional KV cache layer for hot images — defer unless needed.

### Markdown references

Posts reference images via `![](/img/<uuid>)`. This works with `marked` out of the box.

---

## 7. Markdown Rendering

### The problem

Current `markdownToHtml` (index.ts:727) is regex chains, single-pass:
- No nested lists
- No fenced code blocks (``` )
- No tables
- No block-level vs inline ordering (h1 inside blockquote inside list fails)
- The `/(<li>.*?<\/li>\n?)+/g` wrap breaks across blank lines

Current admin `renderMd` (admin.ts:212, 348) is a copy of the same broken logic, plus a security bug:
```js
t.replace(/&/g, '&')   // NO-OP — doesn't escape & to &
```
So `renderMd('<script>')` injects `<script>` into the preview.

### The fix: `marked` on the server

New file `src/cms/markdown.ts`:

```ts
import { marked } from 'marked';

marked.setOptions({
  gfm: true,        // GitHub-flavored (tables, strikethrough, autolink)
  breaks: false,    // single \n is not a <br>
});

export function renderMarkdown(md: string): string {
  return marked.parse(md, { async: false }) as string;
}
```

Then `index.ts`:
```ts
import { renderMarkdown } from './cms/markdown.js';
// Replace markdownToHtml(post.content) calls with renderMarkdown(post.content)
// Delete the markdownToHtml function definition
```

Bundle impact: marked is ~28KB minified. Total bundle stays under 80KB — still wins hard.

### Sanitization

`marked` does NOT sanitize by default — that was removed in v4+ (DOMPurify is the recommended approach, ~20KB). For a single-admin CMS where the only person writing markdown is the admin themselves (with auth on every write endpoint), **raw marked output is acceptable**:

- XSS risk is limited to admin self-XSS (the admin types `<script>` in their own post, the admin's own browser runs it — they chose to)
- No public user-generated content path exists
- Adding DOMPurify would balloon the bundle and is overkill for a single-author CMS

**However**, link href sanitization is preserved — already in the current regex impl (`javascript:` and `data:` stripped). Use `marked`'s renderer override:

```ts
const renderer = new marked.Renderer();
const origLink = renderer.link.bind(renderer);
renderer.link = (href, title, text) => {
  const safeHref = String(href).replace(/^(javascript|data):/i, '');
  return origLink(safeHref, title, text);
};
marked.use({ renderer });
```

### Admin preview: use a server endpoint

**Kill `renderMd` in admin.ts entirely.** Replace "Preview" button with a fetch to a new endpoint:

```ts
// index.ts
app.post('/api/preview', async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) return auth;
  const { content } = await c.req.json<{ content?: string }>();
  return c.json({ html: renderMarkdown(content ?? '') });
});
```

Then in admin.ts, the preview button becomes:
```js
function togglePreview(e) {
  e.preventDefault();
  var ta = document.getElementById('content'), pre = document.getElementById('preview');
  if (pre.style.display === 'block') { pre.style.display = 'none'; ta.style.display = 'block'; return; }
  ta.style.display = 'none'; pre.style.display = 'block';
  pre.textContent = 'Loading…';
  fetch('/api/preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: ta.value })
  }).then(function (r) { return r.json(); })
    .then(function (data) { pre.innerHTML = data.html; })
    .catch(function () { pre.textContent = 'Preview failed'; });
}
```

This kills the security bug (server-side marked escapes correctly), kills the duplication (no more admin copy of markdown logic), and gives a faithful WYSIWYG preview using the same renderer as the public site.

---

## 8. SEO Redesign

### Current bug

`src/plugins/seo.ts` registers a `render:head` hook that accepts `payload.meta.image`, but index.ts never passes `image`:

```ts
// index.ts:666
const headPayload = await registry.executePipeline('render:head', {
  siteName, title: post.title, description: post.excerpt ?? '',
  markup: '',
  meta: { title: post.title, description: post.excerpt ?? '', url: new URL(c.req.url).href }
  // ← no image
});
```

### Fix: extract post image, pass site logo fallback

In `index.ts`, add a helper to find the first image in a post's rendered HTML:

```ts
function firstImageId(html: string): string | null {
  const m = html.match(/\/img\/([a-f0-9-]+)/);
  return m ? m[1] : null;
}
```

Wherever `render:head` is called for a single post:

```ts
const renderedHtml = renderMarkdown(post.content);
const imgId = firstImageId(renderedHtml);
const image = imgId ? new URL(c.req.url).origin + '/img/' + imgId : (siteLogo ? origin + '/img/' + siteLogo : undefined);

const headPayload = await registry.executePipeline('render:head', {
  siteName, title: post.title, description: post.excerpt ?? '',
  markup: '',
  meta: { title: post.title, description: post.excerpt ?? '', url: ..., image }  // ← NEW
});
```

`siteLogo` comes from a settings lookup (see §11). If neither post image nor site logo exists, `image` is `undefined` and seo.ts just omits `<meta property="og:image">`.

### seo.ts changes

Already handles `meta.image` gracefully — verify and adjust if needed:

```ts
if (meta.image) {
  markup += `<meta property="og:image" content="${escAttr(meta.image)}" />`;
  markup += `<meta name="twitter:card" content="summary_large_image" />`;
  markup += `<meta name="twitter:image" content="${escAttr(meta.image)}" />`;
} else {
  markup += `<meta name="twitter:card" content="summary" />`;
}
```

Also add: `<meta property="og:site_name" content="${escAttr(siteName)}">` always.

---

## 9. Theme System

### Current state: dead code + hardcoded anonymous theme

1. **Dead:** `src/cms/theme.ts` exports a `Theme` interface, `registerTheme()`, `getTheme()`. Never imported anywhere. Was a runtime registry — wrong abstraction. Delete.
2. **Live:** `src/index.ts` has inline `THEME_CSS` constant (line 694) and `shellFull()` (line 696) doing public rendering. Admin UI has its own inline CSS in `adminShell()` (`src/admin.ts`). This is effectively a hardcoded anonymous theme — cosmetic but not swappable.

### Decision: promote to one explicit theme file with layout presets

Replace the inline `THEME_CSS`/`shellFull` with a single importable theme module. Three layout presets, light + dark palettes via CSS custom properties, dark mode selected by the reader's OS via `prefers-color-scheme`. No admin setting, no cookie, no JS toggle button — zero state.

A theme is **not** a plugin. Plugins hook into the existing render pipeline and inject markup; the theme defines the shell the pipeline runs inside. They compose cleanly: the theme renders the outer HTML + the `/main` slot, plugins inject stuff into `<head>` and inside `<main>` via their hooks. Theme must exist before any plugin can run.

**Files:**
- `src/themes/default.ts` — theme definition (CSS strings + layout id)
- `src/cms/theme.ts` (dead) — DELETE
- The empty `src/themes/` directory stays — it now contains `default.ts`

### Theme module shape `src/themes/default.ts`

```ts
// src/themes/default.ts

export type LayoutId = 'centered' | 'sidebar-left' | 'wide';

export interface Theme {
  id: string;
  name: string;
  layout: LayoutId;
  css: string;          // full stylesheet, including a `:root` light palette
                        // and a `@media (prefers-color-scheme: dark)` dark override
}

const BASE = `
:root {
  --brand:#3b82f6;             /* Cloud Blue */
  --accent:#f97316;           /* Cloudflare Orange */
  --bg:#ffffff;
  --fg:#1e293b;
  --muted:#64748b;
  --border:#e5e7eb;
  --surface:#f8fafc;
  --maxw:720px;
  --sidebar-w:220px;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg:#0f172a;              /* Slate (from brand) */
    --fg:#e2e8f0;
    --muted:#94a3b8;
    --border:#1e293b;
    --surface:#1e293b;
    --maxw:720px;
    --sidebar-w:220px;
    /* --brand and --accent unchanged so logo/links stay brand-blue on dark */
  }
}

*{margin:0;padding:0;box-sizing:border-box}
body{font-family:system-ui,-apple-system,sans-serif;background:var(--bg);color:var(--fg);line-height:1.6}
header{border-bottom:1px solid var(--border);padding:1.25rem 2rem;max-width:var(--maxw);margin:0 auto;display:flex;align-items:center;justify-content:space-between}
header a{text-decoration:none}
header .site-name{font-weight:700;font-size:1.1rem;color:var(--fg)}
header nav{display:flex;gap:1.25rem}
header nav a{color:var(--muted);font-size:0.9rem}
header nav a:hover{color:var(--fg)}
main{max-width:var(--maxw);margin:2rem auto;padding:0 1.5rem}
footer{text-align:center;padding:2rem;color:var(--muted);font-size:0.8rem;max-width:var(--maxw);margin:0 auto}
article{border-bottom:1px solid var(--border);padding-bottom:1.5rem}
a{color:var(--brand);text-decoration:none}
a:hover{color:var(--accent)}
code{background:var(--surface);padding:0.15rem 0.35rem;border-radius:3px;font-size:0.9em}
img{max-width:100%;border-radius:6px;margin:1rem 0}
blockquote{border-left:3px solid var(--brand);padding-left:1rem;color:var(--muted);margin:1rem 0}
`;

const SIDEBAR = BASE + `
:root { --maxw:960px; }
main{display:grid;grid-template-columns:1fr var(--sidebar-w);gap:2rem;max-width:var(--maxw)}
.tag-cloud{grid-column:2/3}
@media (max-width:720px) {
  main{display:block}
  .tag-cloud{display:none}
}
`;

const WIDE = BASE + `
:root { --maxw:960px; }
`;

export const theme: Theme = {
  id: 'default',
  name: 'Default',
  layout: 'centered',           // flip to 'sidebar-left' or 'wide' in the source file to switch
  css: BASE,
};
```

### Layouts

| Layout | Variation | Behavior |
|--------|-----------|----------|
| `centered` | Default | 720px column, tag cloud (if plugin active) renders below the post list. This is the current look. |
| `sidebar-left` | Reskin | 960px content + 220px left sidebar (actually a right column via CSS grid; "left" is a misnomer post-theme-refactor name only). Tag cloud jumps into `div.tag-cloud{grid-column:2/3}` and renders next to the list instead of below it. The Tag Cloud plugin wraps its output in `<div class="tag-cloud">` so this stylesheet rule aligns it. Single-post pages ignore the sidebar — they're always full-width single column. |
| `wide` | Single column, 960px | For photo-heavy or long-form blogs. Tag cloud still renders below the list. |

### Frontend layout magic is CSS-only

`shellFull()` in index.ts already produces:

```html
<header>...</header>
<main>${bodyHtml}</main>
<footer>...</footer>
```

The theme's CSS transforms this with one rule change (`main{display:grid…}`) — no HTML structure changes, no extra DOM. The Tag Cloud plugin emits `<div class="tag-cloud">…</div>` and it lands in `grid-column:2` automatically under the sidebar layout. Under centered/wide layouts it just stacks below.

### index.ts changes

```ts
import { theme } from './themes/default.js';

// Replace inline THEME_CSS:
// Old: const THEME_CSS = '...800 chars...';
// New: nothing — theme.css is imported.

// shellFull becomes:
function shellFull(siteName: string, headMarkup: string, bodyHtml: string, nav: NavItem[]): string {
  const navHtml = nav.map((n) => '<a href="' + esc(n.url) + '">' + esc(n.label) + '</a>').join('');
  return '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><style>'
    + theme.css + '</style>' + headMarkup + '</head><body><header><a href="/" class="site-name">'
    + esc(siteName) + '</a><nav>' + navHtml
    + '<a href="/admin/login" style="color:var(--accent)">Admin</a></nav></header><main>'
    + bodyHtml + '</main><footer>Powered by PHCloud CMS on Cloudflare Workers</footer></body></html>';
}
```

`renderPost`, `renderPostList`, `renderHomepage`, `paginationHtml` stay in index.ts. They produce semantic HTML; the theme CSS handles presentation.

### How a user reskins

1. Fork the repo
2. Edit `src/themes/default.ts`:
   - Change `layout: 'sidebar-left'` to switch structural preset
   - Change palette colors in `:root` (and the `@media (prefers-color-scheme: dark)` block) to reskin COSMETIC
   - Append new CSS rules to `BASE` for custom touches
3. Optionally swap to `src/themes/dark-only.ts` by writing a new file and editing one import line in `index.ts`
4. Deploy

This is the "fork to reskin" market model documented in `BRAND.md` and the plugin distribution section: **GitHub is the marketplace.** Themes live in source, swapped by import. No runtime theme picker — that would invite a settings row, JS toggle UI, and an asset path system we don't need. Source-level swap is honest, fast, and fits the single-author ethos.

### Admin panel is not themed

The admin panel has its own inline CSS in `adminShell()` (admin.ts). It stays light-theme only — admins know what they're editing, the admin doesn't need to match the public site's look. If an admin wants dark mode while editing their own panel, that's a separate problem (browser extension, OS dark mode + admin CSS). Not in scope for this plan.

---

## 10. Plugin System

### Current bug: duplication

- `plugins/index.ts` exports `AVAILABLE_PLUGINS` (metadata array) AND `initAllPlugins(registry)` — but `initAllPlugins` is never called.
- `index.ts` has its own `initActivePlugins(registry, activePlugins)` (line 431) that does the actual work, and uses a separate `Record<string, boolean>` shape instead of the array.

### Fix:专用 one source of truth

Delete `initAllPlugins` from `plugins/index.ts`. Keep `AVAILABLE_PLUGINS` as pure metadata. Document that the live init function lives in `index.ts` because it's the only place that knows which `initXxxPlugin` functions to call:

```ts
// src/index.ts
function initActivePlugins(registry: CMSRegistry, active: Record<string, boolean>): void {
  if (active.seo) initSEOPlugin(registry);
  if (active.sitemap) initSitemapPlugin(registry);
  // new plugins: add an `if (active.<id>)` line here
}
```

The comment is already there (line 434). This is honest — adding a plugin requires editing two places (metadata in plugins/index.ts, init in index.ts). Document that in the plugin author guide in `plugins/index.ts`.

### Move init into plugins?

Alternative: have each plugin export an `init(registry)` function, and `initActivePlugins` iterates `AVAILABLE_PLUGINS`. This is cleaner. **Recommend doing this**:

```ts
// plugins/index.ts
import { initSEOPlugin } from './seo.js';
import { initSitemapPlugin } from './sitemap.js';
import { initTagCloudPlugin } from './tag-cloud.js';

export const AVAILABLE_PLUGINS = [
  { id: 'seo',       name: 'SEO Meta Tags',  category: 'seo',      ..., init: initSEOPlugin },
  { id: 'sitemap',   name: 'XML Sitemap',    category: 'seo',      ..., init: initSitemapPlugin },
  { id: 'tag-cloud', name: 'Tag Cloud',      category: 'social',   ..., init: initTagCloudPlugin },
] as const;

// src/index.ts
import { AVAILABLE_PLUGINS } from './plugins/index.js';

function initActivePlugins(registry: CMSRegistry, active: Record<string, boolean>): void {
  for (const p of AVAILABLE_PLUGINS) {
    if (active[p.id]) p.init(registry);
  }
}
```

This kills the duplication and makes adding a plugin a single-file change.

### Tag Cloud plugin (`src/plugins/tag-cloud.ts`)

A new built-in plugin that hooks `render:body` and renders a weighted tag cloud **on the homepage only** (when `payload.post` is absent). Weighted by post count → CSS font-size scale.

```ts
// src/plugins/tag-cloud.ts
import type { CMSRegistry } from '../cms/registry.js';

export function initTagCloudPlugin(registry: CMSRegistry): void {
  registry.register('render:body', async (payload: any) => {
    const { bodyHtml, post, db, siteName } = payload;
    if (post) return payload; // only on listing pages, not single posts

    const rows = await db.prepare(
      `SELECT t.slug, t.name, COUNT(pt.post_id) AS n
         FROM tags t JOIN post_tags pt ON t.id = pt.tag_id
         JOIN posts p ON pt.post_id = p.id
        WHERE p.published = 1
        GROUP BY t.id ORDER BY n DESC LIMIT 30`
    ).all<{ slug: string; name: string; n: number }>();

    if (!rows.results.length) return payload;

    const max = Math.max(...rows.results.map(r => r.n));
    const min = Math.min(...rows.results.map(r => r.n));
    const scale = (n: number) => {
      if (max === min) return 1;
      return 0.75 + 1.5 * (n - min) / (max - min); // 0.75em → 2.25em
    };

    let cloud = '<div style="margin:3rem 0;padding:1.5rem;background:#f8fafc;border-radius:6px"><h3 style="font-size:0.85rem;text-transform:uppercase;color:#94a3b8;margin-bottom:1rem">Tags</h3>';
    cloud += '<div style="display:flex;flex-wrap:wrap;gap:0.75rem;align-items:baseline">';
    for (const t of rows.results) {
      const size = scale(t.n).toFixed(2);
      cloud += `<a href="/tag/${t.slug}" style="font-size:${size}rem;color:#3b82f6;text-decoration:none">${esc(t.name)}</a>`;
    }
    cloud += '</div></div>';
    return { ...payload, bodyHtml: bodyHtml + cloud };
  });
}
```

**Hooks used:** `render:body`

**Notes:**
- The `db` handle is threaded into the `render:body` payload — current `render:body` calls in index.ts (line 667, 683) already pass `bodyHtml` and `post?`; add `db` and `siteName` to the payload object. Trivial change to two call sites.
- 30-tag cap keeps the query and rendering light. A future tweakable setting isn't worth it.
- Font sizes range from 0.75rem (least used) to 2.25rem (most used). Linear scale; if you want log scale, swap the `scale` function.
- The cloud appears below the post list on the homepage only. Per-tag pages and single posts don't show it (single posts already show their own tag list).

### Hook contract documentation

Add to `cms/registry.ts`:

```ts
/**
 * Plugin hook system. Plugins register handlers; the framework executes them
 * in pipeline order. Payloads pass by reference — each handler mutates and
 * returns the payload.
 *
 * Available hooks:
 * - `render:head`    { siteName, title, description, markup, meta: {title, description, url, image?} }
 *                    Returns { markup: string } — append meta tags, scripts, styles
 * - `render:body`    { bodyHtml, siteName, post? }
 *                    Returns { bodyHtml: string } — modify body HTML
 * - `render:sitemap` { baseUrl, posts: Array<{slug, updated_at}> }
 *                    Returns { markup: string } — append URLs
 */
```

---

## 11. Admin Panel

### Bugs to fix

1. **`renderMd` no-op escape** (admin.ts:212, 348): `t.replace(/&/g,'&')` should be `t.replace(/&/g,'&')` BUT we're killing `renderMd` entirely (see §7) in favor of `/api/preview`. So this just goes away.

2. **Settings page text** (admin.ts:759): "they auto-upload via catbox.moe" — catbox.moe is abandoned. Replace with an actual settings form (see below).

### Settings page redesign

`settingsBody()` becomes a real form. Backed by new API endpoints.

```html
<form id="settingsForm">
  <div class="form-group">
    <label>Site Name</label>
    <input type="text" id="siteName" />
  </div>
  <div class="form-group">
    <label>Site Description (meta description, used by SEO)</label>
    <input type="text" id="seoDescription" placeholder="My blog about…" />
  </div>
  <div class="form-group">
    <label>Site Logo</label>
    <div id="logoPreview"></div>
    <input type="file" id="logoFile" accept="image/*" />
  </div>
  <button type="submit" class="btn btn-primary">Save Settings</button>
</form>
```

Logo upload reuses the same `/api/upload` endpoint. After upload, the returned id is stored in settings as `site_logo`.

### New API endpoints

```ts
// src/index.ts
app.get('/api/admin/settings', async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) return auth;
  const db = c.env.DB;
  const [name, desc, logo] = await Promise.all([
    getSetting(db, 'site_name'),
    getSetting(db, 'seo_description'),
    getSetting(db, 'site_logo'),
  ]);
  return c.json({
    site_name: name ?? '',
    seo_description: desc ?? '',
    site_logo: logo ?? null,
  });
});

app.patch('/api/admin/settings', async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) return auth;
  const body = await c.req.json<{ site_name?: string; seo_description?: string; site_logo?: string | null }>();
  const db = c.env.DB;
  if (body.site_name !== undefined) {
    await db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('site_name', ?)").bind(body.site_name).run();
  }
  if (body.seo_description !== undefined) {
    await db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('seo_description', ?)").bind(body.seo_description).run();
  }
  if (body.site_logo !== undefined) {
    const val = body.site_logo ?? '';
    await db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('site_logo', ?)").bind(val).run();
  }
  await c.env.CACHE.delete('cms:config');
  return c.json({ ok: true });
});
```

Cache invalidation: `cms:config` cache invalidates on settings save. The `seo_description` is read in the homepage `render:head` pipeline call.

### Homogenize the `<script>` blocks

Not worth it. The current admin uses inline script blocks because there's no SPA / build pipeline required. Trying to extract shared JS into a separate file adds imports, build complexity, and breaks the "tweak the editor, save, deploy" flow. Leave as-is.

### Optional (lower priority) UX polish

- Show image preview thumbnails in the post editor when `![](/img/...)` is detected. Defer.
- Image library page at `/admin/images` for managing uploaded images. Defer unless user wants it.
- Drag-drop image uploads (not just paste). Defer.

---

## 12. Implementation Order

Order matters because the deployed site at https://ph.stevechaapps.workers.dev/ must keep working. Each step is independently shippable.

### Phase 1: Markdown (no UI changes, safe to ship first)

**Files touched:** `package.json`, new `src/cms/markdown.ts`, `src/index.ts`

1. `npm install marked`
2. Create `src/cms/markdown.ts` (see §7)
3. In `src/index.ts`: import `renderMarkdown`, replace all `markdownToHtml(...)` calls, delete the `markdownToHtml` function
4. Add a new endpoint `POST /api/preview` returning rendered markdown
5. Update `admin.ts` preview buttons to fetch `/api/preview` instead of using inline `renderMd`. **Kill both copies of `renderMd`** (admin.ts:212, admin.ts:348). This kills the no-op escape bug.
6. Ship. Verify markdown renders correctly (try headers, lists, code blocks, tables, nested lists).

**DB impact:** none. **Risk:** existing posts with content that relied on quirks of the old parser (e.g. `<` literal) may render differently. Acceptable — `marked` is stricter but more correct.

### Phase 2: Image pipeline

**Files touched:** `src/cms/d1.ts` (migration), `src/index.ts`, `src/admin.ts`

1. Add `images` table to `d1.ts` SCHEMA_STATEMENTS, add `CREATE TABLE IF NOT EXISTS` so it doesn't conflict with existing DB
2. Replace `POST /api/upload` in `src/index.ts` with the D1 base64 version (see §6)
3. Add `GET /img/:id` route in `src/index.ts` — register BEFORE `/:slug?` catch-all
4. Update both paste handlers in `src/admin.ts` (newPostBody, editBody) to use WebP compression + new upload endpoint (see §6). Replace the two `<script>` blocks that do `fetch('/api/upload')` with the canvas-based compressor.
5. Ship. Test by pasting an image into the editor.

### Phase 3: Settings page + SEO image

**Files touched:** `src/index.ts`, `src/admin.ts`, optionally `src/plugins/seo.ts`

1. Add `GET /api/admin/settings` and `PATCH /api/admin/settings` endpoints (see §11)
2. Rewrite `settingsBody()` in `src/admin.ts` as a real form with site name, SEO description, logo upload. Wire up the fetch calls.
3. In `src/index.ts`, read `site_logo` and `seo_description` from settings (cached in `cms:config`).
4. Pass `meta.image` in every `render:head` pipeline call (post pages use first image of the post, fallback to site logo; homepage uses logo).
5. Pass `seo_description` into homepage and search head payloads as `description`.
6. Verify seo.ts emits `og:image` and `twitter:image` when `meta.image` is set. Adjust if needed.
7. Ship. Inspect page source for twitter/og meta tags.

### Phase 4: Cleanup

**Files touched:** delete two files, edit `src/plugins/index.ts`

1. Delete `src/cms/theme.ts`
2. Delete `src/themes/default.ts` and the `src/themes/` directory
3. Refactor `src/plugins/index.ts`: keep `AVAILABLE_PLUGINS`, attach `init: initSEOPlugin` etc. to each plugin entry. Delete the unused `initAllPlugins` export.
4. Update `src/index.ts` `initActivePlugins` to iterate `AVAILABLE_PLUGINS` and call `p.init(registry)`.
5. Update `CLAUDE.md` to reflect the new file list and `marked` dependency.
6. Ship. Tests pass, dead code gone, init logic clean.

### Phase 5: Polish (optional, in priority order)

1. CSS custom properties in `THEME_CSS` for brand colors
2. Image library page `/admin/images` (list + delete + copy markdown link)
3. Drag-and-drop image upload (in addition to paste)
4. Sticky preview pane (split editor/preview view)

---

## 13. Cleanup Checklist

Track separately from Phase 4. These are bugs/garbage to remove regardless of phase:

- [ ] `src/cms/theme.ts` — delete (dead code, see §9)
- [ ] `src/themes/default.ts` — REPLACE (not delete); the stale registry-based default is replaced by the option-C theme module (see §9)
- [ ] `initAllPlugins()` in `plugins/index.ts` — delete (never called, see §10)
- [ ] Two `renderMd` copies in `admin.ts:212` and `admin.ts:348` — delete (replaced by /api/preview in Phase 1)
- [ ] `t.replace(/&/g,'&')` no-op escape in both `renderMd` copies — moot once renderMd is deleted
- [ ] Settings page text "catbox.moe" — replaced entirely in Phase 3
- [ ] `markdownToHtml` function in `index.ts:727` — deleted in Phase 1 (replaced by `renderMarkdown` from cms/markdown.ts)
- [ ] `/api/upload` Imgur proxy code (index.ts:390-417) — replaced in Phase 2
- [ ] Hardcoded Imgur Client-ID `dcd01ec7c5a4cca` in index.ts — gone with the Imgur proxy
- [ ] SEO `meta.image` field never passed by index.ts — fixed in Phase 3
- [ ] `test-paste.html` (if exists, uncommitted) — already deleted; not in repo
- [ ] Docs: see §14 for the documentation audit (README, CLAUDE.md, BRAND.md, PLUGIN_DEV.md, PLUGIN_STARTER.md, THEMES.md, THEME_DEVELOPER_GUIDE.md, THEME_STARTER.md, THEME_TEMPLATE_README.md, preview/README.md)

---

## 14. Documentation Updates

The repo has 10 markdown docs outside `node_modules/`. The architecture changes (markdown rewrite, image pipeline, tags, pagination, theme system, settings page) invalidate most of them. Audit by file:

### Inventory

| File | Action | Reason |
|------|--------|--------|
| `README.md` | **Major edit** | Image section still says ImgBB; features list mentions categories not tags; theme section describes the dead `registerTheme()` API; "12 files / 50KB / zero dependencies" tagline is now ~14 files / ~60KB / 1 dep. |
| `CLAUDE.md` | **Major edit** | Architecture block lists wrong files (still shows cms/theme.ts; missing markdown.ts, themes/default.ts, tag-cloud.ts). Schema block is stale (no images/tags tables). Route table is incomplete (missing /img/:id, /tag/:slug, /search, /feed.xml, pagination, /api/preview, settings endpoints). |
| `BRAND.md` | **Minor edit** | "Storage: R2 buckets" line under Technical Specs is wrong (we use D1, no R2 — no CC). Tagline "12 files. 50KB bundle. Zero dependencies." becomes "~14 files. ~60KB bundle. One dependency." File/path naming block is correct (cms/, plugins/, themes/, admin.ts, index.ts). Community/plugin metadata unchanged. |
| `PLUGIN_DEV.md` | **Major edit** | Hooks table invents `post:save`, `post:delete`, `user:login` — none of these exist in `cms/registry.ts`. Only `render:head`, `render:body`, `render:sitemap` are real. "Register Your Plugin" example uses `initAllPlugins()` which we're deleting (see §10) — replace with the `AVAILABLE_PLUGINS` array pattern from §10. Add a tag-cloud section as a worked example. |
| `PLUGIN_STARTER.md` | **Minor edit** | Same invented-hook bug — `registry.register('post:save', onPostSave)` will not work. Fix the example to use only real hooks. The README/install template and publishing flow are otherwise correct. |
| `THEMES.md` | **Replace** | The entire file documents the dead `registerTheme()` / runtime registry API from `cms/theme.ts`. Under option C, themes are a single static module imported by `index.ts` — no `registerTheme()`, no `shell/renderPost/renderPostList/renderHomepage` overrides, no runtime theme picker. Replace wholesale with a short guide to editing `src/themes/default.ts` (palette via `:root` + `@media (prefers-color-scheme: dark)`, layout preset enum). |
| `THEME_DEVELOPER_GUIDE.md` | **Delete** | Describes the dead theme-as-plugin system (`initYourTheme(registry)` pattern, `wrapInThemeLayout` body hook). Doesn't apply under option C. The recommendation in this file to register themes as plugins is the exact wrong direction — themes are now source files, not plugins. |
| `THEME_STARTER.md` | **Delete** | Same dead approach as THEME_DEVELOPER_GUIDE. Template assumes themes are plugins (registers `render:head` + `render:body`). Delete along with THEME_DEVELOPER_GUIDE. |
| `THEME_TEMPLATE_README.md` | **Delete** | README template for the same defunct theme-as-plugin starter repo. No longer applicable. |
| `preview/README.md` | **Delete with `preview/`** | Was the readme for the theme-starter repo's preview screenshot folder. The starter repo model is gone. Delete `preview/` directory entirely. |

### Net effect

- **Kept (edited):** `README.md`, `CLAUDE.md`, `BRAND.md`, `PLUGIN_DEV.md`, `PLUGIN_STARTER.md`
- **Replaced wholesale:** `THEMES.md`
- **Deleted:** `THEME_DEVELOPER_GUIDE.md`, `THEME_STARTER.md`, `THEME_TEMPLATE_README.md`, `preview/README.md` (+ the empty `preview/` directory)
- **Added (already exists):** `ARCHITECTURE.md` (this file)

Total doc count after the plan: **7 files** (was 10), all up-to-date.

### Concrete edit list per file

These run in Phase 4 of the implementation order alongside the cleanup checklist.

#### `README.md` (rewrite ~80 of 447 lines)
1. Remove the "Adding Images to Posts" section (ImgBB setup + API key paste — dead, replaced by built-in paste-to-upload to D1). Replace with a one-paragraph "Paste images into the editor — they're compressed to WebP and stored in your D1 database automatically. No external service, no API key."
2. "Features" table: change row "Image Upload" from "auto-uploaded to ImgBB" to "auto-compressed to WebP, stored in D1, served via /img/:id". Change "Categories" row to "Tags" and update the route from `/category/:slug` to `/tag/:slug`. Add a row "Pagination" — "10 posts/page on the homepage, tag pages, and search; 20/page in admin".
3. "Themes" section (lines ~344-401): delete the dead `registerTheme()` example and the "build script auto-discovers" claim (the `scripts/generate-theme-index.js` exists but is no longer needed under option C — themes are imported explicitly). Replace with: themes live in `src/themes/default.ts` as a `{ css, layout }` module, light/dark via `prefers-color-scheme`, switch layout by editing `layout: 'centered' | 'sidebar-left' | 'wide'`. Reskin by forking.
4. "Tech Stack" table: change "Entry Point | src/index.ts" line to add a row for markdown renderer "Markdown | [marked](https://marked.js.org) (28KB)". Update the zero-deps line: "**One runtime dependency** — `hono` (router) and `marked` (markdown)."
5. Tagline line 6: "~50KB bundle · Zero runtime dependencies" → "~60KB bundle · Two runtime dependencies (hono, marked)".
6. FAQ: add Q "How do I add a tag cloud?" A "Enable the Tag Cloud plugin at /admin/plugins." Add Q "How do I paginate posts?" A "Pagination is automatic — 10 posts/page on the homepage with prev/next links at the bottom."

#### `CLAUDE.md` (rewrite Architecture, Schema, Route Structure sections)
1. "Architecture" file tree (lines 35-49): add `cms/markdown.ts`, `themes/default.ts`, `plugins/tag-cloud.ts`; remove `cms/theme.ts`.
2. "Route Structure" table (lines 89-102): replace with the full route map from §5 of this plan — add `/img/:id`, `/tag/:slug`, `/search`, `/feed.xml`, `/api/preview`, `/api/admin/settings`. Add a note that admin routes must stay registered before the `/:slug?` catch-all (already there — keep).
3. "Admin Panel" section: add `tagsBody()`, `settingsBody()` (real form), pagination nav. Note that `renderMd` is gone, replaced by `/api/preview`.
4. "Database Schema" block: add `images`, `tags`, `post_tags` tables; remove `categories`, `post_categories`. Note the `image`, `tags`, ` seo_description`, `site_logo` setting rows.
5. "Important Conventions" #7 ("Admin routes must be registered before the `/:slug?` catch-all"): add #8 "Images use `![](/img/<uuid>)` markdown — D1 base64 storage, served via /img/:id with immutable cache headers." #9 "Markdown rendered by `marked` via `cms/markdown.ts` — don't hand-roll a parser."
6. "Common Development Tasks" — add "Adding a Tag" subsection: insert into `tags` table, link via `post_tags` join, the tag-cloud plugin auto-renders on the homepage.
7. "Theme/Plugin Distribution" block: drop "Theme" since themes are now source files. Add a "Theming" subsection pointing at `src/themes/default.ts` and §9 of ARCHITECTURE.md.

#### `BRAND.md` (3 small edits)
1. Line 58: "12 files. 50KB bundle. Zero dependencies." → "~14 files. ~60KB bundle. Two dependencies (hono, marked)."
2. Line 78 "Product Names" table: keep "PHCloud Themes" (still a real concept under option C — community shares theme files via GitHub forks, just no runtime registry).
3. Line 260 "Storage: R2 buckets" → "Storage: D1 (base64 images in `images` table)". R2 requires a credit card; this CMS explicitly avoids it.

#### `PLUGIN_DEV.md` (substantial rewrite)
1. "Available Hooks" table (lines 54-61): **DELETE rows `post:save`, `post:delete`, `user:login`** — these don't exist in `cms/registry.ts`. Only `render:head`, `render:body`, `render:sitemap` exist.
2. "Register Your Plugin" example (lines 244-279): replace the `initAllPlugins()` example with the option-C `AVAILABLE_PLUGINS` array pattern from §10 of ARCHITECTURE.md. Each plugin entry now has an `init` field: `{ id, name, ..., init: initMyPlugin }`. Remove the "add init call to initAllPlugins()" install step.
3. "Plugin Lifecycle" diagram (lines 303-319): drop "Adds to src/plugins/" → keep. Change "Registers in src/plugins/index.ts (adds import + AVAILABLE_PLUGINS entry)" → since `initActivePlugins` iterates `AVAILABLE_PLUGINS` and calls `p.init(registry)`, this is now a single-file edit (just plugins/index.ts).
4. Add a new "Example: Tag Cloud Plugin" section between Example 4 and the distribute section, adapted from §10 of ARCHITECTURE.md (queries `tags`/`post_tags`, weights font-size by post count, gates on `payload.post === undefined` so it only renders on listings).
5. "Plugin Config" example (lines 373-382): the `plugin_config` table doesn't exist in `d1.ts`. Replace with: read from the `settings` table using a namespaced key like `myplugin_ga_id`.
6. Fix the `initAllPlugins()` mention in the plugin publishing README template (line 419): replace with "Add an entry to `AVAILABLE_PLUGINS` in `src/plugins/index.ts`."
7. API Reference block (lines 456-474): `CMSRegistry` is accurate; `PluginHook` type is accurate. Keep.

#### `PLUGIN_STARTER.md` (small edits)
1. Plugin template (lines 60-81): remove `// registry.register('post:save', onPostSave);` — no such hook.
2. "Customization Checklist" #3 (lines 113-119): same — remove `post:save` from the comment example.
3. README template (line 173-202) "Register in src/plugins/index.ts" install step: replace `initPlugin(registry);` invocation with adding an `AVAILABLE_PLUGINS` array entry with `init: initPlugin`.

#### `THEMES.md` (wholesale replacement)
Replace ~395 lines with a ~150-line guide to the option-C theme file:
- What a theme is (static TS module imported by index.ts, not a plugin)
- The `Theme` interface shape: `{ id, name, layout, css }`
- Three layout presets explained, with screenshots preferred (none can ship until the file landings)
- The CSS structure: `:root` palette block, `@media (prefers-color-scheme: dark)` dark palette override, body/header/main/footer rules
- The "How to reskin" recipe: fork, edit `src/themes/default.ts`, change palette colors or flip `layout` enum, commit, push
- The "How to swap to a different theme file entirely" recipe: copy `src/themes/alt-theme.ts` from another GitHub fork into your repo, change one import line in `src/index.ts` from `'./themes/default.js'` to `'./themes/alt-theme.js'`, commit
- Note that layouts and palette are CSS-only — no template-function overrides
- Cross-link to ARCHITECTURE.md §9

#### `THEME_DEVELOPER_GUIDE.md`, `THEME_STARTER.md`, `THEME_TEMPLATE_README.md`, `preview/README.md`
Delete all four. The `preview/` directory becomes empty after `preview/README.md` is removed — delete the directory itself in Phase 4.

### Documentation sequencing

Doc updates happen in **Phase 4** of the implementation order, in parallel with the dead-code cleanup. They go in a single commit alongside the source-code deletions so the repo state is internally consistent — no commit lands where the docs describe code that no longer exists.

The exception: `ARCHITECTURE.md` itself is the planning document. It's already in the repo as of this writing; it stays as the long-form reference. CLAUDE.md points at it for detail.

---

## Appendix A: bundle size budget

| Component | Size |
|-----------|------|
| hono (tree-shaken) | ~16KB |
| marked | ~28KB |
| App code | ~15KB |
| **Total** | **~60KB** |

"50KB bundle" is aspirational — 60KB is still tiny. If `marked` becomes a burden, a hand-rolled GFM subset would be a weekend project (~6KB), but not now.

---

## Appendix B: free-tier ceilings

| Resource | Free limit | Our usage |
|----------|------------|-----------|
| Workers requests | 100K/day | Single-author blog: <1K/day typical |
| Workers CPU | 10ms/request | Blog page render: <2ms |
| D1 storage | 5GB | ~45K WebP images @ 85KB avg |
| D1 rows read | 5M/day | Blog with 100 posts × 10 pageviews = 1K reads/day |
| D1 rows written | 100K/day | One post save = a few writes |
| KV reads | 100K/day | Cached HTML fragments are the hot path |
| KV storage | 1GB | Sessions + cached pages, negligible |

No ceiling will be hit by a single-author blog. Good.

---

## Appendix C: open decisions for the user

Before implementing, confirm or adjust:

1. **WebP-only uploads?** No PNG/GIF fallback. Admin browser support requirement: Safari 14+ (released 2020). Acceptable?
2. **`marked` without DOMPurify?** Admin-only markdown, no public posts from anonymous users. XSS risk = admin self-XSS. Acceptable?
3. **Admin preview = server fetch /api/preview?** Requires a round-trip per preview toggle. Alternative: ship marked client-side (~28KB extra load on the admin panel). The server-fetch approach keeps admin bundle identical to public bundle.
4. **Image library page?** Phase 5 — recommended but optional. Say "include" to do it in Phase 2 instead.
5. **Site logo as a separate upload from hero image?** Yes — two separate settings keys (`site_logo` and a hypothetical future `hero_image`). Backed by the same `images` table.
6. **CSS custom properties for theming?** Phase 5 polish. Skip if you don't care about palette tweaks.
7. **Keep `autoExcerpt` regex-based, or run it through marked first?** Current implementation is text-only on the raw markdown. Running through marked then stripping tags would give cleaner excerpts but adds cost. Recommend keeping as-is.
8. **Tag cloud on tag pages?** Currently only the homepage shows the cloud (plugin gates on `post === undefined` and only the homepage passes that with a post list rendered). Tag pages also fit the gating — extend gating to "any listing page beyond a single post". Say "yes" to enable on `/tag/:slug` too; "no" keeps it homepage-only.
9. **Delete `preview/` directory entirely?** It currently only contains `README.md` describing the abandoned theme-starter-repo flow. No code references it. Deleting it removes one of four dead theme files at once.
10. **Fix the long-standing docs misdirection — invent `post:save`, `post:delete`, `user:login` hooks?** No — these hooks do NOT exist in `cms/registry.ts`. PLUGIN_DEV.md and PLUGIN_STARTER.md both advertise them. Either we **add** these hooks to the registry (real new hooks, more work) or we **delete them from docs** (recommended in §14). Confirm the delete-docs path; don't add the hooks.
11. **Theme distribution document** — should `THEMES.md` (the wholesale replacement) be a tutorial ("edit the file") or a reference ("the Theme interface")? I'd write it as a tutorial with reference tables at the bottom — same shape as PLUGIN_DEV.md. Confirm or override.

---

**Plan ends.** Phases 1-4 are required and atomic (Phase 4 includes the documentation audit from §14). Phase 5 is optional. Total: 1 new dep, 3 new files (`cms/markdown.ts`, `themes/default.ts` replacing one dead file, `plugins/tag-cloud.ts`), 4 markdown files deleted, ~6 markdown files edited, ~8 source files modified.
