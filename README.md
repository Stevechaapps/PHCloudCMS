# ☁️ PHCloud CMS

**A tiny, self-hosted CMS that runs entirely on Cloudflare's free tier.**

One runtime dependency ([Hono](https://hono.dev)). Content lives in D1 (serverless SQLite), images and sessions in KV. No external databases, no S3, no API keys, no credit card. Push to `main` and Cloudflare Workers Builds ships it.

```
Cloudflare Workers · Hono v4 · D1 + KV · TypeScript · one dependency
```

---

## Table of Contents

- [What it is](#what-it-is)
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Quick start (5 steps)](#quick-start-5-steps)
  - [1 — Fork the repo](#1--fork-the-repo)
  - [2 — Create a D1 database](#2--create-a-d1-database)
  - [3 — Create a KV namespace](#3--create-a-kv-namespace)
  - [4 — Add bindings to wrangler.toml](#4--add-bindings-to-wranglertoml)
  - [5 — Deploy](#5--deploy)
- [Run the onboarding wizard](#run-the-onboarding-wizard)
- [Writing content](#writing-content)
- [Images](#images)
- [Local development](#local-development)
- [Project structure](#project-structure)
- [Themes](#themes)
- [Plugins](#plugins)
- [Security](#security)
- [Tech stack](#tech-stack)
- [FAQ / Troubleshooting](#faq--troubleshooting)
- [License](#license)

---

## What it is

PHCloud is a single-worker CMS for one site. You write posts and pages in a browser-based WYSIWYG editor; they're stored as sanitized HTML in D1 and rendered through a static theme. It ships with tags, RSS, sitemap, search, SEO meta tags, and a hooks-based plugin system — all inside one Worker.

It is deliberately small: one Hono app, one router, one dependency. There is no build step, no `node_modules` shipped to the edge, and no framework runtime.

## Features

| Feature | What it does |
|---|---|
| **Admin panel** | Dashboard + full CRUD for posts, pages, tags, navigation, and settings |
| **WYSIWYG editor** | `contentEditable` rich-text editor with a formatting toolbar (bold, italic, H2/H3, link, image, blockquote, list). The toolbar buttons reflect the active selection. No markdown parser. |
| **Scheduled posts** | Publish immediately or schedule for a later datetime; unpublished posts have a private preview link |
| **Image upload** | Paste or drag an image → resized to ≤1200px and compressed to WebP client-side → stored in D1 → served from `/img/:id`, browser-cached as immutable |
| **Pages** | Static pages (About, Contact, Privacy…) alongside posts |
| **Tags** | Organize posts; browse at `/tag/:slug` |
| **Navigation** | Custom header links, editable from the admin |
| **Search** | Full-text search at `/search?q=…` |
| **RSS feed** | Auto-generated at `/feed.xml` |
| **XML sitemap** | Auto-generated at `/sitemap.xml` |
| **Themes** | One static theme file (`src/themes/default.ts`) compiled into the Worker; automatic light/dark via `prefers-color-scheme` plus a header toggle that remembers your choice |
| **Plugins** | Hooks-based TypeScript plugins. Built-in: SEO, Sitemap, Tag Cloud |
| **Onboarding wizard** | First-run setup in the browser — creates your admin account and seeds defaults |
| **Auth** | PBKDF2 password hashing (Web Crypto, 100k iterations), HTTP-only cookies, KV-backed sessions |
| **Caching** | Posts, settings, and nav cached in KV; image bytes cached in KV for 30 days. Cache is invalidated on publish/edit/delete. |
| **Edge security** | CSP, HSTS, `X-Frame-Options: DENY`, `nosniff`, strict referrer policy, locked-down permissions policy |

---

## Prerequisites

Two free accounts, no credit card on either:

1. **A GitHub account** — [sign up](https://github.com/signup)
2. **A Cloudflare account** — [sign up](https://dash.cloudflare.com/sign-up/workers-and-pages)

## Quick start (5 steps)

### 1 — Fork the repo

1. Go to [github.com/Stevechaapps/phcloudcms](https://github.com/Stevechaapps/phcloudcms)
2. Click **Fork** (top-right), pick your account, keep the `main` branch, click **Create fork**

You now have `https://github.com/<your-username>/phcloudcms`.

### 2 — Create a D1 database

D1 is Cloudflare's serverless SQLite — where all content lives.

1. Cloudflare Dashboard → **D1 SQL database** → **Create database**
2. Name it `phcloud-db`, leave location hint blank, click **Create**
3. Copy the **database ID** (a UUID). You need it in step 4.

### 3 — Create a KV namespace

KV holds image bytes, sessions, and the rendered-page cache.

1. Cloudflare Dashboard → **Workers KV** → **Create instance**
2. Name it `phcloud-cache`, click **Create**
3. Copy the **namespace ID**. You need it in step 4.

### 4 — Add bindings to wrangler.toml

Workers reads bindings from the config file, not the dashboard. Open `wrangler.toml` in your fork and paste in the two IDs you just copied:

```toml
name = "phcloudcms"
compatibility_date = "2026-07-14"
main = "src/index.ts"
workers_dev = true

[[d1_databases]]
binding = "DB"
database_name = "phcloud-db"
database_id = "<YOUR_D1_DATABASE_ID>"

[[kv_namespaces]]
binding = "CACHE"
id = "<YOUR_KV_NAMESPACE_ID>"
```

Commit the change to `main` on your fork.

> Cloudflare Workers Builds **wipes dashboard bindings that aren't in `wrangler.toml`** on every deploy — so the config file must hold your real IDs before you deploy.

### 5 — Deploy

Pick one path:

| | Workers Builds (auto-deploy) | Wrangler CLI |
|---|---|---|
| Auto-deploys on push? | Yes | No (manual) |
| Needs the CLI? | No | Yes |
| Best for | Most people | Developers |

**Path A — Workers Builds (dashboard, recommended):**

1. Cloudflare Dashboard → **Workers & Pages** → **Create application** → **Continue with Github**
2. Authorize Cloudflare to read your fork if asked, then select your `phcloudcms` repo
3. Production branch: `main`. Build command: **leave blank**. Deploy command: `npx wrangler deploy`. Root: blank.
4. Click **Save and Deploy**. Wait for **Success** (~30–60s).

**Path B — Wrangler CLI:**

```bash
git clone https://github.com/<your-username>/phcloudcms.git
cd phcloudcms
npm install
npx wrangler login      # opens a browser to authorize
npx wrangler deploy
```

Your site goes live at `https://<project-name>.<your-subdomain>.workers.dev`.

> Want a shorter URL? In Workers & Pages → **Change** your account subdomain (e.g. `steve`), and/or rename the Worker (Settings → Service name) to something short like `ph`. Shortest: `ph.steve.workers.dev`.

## Run the onboarding wizard

1. Visit your Worker URL
2. The **Setup Wizard** appears on first run (it disappears once the admin account exists). Fill in:
   - **Site name**
   - **Admin username** (defaults to `admin`)
   - **Admin password** (≥ 8 characters)
   - **SEO plugin** — recommended on
   - **Sitemap plugin** — recommended on
3. Click **Initialize Core Systems**

This creates the D1 schema (`migrate`), seeds defaults, and logs you in. You land on `/admin`.

## Writing content

1. **New Post** → enter a title, write in the WYSIWYG editor
2. Toggle **Publish immediately** or **Schedule for later** (pick a datetime)
3. Click **Save Post**

Published posts appear on the homepage immediately (publishing invalidates the cache). Drafts stay private; an unpublished post gets a shareable **Preview** link in the editor.

## Images

Images are stored **in D1** — no external bucket, no API key.

Paste an image into the editor (Ctrl+V), or drag one onto it:

1. The browser resizes it to ≤1200px wide and re-encodes it to WebP (quality 0.7) on a `<canvas>`
2. The compressed bytes are uploaded as base64 to your Worker, stored in the `images` D1 table
3. An `<img src="/img/42">` is inserted at the caret
4. `/img/:id` serves the bytes from KV (cached 30 days) with `Cache-Control: public, max-age=31536000, immutable`

## Local development

```bash
git clone https://github.com/<your-username>/phcloudcms.git
cd phcloudcms
npm install
npm run dev          # wrangler dev on http://localhost:8787
```

`wrangler dev` provisions a local D1 and KV from your `wrangler.toml` bindings. On first visit the onboarding wizard appears and `migrate` creates the schema locally — same flow as production.

Scripts:

```bash
npm run dev        # wrangler dev on http://localhost:8787
npm run build      # tsc --noEmit (type-check)
npm run lint       # prettier --check src/
npm run lint:fix   # prettier --write src/
```

## Project structure

```
src/
  index.ts          Worker entrypoint — middleware + route registration (catch-all last)
  cms/              framework bits: auth, d1 (migrate), sanitize, escape, render, registry, middleware
  admin/            admin UI: shell, dashboard, posts, pages, tags, nav, images, plugins, settings, editor, login
  routes/           HTTP routes by domain: posts, pages, tags, nav, images, plugins, install, wipe, public, settings, auth
  plugins/          built-in plugins: seo, sitemap, tag-cloud
  themes/           default.ts (single static theme, compiled into the Worker)
```

Routing lives in `src/routes/*`; the admin HTML bodies live in `src/admin/*`; the framework glue (auth, DB, sanitization, plugin registry) lives in `src/cms/*`. The editor's inline JavaScript is shared in `src/admin/editor.ts`.

## Themes

There is a single static theme file at [`src/themes/default.ts`](src/themes/default.ts). Themes are **not** plugins and there is no runtime theme registry — the theme is compiled into the Worker.

```typescript
export const css = `…`;
```

- **Light/dark** is automatic via `@media (prefers-color-scheme: dark)`, plus a header toggle (☾/☀) that overrides the OS preference and is remembered in `localStorage('phcloud-theme')`. A small inline script in `<head>` applies the saved choice before paint so there's no flash of the wrong theme. The admin panel follows the OS scheme too (`prefers-color-scheme: dark`); the login page is dark in both modes.
- **Reskin** by editing `:root` colors in `src/themes/default.ts`, then commit + push.
- **Swap** by pointing the import in `src/cms/render.ts` at a different theme file.

See [`THEMES.md`](THEMES.md).

## Plugins

A hooks-based plugin system: plugins register a manifest + hook bindings against a pipeline (`CMSRegistry` in `src/cms/registry.ts`). Built-in: **SEO**, **Sitemap**, **Tag Cloud**.

The intended distribution flow is GitHub-based — a plugin is a `.ts` file you drop into your fork and enable in the admin:

```
Developer writes a plugin → publishes on GitHub
Site owner drops the .ts file into their fork → commits → enables in admin
```

See [`PLUGIN_DEV.md`](PLUGIN_DEV.md) and [`PLUGIN_STARTER.md`](PLUGIN_STARTER.md).

## Security

Set globally on every response in `src/index.ts`:

- `Content-Security-Policy`: `default-src 'self'` (inline scripts/styles allowed for the dynamic templates)
- `Strict-Transport-Security`: `max-age=31536000; includeSubDomains`
- `X-Frame-Options: DENY` · `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy`: camera/microphone/geolocation disabled

Post and page content is run through an allowlist HTML sanitizer (a tiny tokenizer in `src/cms/sanitize.ts` — no DOM on the Workers runtime) on **both write and read**. `style` attributes and `data:` URLs are not allowed; the editor emits semantic tags via `execCommand`.

## Tech stack

| Component | Technology |
|---|---|
| Platform | Cloudflare Workers |
| Framework | [Hono v4.12](https://hono.dev) |
| Database | [D1](https://developers.cloudflare.com/d1/) (serverless SQLite) |
| Cache / sessions / images | [Workers KV](https://developers.cloudflare.com/kv/) |
| Language | TypeScript |
| Auth | PBKDF2 via Web Crypto |
| Entry point | `src/index.ts` |

**One runtime dependency**: `hono` (the router). No markdown parser, no DOMPurify, no client framework — content is authored in a `contentEditable` editor and sanitized by the built-in allowlist tokenizer.

---

## FAQ / Troubleshooting

### I see the setup screen again, or "Cannot read properties of undefined (reading 'batch')"

Your D1 binding is missing or wrong. This happens if you deployed before putting real IDs in `wrangler.toml` — Workers Builds wipes dashboard bindings that aren't in the config file.

**Fix:** put your D1 database ID and KV namespace ID into `wrangler.toml` (step 4), commit to `main`, and let it redeploy.

### I get a 500

Check that `wrangler.toml` has valid D1 and KV IDs and that both resources still exist in the dashboard. Deleting either will break the Worker.

### The homepage still shows old content after I publish

The published-posts cache lives in KV for ~10 minutes, but publishing/editing/deleting **invalidates it immediately** (`cms:posts:pub`, `cms:homepage`). If you're still seeing stale content, hard-refresh — the browser may be holding the old page.

### How do I change my site name?

In the D1 console, or via the admin **Settings** page.

### How do I reset my admin password?

```sql
DELETE FROM admins;
DELETE FROM settings WHERE key = 'status';
```

Then visit the site — the onboarding wizard reappears so you can recreate the admin account.

### How do I wipe and start over?

The admin has a wipe endpoint that drops all content. To fully decommission: delete the Worker, the D1 database, and the KV namespace from their dashboard pages.

---

## License

**MIT** — build something awesome with it.

---

**PHCloud CMS** — built for the edge, free forever on the Cloudflare free tier.
