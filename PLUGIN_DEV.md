# PHCloud Plugin Development Guide

Build plugins for the world's lightest CMS — runs free on Cloudflare Workers.

---

## Quick Start

```bash
# 1. Fork PHCloud
github.com/steve/phcloud → Your fork

# 2. Create your plugin file
src/plugins/my-plugin.ts

# 3. Register it
src/plugins/index.ts

# 4. Commit + push → Cloudflare deploys
```

---

## Plugin Structure

Every plugin is a single TypeScript file:

```typescript
// src/plugins/my-plugin.ts
import type { PluginHook, CMSRegistry } from '../cms/registry.js';

/**
 * PHCloud Plugin: My Plugin
 * @version 1.0.0
 * @author Your Name
 * @category seo | security | forms | analytics | backup | ecommerce | social | media | custom
 * @description What your plugin does
 */

export function initMyPlugin(registry: CMSRegistry): void {
  registry.register('render:head', myHookFunction);
}

const myHookFunction: PluginHook = (payload) => {
  // Modify payload or perform side effects
  return { ...payload, markup: payload.markup + '<script>...</script>' };
};
```

---

## Available Hooks

| Hook | Payload | Use For |
|------|---------|---------|
| `render:head` | `{ siteName, title, markup, meta }` | Inject meta tags, scripts, styles |
| `render:body` | `{ bodyHtml, post, siteName }` | Modify page content |
| `render:sitemap` | `{ baseUrl, posts }` | Customize sitemap.xml |

---

## Hook Pattern

```typescript
const myHook: PluginHook = (payload) => {
  // 1. Read from payload
  const title = payload.title;
  
  // 2. Do something
  const injection = `<meta name="custom" content="${title}" />`;
  
  // 3. Return modified payload (or same if no changes)
  return {
    ...payload,
    markup: (payload.markup || '') + '\n' + injection
  };
};
```

---

## Example 1: Analytics Plugin

```typescript
// src/plugins/analytics.ts
import type { PluginHook, CMSRegistry } from '../cms/registry.js';

export function initAnalytics(registry: CMSRegistry): void {
  registry.register('render:head', injectAnalytics);
}

const injectAnalytics: PluginHook = (payload) => {
  const GA_ID = 'G-XXXXXXXXXX'; // Or load from plugin config
  
  const script = `
    <script async src="https://www.googletagmanager.com/gtag/js?id=${GA_ID}"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', '${GA_ID}');
    </script>
  `;
  
  return {
    ...payload,
    markup: (payload.markup || '') + '\n' + script
  };
};
```

---

## Example 2: Security Headers Plugin

```typescript
// src/plugins/security-headers.ts
import type { PluginHook, CMSRegistry } from '../cms/registry.js';

export function initSecurityHeaders(registry: CMSRegistry): void {
  registry.register('render:head', injectSecurityHeaders);
}

const injectSecurityHeaders: PluginHook = (payload) => {
  const headers = [
    '<meta http-equiv="Content-Security-Policy" content="default-src \'self\'" />',
    '<meta http-equiv="X-Frame-Options" content="DENY" />',
    '<meta http-equiv="X-Content-Type-Options" content="nosniff" />'
  ].join('\n');
  
  return {
    ...payload,
    markup: (payload.markup || '') + '\n' + headers
  };
};
```

---

## Example 3: News Article SEO Plugin

```typescript
// src/plugins/news-seo.ts
import type { PluginHook, CMSRegistry } from '../cms/registry.js';

export function initNewsSEO(registry: CMSRegistry): void {
  registry.register('render:head', injectNewsSchema);
  registry.register('render:sitemap', addNewsSitemap);
}

const injectNewsSchema: PluginHook = (payload) => {
  // Only inject on article pages
  const post = payload.post;
  if (!post) return payload;
  
  const schema = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    "headline": post.title,
    "datePublished": post.updated_at,
    "author": { "@type": "Organization", "name": payload.siteName }
  };
  
  const jsonLd = `<script type="application/ld+json">${JSON.stringify(schema)}</script>`;
  
  return {
    ...payload,
    markup: (payload.markup || '') + '\n' + jsonLd
  };
};

const addNewsSitemap: PluginHook = (payload) => {
  // Add Google News specific sitemap entries
  const newsPosts = (payload.posts as any[]).filter(p => 
    p.slug.includes('/news/')
  );
  // ... modify payload.markup with news-specific XML
  return payload;
};
```

---

## Example 4: Ecommerce SEO Plugin

```typescript
// src/plugins/ecommerce-seo.ts
import type { PluginHook, CMSRegistry } from '../cms/registry.js';

export function initEcommerceSEO(registry: CMSRegistry): void {
  registry.register('render:head', injectProductSchema);
}

const injectProductSchema: PluginHook = (payload) => {
  const post = payload.post;
  if (!post || !isProduct(post)) return payload;
  
  // Extract price from post meta (developer defines their own convention)
  const price = extractPrice(post.content);
  const availability = post.published ? 'InStock' : 'OutOfStock';
  
  const schema = {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": post.title,
    "offers": {
      "@type": "Offer",
      "price": price.amount,
      "priceCurrency": price.currency,
      "availability": `https://schema.org/${availability}`
    }
  };
  
  const jsonLd = `<script type="application/ld+json">${JSON.stringify(schema)}</script>`;
  
  return {
    ...payload,
    markup: (payload.markup || '') + '\n' + jsonLd
  };
};

function isProduct(post: any): boolean {
  return post.slug?.startsWith('/products/');
}

function extractPrice(content: string): { amount: string; currency: string } {
  // Parse price from content or frontmatter
  const match = content.match(/price:\s*\$?(\d+(?:\.\d{2})?)/i);
  return {
    amount: match ? match[1] : '0.00',
    currency: 'USD'
  };
}
```

---

## Register Your Plugin

Edit `src/plugins/index.ts`:

```typescript
import type { CMSRegistry } from '../cms/registry.js';
import { initSEOPlugin } from './seo.js';
import { initSitemapPlugin } from './sitemap.js';
import { initAnalytics } from './analytics.js';        // ← Your import

export const AVAILABLE_PLUGINS = [
  {
    id: 'seo',
    name: 'SEO',
    description: 'Meta tags, Open Graph, Twitter Cards',
    category: 'seo',
    version: '1.0.0',
    author: 'PHCloud',
    hooks: ['render:head'],
    init: initSEOPlugin,
  },
  {
    id: 'analytics',              // ← Your plugin entry
    name: 'Google Analytics',
    description: 'GA4 tracking code injection',
    category: 'analytics',
    version: '1.0.0',
    author: 'Your Name',
    hooks: ['render:head'],
    init: initAnalytics,
  },
];
```

---

## Plugin Categories

Use these exact category names:

| Category | Purpose |
|----------|---------|
| `seo` | Meta tags, sitemaps, structured data |
| `security` | Headers, bot protection, rate limiting |
| `forms` | Contact forms, validation, spam protection |
| `analytics` | Traffic tracking, conversion pixels |
| `backup` | Data export, scheduled backups |
| `ecommerce` | Shopping cart, payments, product features |
| `social` | Share buttons, auto-posting, embeds |
| `media` | Image optimization, lazy load, galleries |
| `custom` | Everything else |

---

## Plugin Lifecycle

```
1. Developer creates plugin file
   ↓
2. Adds to src/plugins/ in their fork
   ↓
3. Registers in src/plugins/index.ts
   ↓
4. Commits + pushes to GitHub
   ↓
5. Cloudflare Workers Build auto-deploys
   ↓
6. Plugin appears in /admin/plugins
   ↓
7. Site owner toggles ON
   ↓
8. Plugin runs on next request
```

---

## Best Practices

### ✅ Do

```typescript
// Type-safe payload access
const post = payload.post as Post | undefined;
if (!post) return payload;

// Graceful fallbacks
const markup = payload.markup || '';

// Async operations (DB, API calls)
const myHook: PluginHook = async (payload) => {
  const config = await db.prepare("SELECT * FROM plugin_config WHERE key = ?").bind('myplugin').first();
  return { ...payload, config };
};

// Conditional injection (only on certain pages)
if (payload.post?.slug.startsWith('/products/')) {
  // inject ecommerce stuff
}
```

### ❌ Don't

```typescript
// No dynamic imports (Workers don't support them)
await import('./something');  // ❌

// No eval or Function constructor
eval(userInput);  // ❌

// No filesystem access
fs.readFileSync('plugin.json');  // ❌

// No external HTTP calls without error handling
fetch('https://api.example.com');  // ❌ Use try/catch

// Don't mutate payload directly
payload.markup = 'new';  // ❌
return { ...payload, markup: 'new' };  // ✅
```

---

## Plugin Config (Optional)

Store user settings in D1:

```typescript
// In your plugin
const config = await c.env.DB.prepare(
  "SELECT value FROM plugin_config WHERE plugin_id = ? AND key = ?"
).bind('myplugin', 'ga_id').first<{ value: string }>();

// Admin settings page (add route in index.ts)
app.get('/admin/plugins/myplugin', async (c) => {
  const config = await getConfig();
  return c.html(renderSettingsPage(config));
});
```

---

## Distributing Your Plugin

### Step 1: Publish on GitHub

```
github.com/yourname/phcloud-analytics-plugin

Files:
├── src/
│   └── analytics.ts       # The plugin file
├── README.md              # Installation instructions
└── LICENSE                # MIT recommended
```

### Step 2: Write a Clear README

```markdown
# Analytics Plugin for PHCloud

Google Analytics 4 integration for PHCloud CMS.

## Features
- GA4 pageview tracking
- Custom event support
- Privacy-friendly (no cookies)

## Install

1. Download `src/analytics.ts`
2. Copy to your PHCloud fork: `src/plugins/analytics.ts`
3. Add import + `AVAILABLE_PLUGINS` entry with `init: initAnalytics` to `src/plugins/index.ts`
4. Commit + push to GitHub
6. Enable in PHCloud admin: `/admin/plugins`

## Config

Edit `src/plugins/analytics.ts` line 8 to set your GA4 measurement ID.

## License

MIT
```

### Step 3: Share

- Post on Hacker News, Reddit r/webdev, IndieHackers
- Add `phcloud-plugin` topic on GitHub
- Submit to PHCloud community docs (if/when exists)

---

## Debugging

```typescript
// Log to Cloudflare dashboard
app.get('/sitemap.xml', async (c) => {
  console.log('[MyPlugin] Running sitemap hook');  // View in wrangler dev / dashboard
});

// Test locally
npm run dev  # wrangler dev --local
```

---

## API Reference

### `CMSRegistry`

```typescript
class CMSRegistry {
  register(hookName: string, fn: PluginHook): void;
  executePipeline(hookName: string, payload: Record<string, unknown>): Promise<Record<string, unknown>>;
  has(hookName: string): boolean;
  getPlugins(): RegisteredPlugin[];
  getPlugin(id: string): RegisteredPlugin | undefined;
}
```

### `PluginHook`

```typescript
type PluginHook = (payload: Record<string, unknown>) => 
  | Record<string, unknown>
  | Promise<Record<string, unknown>>;
```

---

## Questions?

Plugin system based on WordPress hooks/actions pattern, rebuilt for Cloudflare Workers with TypeScript.

**Example plugins:** See `src/plugins/seo.ts` and `src/plugins/sitemap.ts` in the main PHCloud repo.

---

**License:** This guide is part of PHCloud — MIT licensed.