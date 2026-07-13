# ☁️ PHCloud CMS

**The world's lightest CMS** — runs free on Cloudflare Pages.

```
⚡ \~50KB bundle · Zero runtime dependencies · Free forever on Cloudflare free tier
```

---

## 🚀 One-Click Deploy (fork → live site in 5 minutes)

No CLI, no config files, no `wrangler.jsonc` to edit. Everything happens in your browser.

### Step 1 · Fork the repo

1. Go to [github.com/Stevechaapps/phcloudcms](https://github.com/Stevechaapps/phcloudcms)
2. Click **Fork** → fork it into your own GitHub account

### Step 2 · Create D1 + KV resources

From the Cloudflare Dashboard:

**D1 database** (stores posts, settings, admin accounts):
1. **Workers & Pages → D1 → Create database**
2. Name: `phcloudcms-db` → **Create**

**KV namespace** (sessions + cache):
1. **Workers & Pages → KV → Create namespace**
2. Name: `phcloudcms-cache` → **Create**

No IDs to copy — you'll bind them by name in the next step.

### Step 3 · Connect to Cloudflare Pages

1. Cloudflare Dashboard → **Workers & Pages** → **Pages** → **Create a project** → **Connect to Git**
2. Authorize GitHub → select your `phcloudcms` fork
3. **Build settings** — leave everything default:
   - Build command: *(leave blank)*
   - Build output directory: *(leave blank)*
4. Click **Save and Deploy** — the first deploy will start immediately

### Step 4 · Add D1 + KV bindings

After the first deploy completes:

1. Go to your Pages project → **Settings** → **Functions**
2. Under **D1 database bindings**, click **Add binding**:
   - Variable name: `DB`
   - Database: select `phcloudcms-db` (or whatever you named it)
3. Under **KV namespace bindings**, click **Add binding**:
   - Variable name: `CACHE`
   - KV namespace: select `phcloudcms-cache` (or whatever you named it)
4. Click **Save**
5. Go to **Deployments** → find your deployment → click **...** → **Retry deployment**

### Step 5 · Run the onboarding wizard

1. Visit your Pages URL (e.g., `https://your-project.pages.dev`)
2. The **Setup wizard** appears on first load — enter:
   - Site name
   - Admin username + password (≥ 8 characters)
   - Toggle SEO + Sitemap plugins on/off
3. Click **Initialize Core Systems**

The wizard creates all database tables automatically and logs you straight into the admin dashboard.

**You're done.** That's it.

Every future push to `main` auto-deploys. To add custom domains, go to **Pages project → Custom domains**.

---

## 🧪 Local Development

```bash
# Clone your fork
git clone https://github.com/your-username/phcloudcms.git
cd phcloudcms
npm install

# Run locally (auto-creates local D1 + KV)
npm run dev

# Type check
npx tsc --noEmit
```

The dev server runs at `http://localhost:8788`. Local D1 + KV are created automatically by wrangler.

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| **Admin Panel** | Create/edit posts, manage plugins |
| **Plugin System** | WordPress-style hooks, TypeScript, GitHub distribution |
| **Onboarding Wizard** | Browser-based setup — no CLI needed |
| **SEO Built-in** | Meta tags, Open Graph, XML sitemap |
| **Markdown Editor** | Write posts in markdown, rendered to HTML |
| **Session Auth** | PBKDF2 hashing, HTTP-only cookies, KV sessions |
| **KV Caching** | Config + posts cached for speed |
| **Free Hosting** | Cloudflare free tier — 100K requests/day |

---

## 🛠 Tech Stack

| Component | Technology |
|-----------|------------|
| Platform | Cloudflare Pages |
| Framework | Hono v4.12 |
| Database | D1 (SQLite) |
| Cache | KV Namespaces |
| Language | TypeScript 7.0 |
| Auth | PBKDF2 (native Web Crypto) |

**Zero external runtime dependencies.**

---

## 📦 Plugin System

PHCloud uses a **GitHub-based plugin marketplace** — no central store, no uploads, no approval process.

```
Developer → Creates plugin → Publishes on GitHub
                ↓
Site Owner → Downloads .ts file → Copies to fork → Commits → Enables in admin
```

**See:** [`PLUGIN_STARTER.md`](./PLUGIN_STARTER.md)

---

## 🆚 PHCloud vs WordPress

| Feature | WordPress | PHCloud CMS |
|---------|-----------|-------------|
| **Hosting Cost** | $5-30/mo | Free |
| **Bundle Size** | 40MB+ | ~50KB |
| **Plugin Install** | Upload ZIP | GitHub fork |
| **Type Safety** | No | Full TypeScript |
| **Edge Native** | No | Yes |
| **Setup Time** | 30+ min | 5 min |

---

## 📖 Documentation

| Doc | Purpose |
|-----|---------|
| [`README.md`](./README.md) | Getting started |
| [`PLUGIN_STARTER.md`](./PLUGIN_STARTER.md) | Build plugins |
| [`THEME_STARTER.md`](./THEME_STARTER.md) | Build themes |
| [`BRAND.md`](./BRAND.md) | Brand guidelines |

---

## 📄 License

**MIT** — Build something awesome.

---

**PHCloud CMS** — Built for the edge. Free forever.

_Made with ☁️ on Cloudflare Pages_
