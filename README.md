# ☁️ PHCloud CMS

**The world's lightest CMS** — runs entirely free on Cloudflare's free tier.

```
~60KB bundle · Two dependencies (hono, marked) · Free forever on Cloudflare
```

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Step 1 — Fork the Repository](#step-1--fork-the-repository)
- [Step 2 — Create a D1 Database](#step-2--create-a-d1-database)
- [Step 3 — Create a KV Namespace](#step-3--create-a-kv-namespace)
- [Step 4 — Add Bindings to wrangler.toml](#step-4--add-bindings-to-wranglertoml)
- [Step 5 — Deploy](#step-5--deploy)
  - [Path A — Workers Builds (Git Integration, Auto-Deploy)](#path-a--workers-builds-git-integration-auto-deploy)
  - [Path B — Wrangler CLI](#path-b--wrangler-cli)
- [Step 6 — Shorten Your workers.dev Subdomain](#step-6--shorten-your-workersdev-subdomain)
- [Step 7 — Run the Onboarding Wizard](#step-7--run-the-onboarding-wizard)
- [Step 8 — Write Your First Post](#step-8--write-your-first-post)
- [Local Development](#local-development)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Plugin System](#plugin-system)
- [FAQ / Troubleshooting](#faq--troubleshooting)
- [License](#license)

---

## Prerequisites

Before you begin, you need exactly two things:

1. **A GitHub account** — [sign up free](https://github.com/signup)
2. **A Cloudflare account** — [sign up free](https://dash.cloudflare.com/sign-up/workers-and-pages)

No credit card is required for either. The free tier handles everything this CMS needs.

---

## Step 1 — Fork the Repository

A fork is your own copy of the code. Your site = your fork.

1. Open a browser and go to [github.com/Stevechaapps/phcloudcms](https://github.com/Stevechaapps/phcloudcms)
2. Click the **Fork** button (top-right of the page)
3. On the fork page:
   - **Owner**: select your personal GitHub account
   - **Repository name**: you can keep `phcloudcms` or change it
   - **Description**: optional
   - **Copy the `main` branch only**: leave checked
4. Click **Create fork**

You now have `https://github.com/<your-username>/phcloudcms`.

---

## Step 2 — Create a D1 Database

D1 is Cloudflare's serverless SQLite database. PHCloud stores all content (posts, settings, plugins, admins) in D1.

1. In the Cloudflare Dashboard, click **D1 SQL database** in the left sidebar
2. Click the **Create Database** button (blue, top-right)
3. In the **Database name** field, enter `phcloud-db`
4. **Location hint** — optional. Leave blank.
5. Click **Create**
6. On the database page, **copy the database ID** (a UUID like `a1b2c3d4-...`). You need it in Step 4.

---

## Step 3 — Create a KV Namespace

KV is Cloudflare's key-value store. PHCloud uses it for caching and session storage.

1. In the Cloudflare Dashboard, click **Workers KV** in the left sidebar
2. Click the **Create instance** button (blue, top-right)
3. In the **Namespace name** field, enter `phcloud-cache`
4. Click **Create**
5. On the namespace detail page, **copy the namespace ID** (a UUID). You need it in Step 4.

---

## Step 4 — Add Bindings to wrangler.toml

Unlike the old Cloudflare Pages, Workers requires bindings to be defined in the project's config file. You must put your D1 database ID and KV namespace ID into `wrangler.toml` **before** deploying.

### Edit wrangler.toml in your fork

1. Go to your fork on GitHub (`https://github.com/<your-username>/phcloudcms`)
2. Click on `wrangler.toml`
3. Click the pencil icon (**Edit this file**)
4. Replace the placeholder values with your real IDs:

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

Replace:
- `<YOUR_D1_DATABASE_ID>` with the ID you copied in Step 2
- `<YOUR_KV_NAMESPACE_ID>` with the ID you copied in Step 3

5. At the bottom, write a commit message like `add D1 and KV bindings`
6. Click **Commit changes**

---

## Step 5 — Deploy

Choose one of these two paths:

| | Path A — Workers Builds | Path B — Wrangler CLI |
|---|---|---|
| **Auto-deploy on push?** | Yes | No (manual) |
| **Requires CLI?** | No (dashboard only) | Yes |
| **Best for** | Beginners, set-and-forget | Developers |

---

## Path A — Workers Builds (Git Integration, Auto-Deploy)

This connects your fork to Cloudflare so every push deploys automatically.

### Create the Worker

1. Log in to the [Cloudflare Dashboard](https://dash.cloudflare.com)
2. In the left sidebar, click **Workers & Pages**
3. Click the **Create application** button (blue, top-right area)
4. Click **Continue with Github**

   - **If your GitHub account is already linked** — a list of your repositories appears immediately
   - **If not linked** — a GitHub authorization popup appears. Click **Install & Authorize**, select your fork, then click **Install & Authorize**

5. Find your fork (`<your-username>/phcloudcms`)
6. Click the row or **Select** button next to it

### Configure Build Settings

1. **Project name** — auto-filled from the repo name. Pick something short (e.g. `ph`, `cms`, `blog`).
2. **Production branch** — leave as `main`
3. **Build command** — leave **blank**
4. **Deploy command** — leave as `npx wrangler deploy`
5. **Root directory** — leave blank

### Deploy

1. Click **Save and Deploy**
2. Wait for **Success** (about 30–60 seconds)
3. You are taken to your Worker's dashboard

Your Worker is now live at `https://<project-name>.<your-subdomain>.workers.dev`.

---

## Path B — Wrangler CLI

Use this if you want to deploy from your terminal.

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
- Git

### Deploy

```bash
# Clone your fork (with your updated wrangler.toml)
git clone https://github.com/<your-username>/phcloudcms.git
cd phcloudcms

# Install dependencies
npm install

# Log in to Cloudflare (opens browser)
npx wrangler login

# Deploy
npx wrangler deploy
```

---

## Step 6 — Shorten Your workers.dev Subdomain

Your URL is `<worker-name>.<account-subdomain>.workers.dev`. Two ways to make it shorter:

### Change the account subdomain

1. Go to **Workers & Pages** in the dashboard
2. Next to **Your subdomain**, click **Change**
3. Enter something short (e.g. `steve` instead of `stevechaapps`)
4. Click **Save**

### Rename the worker

1. In your Worker's dashboard, go to **Settings**
2. Next to **Service name**, click **Change**
3. Enter a short name (e.g. `ph`, `cms`, `blog`)

Shortest possible: something like `ph.steve.workers.dev`.

---

## Step 7 — Run the Onboarding Wizard

1. Visit `https://<your-worker>.<your-subdomain>.workers.dev`
2. The **Setup Wizard** appears:
   - **Site Name** — your site's title
   - **Admin Username** — defaults to "admin"
   - **Admin Password** — at least 8 characters
   - **SEO Plugin** — recommended ON
   - **Sitemap Plugin** — recommended ON
3. Click **Initialize Core Systems**
4. You are automatically logged in and redirected to `/admin`

**You're done.** Every future push to `main` auto-deploys.

---

## Step 8 — Write Your First Post

1. In the admin dashboard, click **New Post**
2. Enter a title, write content in Markdown, check **Publish immediately**
3. Click **Save Post**

Your post appears on the homepage immediately.

---

## Adding Images to Posts

PHCloud stores images **locally in your D1 database** — no external service, no API key, no credit card.

When you paste an image (Ctrl+V) into the post editor:

1. The image is **compressed to WebP** on your browser (~1200px max width, quality 0.7)
2. The compressed image is uploaded as base64 to your Worker
3. Your Worker stores it in the `images` D1 table and returns a URL like `/img/42`
4. The Markdown `![](/img/42)` is inserted at your cursor position

Images are served from D1 and cached in KV for 30 days. Browser cache is set to `immutable, max-age=31536000`.

---

## Local Development

```bash
# Clone your fork
git clone https://github.com/<your-username>/phcloudcms.git
cd phcloudcms

# Install dependencies
npm install

# Run dev server (creates local D1 + KV automatically)
npm run dev
```

Dev server runs at `http://localhost:8787`.

### Type Checking

```bash
npx tsc --noEmit
```

---

## Features

| Feature | Description |
|---|---|---|
| **Admin Panel** | Dashboard, full CRUD for posts/pages/categories, navigation editor, settings |
| **Markdown Editor** | Toolbar (bold, italic, headings, links, lists, code, preview) + paste-to-upload images |
| **Image Upload** | Paste any image → compressed to WebP client-side → stored in D1 → served via `/img/:id` |
| **Pages** | Static pages (About, Contact, Privacy, etc.) alongside posts |
| **Tags** | Organize content with tags, browse by `/tag/:slug` |
| **Navigation** | Custom header links, editable from admin |
| **Search** | Full-text search at `/search?q=...` |
| **RSS Feed** | Auto-generated `/feed.xml` |
| **Theme System** | Static theme file in `src/themes/default.ts`, reskin by editing (see `THEMES.md`) |
| **Dark Mode** | Automatic via `prefers-color-scheme`, no toggle needed |
| **Plugin System** | Hooks-based plugins in TypeScript, distributed via GitHub |
| **Onboarding Wizard** | First-run setup via browser |
| **SEO Built-in** | Meta tags, Open Graph, Twitter Cards |
| **XML Sitemap** | Auto-generated `/sitemap.xml` |
| **Session Auth** | PBKDF2 hashing, HTTP-only cookies, KV sessions |
| **KV Caching** | Config + posts cached for speed |
| **Free Hosting** | Cloudflare free tier |
| **Auto Deploy** | Push to `main` → deploys via Workers Builds |

---

## Tech Stack

| Component | Technology |
|---|---|
| Platform | Cloudflare Workers |
| Framework | [Hono v4.12](https://hono.dev) |
| Database | [D1](https://developers.cloudflare.com/d1/) (Serverless SQLite) |
| Cache | [Workers KV](https://developers.cloudflare.com/kv/) |
| Language | TypeScript 7.0 |
| Auth | PBKDF2 (Web Crypto API) |
| Entry Point | `src/index.ts` |

**Two runtime dependencies** — `hono` (router) and `marked` (markdown renderer).

---

## Plugin System

PHCloud uses a **GitHub-based plugin marketplace**:

```
Developer → Creates plugin → Publishes on GitHub
                ↓
Site Owner → Downloads .ts file → Adds to fork → Commits → Enables in admin
```

See [`PLUGIN_DEV.md`](./PLUGIN_DEV.md) and [`PLUGIN_STARTER.md`](./PLUGIN_STARTER.md).

---

## Themes

PHCloud uses a **single static theme file** at `src/themes/default.ts`. Themes are not plugins — there's no runtime registry. The theme is compiled into the Worker.

The theme exports CSS and a layout preset:

```typescript
export const layout = 'centered'; // 'centered' | 'sidebar-left' | 'wide'
export const css = `...`;
```

- **Light/dark mode** is automatic via `@media (prefers-color-scheme: dark)` — no toggle
- **Reskin** by editing `src/themes/default.ts` — change palette colors in `:root`, commit, push
- **Swap themes** by changing the import in `src/index.ts` to point at a different theme file

See [`THEMES.md`](./THEMES.md) for full theming documentation.

---

## FAQ / Troubleshooting

### "I see a setup screen again and 'Cannot read properties of undefined (reading batch)'"

Your D1 binding is missing. This happens if you deployed without bindings in `wrangler.toml` — Workers Builds wipes dashboard bindings that aren't in the config file.

**Fix:** Edit `wrangler.toml` in your fork with your D1 database ID and KV namespace ID (Step 4), commit, and push. Workers Builds redeploys automatically.

### "I see a 500 error"

Check your `wrangler.toml` has valid D1 and KV IDs. Verify the databases actually exist in the dashboard.

### "The homepage still shows old content after publishing"

The homepage is cached in KV for 60 seconds. Wait a moment or publish another post to bust the cache (fixed in latest commit).

### "How do I change my site name?"

In the D1 console: `UPDATE settings SET value = 'New Name' WHERE key = 'site_name';`

### "How do I reset my admin password?"

In the D1 console:
```sql
DELETE FROM admins;
DELETE FROM settings WHERE key = 'status';
```
Then visit your site — the wizard reappears.

### "How do I delete my site?"

Delete the Worker, D1 database, and KV namespace from their respective dashboard pages.

---

## License

**MIT** — Build something awesome.

---

**PHCloud CMS** — Built for the edge. Free forever.

_Made with ☁️ on Cloudflare Workers_
