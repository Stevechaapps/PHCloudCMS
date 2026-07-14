# ☁️ PHCloud CMS

**The world's lightest CMS** — runs entirely free on Cloudflare's free tier.

```
~50KB bundle · Zero runtime dependencies · Free forever on Cloudflare
```

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Step 1 — Fork the Repository](#step-1--fork-the-repository)
- [Step 2 — Choose Your Deployment Path](#step-2--choose-your-deployment-path)
- [Path A — Workers Builds (Git Integration, Auto-Deploy)](#path-a--workers-builds-git-integration-auto-deploy)
- [Path B — Wrangler CLI](#path-b--wrangler-cli)
- [Step 3 — Create a D1 Database](#step-3--create-a-d1-database)
- [Step 4 — Create a KV Namespace](#step-4--create-a-kv-namespace)
- [Step 5 — Add Bindings to Your Worker](#step-5--add-bindings-to-your-worker)
- [Step 6 — Shorten Your workers.dev Subdomain](#step-6--shorten-your-workersdev-subdomain)
- [Step 7 — Redeploy (Apply Bindings)](#step-7--redeploy-apply-bindings)
- [Step 8 — Run the Onboarding Wizard](#step-8--run-the-onboarding-wizard)
- [Step 9 — Write Your First Post](#step-9--write-your-first-post)
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
   - **Repository name**: you can keep `phcloudcms` or change it (e.g. `my-site`)
   - **Description**: optional
   - **Copy the `main` branch only**: leave checked
4. Click **Create fork**
5. Wait a few seconds — GitHub copies the repo to your account

You now have `https://github.com/<your-username>/phcloudcms` (or whatever you named it).

---

## Step 2 — Choose Your Deployment Path

There are two ways to deploy. Choose one:

| | Path A — Workers Builds | Path B — Wrangler CLI |
|---|---|---|
| **Auto-deploy on push?** | Yes | No (manual) |
| **Requires CLI?** | No (dashboard only) | Yes |
| **Best for** | Beginners, set-and-forget | Developers who want full control |

---

## Path A — Workers Builds (Git Integration, Auto-Deploy)

This connects your fork to Cloudflare so every push deploys automatically.

### Create the Worker via "Import a repository"

1. Log in to the [Cloudflare Dashboard](https://dash.cloudflare.com)
2. In the left sidebar, click **Workers & Pages**
3. Click the **Create application** button (blue, top-right area)
4. Click **Continue with Github**

   If your Cloudflare account has not been linked to GitHub before, a Github authorization popup/redirect appears:
   - It asks you to **Install & Authorize** Cloudflare Workers
   - Select whether to allow access to **All repositories** or **Only select repositories** (check your fork)
   - Click **Install & Authorize**
   - You return to the Cloudflare dashboard

5. A list of your repositories appears
6. Find your fork (`<your-username>/phcloudcms`)
7. Click the row or **Select** button next to it

### Configure Build Settings

On the configuration page:

1. **Project name** — auto-filled from the repo name. This becomes part of your `workers.dev` URL. Pick something short (e.g. `ph`, `cms`, `blog`). You can change the account subdomain later in Step 6.
2. **Production branch** — defaults to `main`. Leave as `main`.
3. **Build command** — leave **blank** (PHCloud has no build step)
4. **Deploy command** — defaults to `npx wrangler deploy`. Leave as-is.
5. **Root directory** — leave blank (defaults to repo root)

### Deploy

1. Scroll down and click **Save and Deploy**
2. Cloudflare runs the deploy — you see a log screen:
   ```
   Cloning repository...
   Installing dependencies...
   Building...
   Deploying...
   ```
3. Wait for **Success** (about 30–60 seconds)
4. You are taken to your Worker's dashboard

Your Worker is now live at `https://<project-name>.<your-subdomain>.workers.dev`.

At this point the site is deployed, but **it will not work yet** — you need a database and a cache namespace. If you visit the URL now, you'll get a 500 error (no D1 + KV bindings). Skip to [Step 3](#step-3--create-a-d1-database).

---

## Path B — Wrangler CLI

Use this if you want to deploy from your terminal instead of the dashboard.

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
- Git

### Install dependencies and deploy

```bash
# Clone your fork
git clone https://github.com/<your-username>/phcloudcms.git
cd phcloudcms

# Install dependencies
npm install

# Log in to Cloudflare (opens browser)
npx wrangler login

# Deploy
npx wrangler deploy
```

`wrangler deploy` reads `wrangler.toml` and deploys the Worker.

**Note:** The first deploy will succeed but the site won't work until you create D1 + KV and add bindings. Continue to Step 3.

---

## Step 3 — Create a D1 Database

D1 is Cloudflare's serverless SQLite database. PHCloud stores all content (posts, settings, plugins, admins) in D1.

1. In the Cloudflare Dashboard, click **D1 SQL database** in the left sidebar (under Workers & Pages section)
2. Click the **Create Database** button (blue, top-right)
3. In the **Database name** field, enter a name like `phcloud-db` (or whatever you prefer)
4. **Location hint** — optional. Leave it blank unless you know you want data stored in a specific region.
5. Click **Create**

After creation, you see the database's detail page. Remember the name — you need it in Step 5.

---

## Step 4 — Create a KV Namespace

KV is Cloudflare's key-value store. PHCloud uses it for caching and session storage.

1. In the Cloudflare Dashboard, click **Workers KV** in the left sidebar (under Workers & Pages section)
2. Click the **Create instance** button (blue, top-right)
3. In the **Namespace name** field, enter a name like `phcloud-cache` (or whatever you prefer)
4. Click **Create**

After creation, you see the namespace detail page. Remember the name — you need it in Step 5.

---

## Step 5 — Add Bindings to Your Worker

Bindings tell Cloudflare, "this Worker is allowed to access this D1 database and this KV namespace." You need two bindings: one for the database (variable name `DB`) and one for the cache (variable name `CACHE`).

### Add the D1 binding (DB)

1. In the Cloudflare Dashboard, click **Workers & Pages** in the left sidebar
2. Click your Worker (the one you created in Step 2 or via Path A/Path B)
3. Click the **Settings** tab
4. In the left sub-nav, click **Bindings**
5. Click the **Add binding** button (blue)
6. From the dropdown, select **D1 database**
7. In the form:
   - **Variable name**: enter exactly `DB` (case-sensitive, must be uppercase)
   - **D1 database**: select the D1 database you created in Step 3 from the dropdown
8. Click **Add binding**

### Add the KV binding (CACHE)

1. While still in **Settings → Bindings** for your Worker
2. Click the **Add binding** button again
3. From the dropdown, select **KV namespace**
4. In the form:
   - **Variable name**: enter exactly `CACHE` (case-sensitive, must be uppercase)
   - **KV namespace**: select the KV namespace you created in Step 4 from the dropdown
5. Click **Add binding**

You should now see two bindings listed:

| Variable name | Kind | Resource |
|---|---|---|
| `DB` | D1 database | phcloud-db |
| `CACHE` | KV namespace | phcloud-cache |

---

## Step 6 — Shorten Your workers.dev Subdomain

Your Worker's URL format is `<worker-name>.<account-subdomain>.workers.dev`. Two things control the length:

### Change the account subdomain

1. In the Cloudflare Dashboard, click **Workers & Pages** in the left sidebar
2. Look at the top of the page — next to **Your subdomain**, click **Change**
3. Enter a short subdomain (e.g. `steve` instead of `stevechaapps`)
4. Click **Save**

Now your URL becomes `<worker-name>.steve.workers.dev`.

### Use a short worker name

When you created the Worker in Step 2 / Path A, you set the project name. If you used a long name, you can rename it:

1. In your Worker's dashboard, go to **Settings**
2. Next to **Service name**, click **Change**
3. Enter a short name (e.g. `ph`, `cms`, `blog`)
4. Click **Save**

The shortest possible URL would be something like: `ph.steve.workers.dev`.

---

## Step 7 — Redeploy (Apply Bindings)

Bindings only take effect on the **next deployment**. You must re-deploy.

### If you used Path A (Workers Builds):

1. Stay on your Worker's dashboard
2. Click the **Deployments** tab
3. Find the latest deployment
4. Click the three-dot menu (⋮) → **Retry deployment**
5. Wait for the green checkmark

Alternatively, push a commit to trigger auto-deploy:

```bash
git commit --allow-empty -m "redeploy for bindings"
git push origin main
```

### If you used Path B (Wrangler CLI):

```bash
npx wrangler deploy
```

### Verify

Visit `https://<your-worker>.<your-subdomain>.workers.dev`. You should see the **PHCloud Setup Wizard** page. If you still see an error:
- Verify both bindings exist in Settings → Bindings (variable names exactly `DB` and `CACHE`)
- Verify the D1 database and KV namespace exist
- Verify you redeployed after adding bindings

---

## Step 8 — Run the Onboarding Wizard

The first time you visit your deployed site, the setup wizard appears automatically. This creates all database tables and your admin account.

1. Visit `https://<your-worker>.<your-subdomain>.workers.dev`
2. The wizard screen has input fields:
   - **Site Name** — your site's title (e.g. "My Blog", "Jane's Corner")
   - **Admin Username** — you will log in with this (defaults to "admin", change it if you want)
   - **Admin Password** — must be at least 8 characters
   - **Confirm Password** — must match
   - **SEO Plugin** — toggle ON/OFF (recommended: ON — generates meta tags and Open Graph)
   - **Sitemap Plugin** — toggle ON/OFF (recommended: ON — generates `/sitemap.xml`)
3. Click the **Initialize Core Systems** button
4. Wait 2–5 seconds for the server to:
   - Create 4 database tables (`settings`, `posts`, `plugins`, `admins`)
   - Insert your admin credentials (password is hashed with PBKDF2)
   - Insert plugin records with your toggled choices
   - Create a session cookie (you are automatically logged in)
5. The browser redirects to `https://<your-worker>.<your-subdomain>.workers.dev/admin`

**You are now logged into the PHCloud Admin Dashboard.**

If you see a blank page or error after clicking Initialize, check the browser's developer console (F12 → Console) for error messages. Common issues:
- `DB binding not found` — the D1 binding is missing or the variable name is not exactly `DB`
- `CACHE binding not found` — the KV binding is missing or the variable name is not exactly `CACHE`

---

## Step 9 — Write Your First Post

1. In the admin dashboard, click **New Post** (top navigation bar)
2. You see the post editor:
   - **Title** — your post title (e.g. "Hello World")
   - **Slug** — the URL path (auto-filled from title, e.g. `hello-world`). You can edit it manually.
   - **Excerpt** — optional short description
   - **Content** — write in Markdown. Use the **Preview** tab to see rendered HTML.
   - **Published** — checkbox to publish immediately or save as draft
3. Click **Save Post**

Your post is now live. Visit your site's homepage to see it.

### Managing Posts

In the admin dashboard:
- **Dashboard** — shows post count, published count, and recent posts
- **Posts** — lists all posts with Edit and Delete actions
- **Plugins** — toggle plugins on/off

---

## Local Development

You can run PHCloud on your computer for testing before deploying changes.

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
- Git

### Setup

```bash
# Clone your fork
git clone https://github.com/<your-username>/phcloudcms.git
cd phcloudcms

# Install dependencies
npm install

# Run the local dev server (creates local D1 + KV automatically)
npm run dev
```

The dev server starts at `http://localhost:8787`. The `--d1 DB --kv CACHE` flags create local D1 + KV instances automatically (stored in `.wrangler/` directory).

### Type Checking

```bash
npx tsc --noEmit
```

### Local D1 Management

To inspect the local database:

```bash
npx wrangler d1 execute DB --local --command="SELECT * FROM posts"
```

To reset the local database:

```bash
rm -rf .wrangler/state
```

---

## Features

| Feature | Description |
|---|---|
| **Admin Panel** | Create, edit, publish, and delete posts from a browser dashboard |
| **Plugin System** | WordPress-style hooks written in TypeScript, distributed via GitHub |
| **Onboarding Wizard** | Browser-based first-run setup — no terminal or config files |
| **SEO Built-in** | Meta tags, Open Graph, Twitter Cards (via SEO plugin) |
| **XML Sitemap** | Auto-generated `/sitemap.xml` (via Sitemap plugin) |
| **Markdown Editor** | Write posts in Markdown with live preview |
| **Session Auth** | PBKDF2 password hashing, HTTP-only cookies, KV-backed sessions |
| **KV Caching** | Settings and posts cached in KV for faster loads |
| **Free Hosting** | Cloudflare free tier — 100,000 requests/day, unlimited bandwidth |
| **Auto Deploy** | Every push to `main` deploys automatically (via Workers Builds) |

---

## Tech Stack

| Component | Technology |
|---|---|
| Platform | Cloudflare Workers |
| Web Framework | [Hono v4.12](https://hono.dev) |
| Database | [D1](https://developers.cloudflare.com/d1/) (Serverless SQLite) |
| Cache | [Workers KV](https://developers.cloudflare.com/kv/) |
| Language | TypeScript 7.0 |
| Auth | PBKDF2 (Web Crypto API, native) |
| Entry Point | `src/index.ts` (Worker script) |

**Zero external runtime dependencies** — the only npm dependency is `hono` itself.

---

## Plugin System

PHCloud uses a **GitHub-based plugin marketplace** — no central store, no upload forms, no approval process.

```
Developer → Creates plugin → Publishes on GitHub
                ↓
Site Owner → Downloads .ts file → Adds to fork → Commits → Pushes → Enables in admin
```

See:
- [`PLUGIN_DEV.md`](./PLUGIN_DEV.md) — developer guide for building plugins
- [`PLUGIN_STARTER.md`](./PLUGIN_STARTER.md) — template with examples

### Available Plugin Hooks

| Hook | Fires When | Payload |
|---|---|---|
| `render:head` | Rendering `<head>` | `{ title, description, url, image }` |
| `render:body` | Rendering `<body>` | `{ content: string }` |
| `render:sitemap` | Generating sitemap | `{ urls: Array<{loc, lastmod}> }` |

---

## FAQ / Troubleshooting

### "I see a 500 error at my workers.dev URL"

The most common cause is missing or incorrect bindings.
1. Go to **Workers & Pages** → click your Worker → **Settings** → **Bindings**
2. Verify you have exactly two bindings:
   - Variable name `DB` → D1 database
   - Variable name `CACHE` → KV namespace
3. If one or both are missing, add them (Step 5)
4. If they exist, redeploy (Step 7)

### "The setup wizard shows an error when I click Initialize"

Check the browser console (F12 → Console) and network tab (F12 → Network). If you see:
- `DB is not defined` or similar → D1 binding is missing or variable name is wrong
- `CACHE is not defined` → KV binding is missing or variable name is wrong
- A network error (POST `/api/install` returns 500) → check that the D1 database actually exists

### "How do I change my site name after setup?"

Currently there is no Settings page. You can change the site name by running SQL in the D1 console:

1. Go to **D1 SQL database** → click your database → **Console**
2. Run: `UPDATE settings SET value = 'New Site Name' WHERE key = 'site_name';`

### "How do I reset my admin password?"

In the D1 console:
```sql
DELETE FROM admins;
DELETE FROM settings WHERE key = 'status';
```
Then visit your site's homepage — the wizard will appear again.

### "How do I delete my site?"

1. Go to **Workers & Pages** → click your Worker → **Settings** → scroll down → **Delete**
2. Go to **D1 SQL database** → click your database → **Settings** → **Delete**
3. Go to **Workers KV** → click your namespace → **Delete**

### "I pushed changes to my fork but the site hasn't updated"

Check the **Deployments** tab in your Worker dashboard. If the deployment failed, click into it to see the build log. Common issues:
- A TypeScript error in your modified code — run `npx tsc --noEmit` locally to catch these
- The Worker name in `wrangler.toml` doesn't match the Worker name in the dashboard

### "The workers.dev subdomain is too long"

See Step 6 — you can change both the account subdomain and the worker name.

---

## License

**MIT** — Build something awesome.

---

**PHCloud CMS** — Built for the edge. Free forever.

_Made with ☁️ on Cloudflare Workers_
