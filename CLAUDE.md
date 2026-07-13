# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Project Overview

**PHCloud CMS** — The world's lightest CMS, running entirely on Cloudflare Workers free tier.

- 12 files, ~50KB bundle, zero runtime dependencies
- Hono v4.12 framework (NOT Astro)
- TypeScript 7.0 with full type safety
- Cloudflare D1 (SQLite) + KV for persistence

---

## Quick Commands

```bash
# Install dependencies
npm install

# Run locally (dev server on :8787)
npm run dev

# Deploy to Cloudflare
npm run deploy

# TypeScript check
npx tsc --noEmit
```

---

## Architecture

```
phcloud/
├── src/
│   ├── cms/
│   │   └── registry.ts      # Plugin hook system (CMSRegistry class)
│   ├── plugins/
│   │   ├── index.ts         # Plugin auto-discovery hub
│   │   ├── seo.ts           # SEO plugin (meta tags, Open Graph)
│   │   └── sitemap.ts       # XML sitemap generator
│   ├── themes/
│   │   └── default.ts       # Default theme (mobile-responsive)
│   ├── admin.ts             # Admin panel HTML rendering
│   └── index.ts             # Main Hono router (all routes)
├── static/                   # Static assets (favicon, etc.)
├── wrangler.jsonc           # Cloudflare config (D1, KV bindings)
└── package.json             # Dependencies + scripts
```

---

## Core Patterns

### Plugin Hook System

Plugins register hooks that execute in pipelines:

```typescript
// Register a hook
registry.register('render:head', injectScripts);

// Execute pipeline
const result = await registry.executePipeline('render:head', payload);
```

**Available hooks:**
- `render:head` — Inject meta tags, scripts, styles
- `render:body` — Modify body HTML structure
- `render:sitemap` — Add URLs to sitemap

### Route Structure

All routes in `src/index.ts` use Hono router:

| Route | Purpose |
|-------|---------|
| `GET /` | Public homepage |
| `GET /post/:slug` | Single post view |
| `GET /admin` | Admin dashboard |
| `POST /api/auth/login` | Session auth |
| `POST /api/posts` | Create post |
| `PUT /api/posts/:id` | Update post |
| `DELETE /api/posts/:id` | Delete post |
| `GET /api/plugins` | List plugins |
| `POST /api/plugins/:id/toggle` | Toggle plugin |

### Admin Panel

`src/admin.ts` renders admin HTML using template literals:
- `dashboardBody()` — Post list, stats
- `editBody()` — Post editor form
- `pluginsBody()` — Plugin manager UI

### Database Schema

D1 SQLite (in `wrangler.jsonc` or migrations):

```sql
CREATE TABLE posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  content TEXT NOT NULL,
  excerpt TEXT,
  published INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE plugins (
  id TEXT PRIMARY KEY,
  active INTEGER DEFAULT 0
);
```

---

## Important Conventions

1. **Imports always include `.js` extension** (ES modules for Workers)
2. **Type imports use `import type`** unless the value is needed at runtime
3. **All HTML responses use `c.html()`** from Hono context
4. **Empty responses use `c.body(null, 204)`** (not empty string)
5. **DB queries use explicit types:** `bind().first<DbPost>()`

---

## Common Development Tasks

### Adding a Plugin Hook

1. Define hook in `src/cms/registry.ts` documentation
2. Register in plugin: `registry.register('hook:name', handler)`
3. Execute in route: `await registry.executePipeline('hook:name', payload)`

### Adding a Route

1. Add route in `src/index.ts` using `app.get()`, `app.post()`, etc.
2. Use `initActivePlugins()` to conditionally initialize plugins
3. Pass `c.env` for D1/KV bindings

### Testing Locally

```bash
# Terminal 1: Run dev server
npm run dev

# Terminal 2: Test API
curl http://localhost:8787
curl http://localhost:8787/sitemap.xml

# Check Cloudflare Worker logs
wrangler tail
```

### Deploying

```bash
# Ensure wrangler.jsonc has correct D1/KV IDs
wrangler d1 create cms_db           # First time only
wrangler kv:namespace create cms_cache  # First time only

# Update wrangler.jsonc with binding IDs, then:
npm run deploy
```

---

## Theme/Plugin Distribution

**GitHub IS the marketplace** — no central repo, no uploads:

1. Developer creates plugin/theme → publishes on their GitHub
2. Site owner downloads `.ts` file → copies to their fork
3. Site owner registers in `src/plugins/index.ts`
4. Enable via `/admin/plugins`

**Starter templates:**
- `PLUGIN_STARTER.md` — Plugin template
- `THEME_STARTER.md` — Theme template (mobile-first CSS)

---

## Known Issues & Fixes

| Issue | Fix |
|-------|-----|
| `Cannot find name 'CMSRegistry'` | Import as value: `import { CMSRegistry }` not `import type` |
| `c.body('', 204)` signature error | Use `c.body(null, 204)` — Hono 4.12 requires null for 204 |
| Post type casting errors | Use explicit `DbPost` type with mapped fields |
| Circular import in registry.ts | Move `PluginHook` type to top of file |

---

## Files Not in This Repo

User maintains separate fork for deployment:
- `~/my-phcloud-site/` or `~/Desktop/my-phcloud-site/`
- Copy plugins/themes there for testing before publishing

---

## Brand Guidelines

See `BRAND.md` for full guidelines. Key points:
- Name: **PHCloud CMS** (NOT EdgeCMS)
- Tagline: "The world's lightest CMS"
- Colors: Cloudflare Orange #F97316, Cloud Blue #3B82F6, Slate #0F172A
- Voice: Developer-first, honest, lightweight ethos