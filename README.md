# ☁️ PHCloud CMS

**The world's lightest CMS** — runs free on Cloudflare Workers.

```
⚡ 12 files · 50KB bundle · Zero runtime dependencies · Free forever
```

---

## 🚀 Quick Start

```bash
# 1. Fork this repo
github.com/steve/phcloud → Your fork

# 2. Create D1 + KV (free tier)
wrangler d1 create cms_db
wrangler kv:namespace create cms_cache

# 3. Update wrangler.jsonc with your IDs

# 4. Deploy
npm install
npm run deploy
```

Visit your site → complete onboarding wizard → done.

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
| Storage | R2 buckets |
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