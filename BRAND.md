# PHCloud CMS - Brand Guidelines

**PHCloud CMS** — The world's lightest CMS. Runs free on Cloudflare Workers.

---

## Name & Logo

### Full Name
**PHCloud CMS**

> Always use "PHCloud CMS" when referring to the full product.
> Use "PHCloud" for short in casual contexts.
> Never use "EdgeCMS" (old name).

### Logo Concept
```
┌──────────────────────────────────────────┐
│                                          │
│   ☁️  PHCloud CMS                        │
│                                          │
│   The World's Lightest CMS               │
│                                          │
└──────────────────────────────────────────┘
```

**Visual Elements:**
- ☁️ Cloud icon (Cloudflare edge network)
- Clean, modern sans-serif typography
- Minimal, developer-focused aesthetic

**Colors:**
| Element | Hex | Use |
|---------|-----|-----|
| Cloud Blue | `#3B82F6` | Primary brand color |
| Cloudflare Orange | `#F97316` | Accents, CTAs |
| Slate Dark | `#0F172A` | Headers, text |
| Slate Light | `#F8FAFC` | Backgrounds |
| Success Green | `#16A34A` | Status, active states |

---

## Voice & Tone

### Developer-First
```
✅ "Build plugins in TypeScript with full type safety"
❌ "Our amazing plugin system makes everything easy"
```

### Honest & Direct
```
✅ "Runs free on Cloudflare Workers — no credit card required"
❌ "Revolutionary cloud-native paradigm shift"
```

### Lightweight Ethos
```
✅ "12 files. 50KB bundle. Zero dependencies."
❌ "Enterprise-grade scalable architecture"
```

---

## Taglines

**Primary:**
> "The world's lightest CMS"

**Alternatives:**
- "WordPress power, Cloudflare speed"
- "Free forever on the edge"
- "Plugins without the bloat"
- "Built for small business, hosted on the cloud"

---

## Product Names

| Product | Description |
|---------|-------------|
| **PHCloud CMS** | The core CMS platform |
| **PHCloud Plugins** | Plugin ecosystem |
| **PHCloud Themes** | Visual theme system |
| **PHCloud Admin** | Dashboard interface |

---

## File & Path Naming

```
src/
├── cms/           # Core CMS modules
├── plugins/       # Plugin directory
├── themes/        # Theme system
├── admin.ts       # Admin panel
└── index.ts       # Main entry (PHCloud router)
```

**Plugin naming convention:**
```typescript
// ✅ Good
src/plugins/news-seo.ts
src/plugins/ecommerce-seo.ts
src/plugins/security-headers.ts

// ❌ Bad
src/plugins/NewsSEOPlugin.ts
src/plugins/seo_plugin.ts
src/plugins/my-cool-plugin-v2-FINAL.ts
```

---

## Admin UI Branding

```
┌─────────────────────────────────────────────────────────────┐
│  ☁️ PHCloud CMS        Dashboard  Posts  New  Plugins  Site  │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Dashboard                                                   │
│                                                               │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐            │
│  │ Total Posts │ │ Published   │ │ Setup       │            │
│  │     12      │ │      8      │ │   ✓ Active  │            │
│  └─────────────┘ └─────────────┘ └─────────────┘            │
│                                                               │
│  Powered by PHCloud CMS on Cloudflare                         │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## Plugin Metadata Format

```typescript
/**
 * PHCloud Plugin: Analytics
 * @version 1.0.0
 * @author Your Name
 * @category analytics
 * @description Google Analytics 4 integration for PHCloud CMS
 * @compatible PHCloud ^1.0.0
 * @license MIT
 */
```

---

## Documentation Voice

**Plugin Developer Guide:**
```markdown
# Building Plugins for PHCloud CMS

PHCloud CMS uses a hook-based plugin system. Plugins are TypeScript
modules that register callbacks at specific points in the page
render cycle.

## Quick Start

1. Fork PHCloud CMS
2. Create your plugin
3. Commit → Deploy
```

**End User Guide:**
```markdown
# Installing Plugins

Find a plugin on GitHub, download it, and drop it into your
PHCloud CMS fork. Cloudflare will deploy it automatically.
```

---

## GitHub Presence

**Repo Name:** `phcloud-cms` (or `phcloud`)

**Description:**
> PHCloud CMS — The world's lightest CMS. Free on Cloudflare Workers.
> TypeScript + Hono + D1 + KV. Plugin system included.

**Topics:**
`cms` `cloudflare` `workers` `typescript` `hono` `d1` `jamstack` `edge`

---

## Release Notes Format

```markdown
## PHCloud CMS v1.0.0

**Date:** 2026-07-12

### New
- Plugin system with hook pipeline
- Admin plugin manager UI
- News SEO hook points

### Changed
- Renamed from EdgeCMS to PHCloud CMS

### Fixed
- TypeScript 7.0 compatibility
```

---

## Community Guidelines

### For Plugin Developers

1. **Use the PHCloud Plugin template** — consistent structure
2. **Test before publishing** — verify it works clean
3. **Write clear README** — installation steps, features, config
4. **Use semantic versioning** — `1.0.0`, `1.1.0`, `2.0.0`
5. **Label GitHub issues** — `plugin`, `bug`, `feature`

### For Site Owners

1. **Fork PHCloud CMS** — your site is your fork
2. **Plugins from trusted sources** — check GitHub stars/activity
3. **Test on staging** — deploy to preview first
4. **Report issues upstream** — help plugin authors improve

---

## Comparison Positioning

| Feature | WordPress | PHCloud CMS |
|---------|-----------|-------------|
| Runtime | PHP/MySQL | Cloudflare Workers |
| Hosting | $5-30/mo | Free tier |
| Bundle Size | 40MB+ | ~50KB |
| Plugin Install | Upload ZIP | GitHub fork → commit |
| Type Safety | No | Full TypeScript |
| Edge Native | No | Yes |

**Messaging:**
> "WordPress was built for shared hosting in 2003. PHCloud CMS was built for the edge in 2026."

---

## Press/Media Kit

**Logo:** (ASCII for now — can be designed later)
```
   ☁️ PHCloud CMS
```

**Elevator Pitch:**
> PHCloud CMS is a lightweight, open-source CMS built on Cloudflare Workers.
> It runs free on Cloudflare's edge network, uses a GitHub-based plugin
> system, and requires zero configuration to get started.

**Technical Specs:**
- Runtime: Cloudflare Workers (V8 isolates)
- Database: D1 (globally distributed SQLite)
- Cache: KV namespaces
- Storage: R2 buckets
- Framework: Hono v4
- Language: TypeScript

---

## Contact & Attribution

**Created by:** PHCloud Community
**License:** MIT
**Homepage:** (TBD — GitHub repo for now)
**Docs:** `/docs` in repo + `PLUGIN_DEV.md`

**Footer for PHCloud sites:**
```html
<footer>
  Powered by PHCloud CMS on Cloudflare
</footer>
```

---

## Brand Usage Example

**Plugin README:**
```markdown
# SEO Plugin for PHCloud CMS

Advanced SEO optimization for PHCloud CMS sites running on Cloudflare.

## Features
- Auto-generates meta tags
- Open Graph + Twitter Cards
- Schema.org structured data
- Google News sitemap

## Install

Drop into your PHCloud CMS fork and enable in the Plugins admin panel.

## Requirements
- PHCloud CMS v1.0.0 or later
- Cloudflare Workers (free tier compatible)
```

---

**These guidelines ensure PHCloud CMS has a consistent, professional brand
across all plugins, documentation, and community materials.**

_Last updated: 2026-07-12_