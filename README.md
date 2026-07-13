# ☁️ PHCloud CMS

**The world's lightest CMS** — runs free on Cloudflare Workers.

```
⚡ 12 files · 50KB bundle · Zero runtime dependencies · Free forever
```

---

## 🚀 Complete Setup (fork → live site)

This is a **template repo**. You fork it, plug in your own Cloudflare resources,
and your CMS runs on your own Cloudflare account — free tier, no credit card.

There are two ways to deploy. **GitHub auto-deploy** is recommended (push to
GitHub → Cloudflare rebuilds automatically). If you prefer the terminal, use the
**CLI deploy** path instead.

### Prerequisites

- A **GitHub** account
- A **Cloudflare** account (free tier — https://dash.cloudflare.com)
- For the CLI path only: Node.js 18+, npm, and the
  [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/)

---

### Path A — GitHub auto-deploy (recommended)

Every push to your fork's `main` branch rebuilds the Worker automatically.

#### Step 1 · Fork the repo

1. Go to https://github.com/Stevechaapps/phcloudcms
2. Click **Fork** → fork it into your own GitHub account
3. (Optional) clone it locally so you can edit `wrangler.jsonc`:

   ```bash
   git clone https://github.com/your-username/phcloudcms.git
   cd phcloudcms
   ```
   You can also edit `wrangler.jsonc` directly on GitHub's web editor.

#### Step 2 · Create your Cloudflare resources

Both resources are **free tier** — no credit card required. You'll get two IDs.

**D1 database** (stores posts, settings, plugins, admin accounts):

```bash
npx wrangler d1 create phcloudcms_db
```

Copy the **database_id** from the output (a UUID like `a1c2792f-4803-4cd8-b790-...`).

**KV namespace** (sessions + page cache):

```bash
npx wrangler kv namespace create phcloudcms_cache
```

Copy the **id** from the output (a hex string like `e29b8a3c...` — **not** the name).

> Don't want the CLI? You can create both from the Cloudflare dashboard too:
> **Workers & Pages → D1 → Create database**, and **Workers & Pages → KV → Create namespace**. Grab the IDs from each resource's page.

#### Step 3 · Put your IDs in `wrangler.jsonc`

Open `wrangler.jsonc` and replace the two placeholders with the IDs from Step 2:

```jsonc
{
  "name": "phcloudcms",
  "main": "src/index.ts",
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "phcloudcms_db",
      "database_id": "YOUR_D1_DATABASE_ID"   // ← from `wrangler d1 create`
    }
  ],
  "kv_namespaces": [
    {
      "binding": "CACHE",
      "id": "YOUR_KV_NAMESPACE_ID"            // ← hex string from `wrangler kv namespace create`
    }
  ]
}
```

These IDs are **identifiers, not secrets** — only your Cloudflare account can
reach them through the deployed Worker. It's safe to commit them to your fork.

Commit the change and push to your fork's `main` branch.
Do this **before** connecting to Cloudflare (Step 4) — the very first build reads
`wrangler.jsonc` to bind your D1 + KV, so the real IDs must be committed first.
If you connect before pushing the IDs, the first build will fail on the
placeholders; just push the IDs and the next build succeeds.

#### Step 4 · Connect your fork to Cloudflare Workers Build

1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Workers Build**
2. **Connect to Git** → authorize GitHub → select your `phcloudcms` fork
3. Set the build/deploy commands (defaults are usually fine):
   - **Build command:** `npm run build`
   - **Deploy command:** `npx wrangler deploy`
4. **Save and Deploy**. The build runs `tsc --noEmit` then deploys the Worker.

Your Worker is live at a `*.workers.dev` URL (or a custom domain you add later).
Every future push to `main` rebuilds automatically.

#### Step 5 · Run the onboarding wizard

1. Visit your Worker URL in the browser
2. The **Setup wizard** appears on first load — enter:
   - Site name
   - Admin username + password (≥ 8 characters)
   - Toggle the bundled SEO + Sitemap plugins on/off
3. Click **Initialize Core Systems**

The wizard **automatically creates all database tables** — no manual migration
commands needed. You're done.

#### Step 6 · Log in and start posting

Go to `https://<your-worker>.workers.dev/admin/login`, sign in with the
credentials you just set, and create your first post. ✅

---

### Path B — CLI manual deploy

Prefer the terminal? Skip Workers Build and deploy with Wrangler directly.

```bash
# 1. Fork on GitHub, then clone your fork
git clone https://github.com/your-username/phcloudcms.git
cd phcloudcms
npm install

# 2. Authenticate Wrangler with your Cloudflare account
npx wrangler login

# 3. Create your resources (free tier) and copy the IDs from the output
npx wrangler d1 create phcloudcms_db
npx wrangler kv namespace create phcloudcms_cache

# 4. Paste those IDs into wrangler.jsonc (database_id + CACHE id), then:

# 5. (Optional) run locally — http://localhost:8787
npm run dev

# 6. Deploy to Cloudflare
npm run deploy
```

Then visit your Worker URL → run the onboarding wizard → log in at `/admin/login`.

---

### Local development notes

```bash
npm run dev      # local dev server on :8787 (auto-creates tables on first /api/install)
npm run build    # TypeScript type check (tsc --noEmit)
npm run deploy   # deploy to Cloudflare (requires wrangler login + IDs in wrangler.jsonc)
npm run lint     # prettier --check
```

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| **Admin Panel** | Create/edit posts, manage plugins, dark theme |
| **Plugin System** | WordPress-style hooks, TypeScript, GitHub distribution |
| **Onboarding Wizard** | Browser-based setup — no `wrangler secret put` |
| **SEO Built-in** | Meta tags, Open Graph, XML sitemap |
| **Markdown Editor** | Write posts in markdown, rendered to HTML |
| **Session Auth** | PBKDF2 hashing, HTTP-only cookies, KV sessions |
| **KV Caching** | Config + posts cached for speed |
| **Free Hosting** | Cloudflare free tier — 100K requests/day |

---

## 🛠 Tech Stack

| Component | Technology |
|-----------|------------|
| Runtime | Cloudflare Workers (V8 isolates) |
| Framework | Hono v4.12 |
| Database | D1 (SQLite) |
| Cache | KV namespaces |
| Language | TypeScript 7.0 |
| Auth | PBKDF2 (native Web Crypto) |

**Zero external runtime dependencies.**

---

## 📦 Plugin System

PHCloud uses a **GitHub-based plugin marketplace**:

```
Developer → Creates plugin → Publishes on GitHub
                ↓
Site Owner → Downloads → Copies to fork → Commits → Enables in admin
```

### Example Plugin

```typescript
// src/plugins/analytics.ts
import type { PluginHook, CMSRegistry } from '../cms/registry.js';

export function initAnalytics(registry: CMSRegistry): void {
  registry.register('render:head', injectGA);
}

const injectGA: PluginHook = (payload) => {
  const script = `<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXX"></script>`;
  return { ...payload, markup: (payload.markup || '') + '\n' + script };
};
```

📖 **See:** [`PLUGIN_DEV.md`](./PLUGIN_DEV.md) — complete developer guide.

---

## 🎨 Theme System

Themes work exactly like plugins — copy a `.ts` file, enable in admin, done. Every theme is **mobile-first**, **touch-friendly**, and **dark-mode ready**:

- Mobile breakpoints: default → 768px → 1024px
- Touch targets: ≥44px (thumb-friendly)
- Font size: ≥16px (readable without zoom)
- Dark mode: `prefers-color-scheme` support

**Browse themes:** [`THEMES.md`](./THEMES.md) — official gallery with install instructions.

📖 **Build your own:** [`THEME_STARTER.md`](./THEME_STARTER.md) — template + publishing guide.

---

## 🆚 PHCloud vs WordPress

| Feature | WordPress | PHCloud CMS |
|---------|-----------|-------------|
| **Runtime** | PHP + MySQL | Cloudflare Workers |
| **Hosting Cost** | $5-30/mo | Free |
| **Bundle Size** | 40MB+ | ~50KB |
| **Files** | Thousands | 12 |
| **Plugin Install** | Upload ZIP | GitHub fork |
| **Type Safety** | No | Full TypeScript |
| **Edge Native** | No | Yes |
| **Setup Time** | 30+ min | 5 min |

> WordPress was built for shared hosting in 2003. PHCloud was built for the edge in 2026.

---

## 📖 Documentation

| Doc | Purpose |
|-----|---------|
| [`README.md`](./README.md) | Getting started |
| [`PLUGIN_DEV.md`](./PLUGIN_DEV.md) | Build plugins |
| [`PLUGIN_STARTER.md`](./PLUGIN_STARTER.md) | Plugin template |
| [`THEME_STARTER.md`](./THEME_STARTER.md) | Build themes |
| [`THEMES.md`](./THEMES.md) | Theme gallery |
| [`BRAND.md`](./BRAND.md) | Brand guidelines |

---

## 📄 License

**MIT** — Build something awesome.

---

**PHCloud CMS** — Built for the edge. Free forever.

_Made with ☁️ on Cloudflare Workers_
