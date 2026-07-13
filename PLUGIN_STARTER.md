# PHCloud Plugin Starter

A starter template for building plugins for [PHCloud CMS](https://github.com/steve/phcloud).

---

## 🚀 Quick Start

```bash
# 1. Fork this repo
github.com/steve/phcloud-plugin-starter → Your fork

# 2. Rename files
phcloud-plugin.ts → your-plugin-name.ts

# 3. Edit plugin metadata
#    - Name, version, author, description
#    - Register your hooks

# 4. Copy to PHCloud fork
cp your-plugin.ts ~/Desktop/my-phcloud-site/src/plugins/

# 5. Register in PHCloud
#    Edit: src/plugins/index.ts
```

---

## 📁 File Structure

```
phcloud-plugin-starter/
├── src/
│   └── phcloud-plugin.ts    # ← The plugin (rename me)
├── README.md                 # ← Customize this
├── LICENSE                   # MIT recommended
└── package.json              # Plugin metadata
```

---

## 📝 Plugin Template

```typescript
// src/phcloud-plugin.ts
import type { PluginHook, CMSRegistry } from '../cms/registry.js';

/**
 * PHCloud Plugin: [Your Plugin Name]
 * @version 1.0.0
 * @author Your Name <your@email.com>
 * @category seo | security | forms | analytics | backup | ecommerce | social | media | custom
 * @description What your plugin does (1-2 sentences)
 * @compatible PHCloud ^1.0.0
 * @license MIT
 * @repo https://github.com/yourusername/phcloud-your-plugin
 */

export function initYourPlugin(registry: CMSRegistry): void {
  // Register your hook(s) here
  registry.register('render:head', injectYourFeature);
  // registry.register('render:body', modifyContent);
  // registry.register('post:save', onPostSave);
}

// Your hook function
const injectYourFeature: PluginHook = (payload) => {
  // 1. Read from payload
  const siteName = payload.siteName as string;
  const title = payload.title as string;
  const post = payload.post as any;

  // 2. Do something
  const injection = `<!-- Plugin injection -->`;

  // 3. Return modified payload
  return {
    ...payload,
    markup: (payload.markup as string || '') + '\n' + injection
  };
};
```

---

## 🔧 Customization Checklist

### 1. Rename the Init Function
```typescript
// ❌ Generic
export function initYourPlugin(registry: CMSRegistry): void

// ✅ Specific
export function initAnalytics(registry: CMSRegistry): void
export function initNewsSEO(registry: CMSRegistry): void
export function initSecurityHeaders(registry: CMSRegistry): void
```

### 2. Update Metadata Block
```typescript
/**
 * PHCloud Plugin: Google Analytics
 * @version 1.0.0
 * @author Jane Developer <jane@example.com>
 * @category analytics
 * @description Injects GA4 tracking code on all pages
 * @compatible PHCloud ^1.0.0
 * @license MIT
 */
```

### 3. Register Correct Hooks
```typescript
export function initAnalytics(registry: CMSRegistry): void {
  registry.register('render:head', injectGA);    // ✅
  // registry.register('render:body', ...)       // Only if needed
  // registry.register('post:save', onPublish)   // Only if needed
}
```

### 4. Update README
Replace ALL `[bracket placeholders]` with your info.

---

## 📦 Example: Complete Analytics Plugin

```typescript
// src/analytics.ts
import type { PluginHook, CMSRegistry } from '../cms/registry.js';

/**
 * PHCloud Plugin: Google Analytics
 * @version 1.0.0
 * @author Jane Developer <jane@example.com>
 * @category analytics
 * @description Google Analytics 4 tracking for PHCloud CMS
 * @compatible PHCloud ^1.0.0
 * @license MIT
 */

// Configuration (site owner edits this)
const GA_MEASUREMENT_ID = 'G-XXXXXXXXXX';

export function initAnalytics(registry: CMSRegistry): void {
  registry.register('render:head', injectAnalytics);
}

const injectAnalytics: PluginHook = (payload) => {
  const script = `
<!-- Google Analytics -->
<script async src="https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', '${GA_MEASUREMENT_ID}');
</script>
<!-- End Google Analytics -->`;

  return {
    ...payload,
    markup: (payload.markup as string || '') + '\n' + script
  };
};
```

---

## 📖 README Template

```markdown
# [Plugin Name] for PHCloud CMS

[Brief description — what it does, who it's for]

## ✨ Features

- Feature 1
- Feature 2
- Feature 3

## 📦 Install

```bash
# 1. Download this plugin
curl -O https://github.com/yourusername/phcloud-plugin/raw/main/src/plugin.ts

# 2. Copy to your PHCloud fork
cp plugin.ts ~/Desktop/my-phcloud-site/src/plugins/

# 3. Register in src/plugins/index.ts
#    import { initPlugin } from './plugin.js';
#    initPlugin(registry);

# 4. Commit + push
git add src/plugins/
git commit -m "Add [Plugin Name]"
git push

# 5. Enable in PHCloud admin: /admin/plugins
```

## ⚙️ Configuration

Edit `plugin.ts` to customize:

```typescript
const CONFIG = {
  apiKey: 'your-key-here',
  enabled: true,
};
```

## 🪝 Hooks Used

| Hook | Purpose |
|------|---------|
| `render:head` | Inject scripts/styles |
| `render:body` | Modify page content |

## 📝 Changelog

### v1.0.0
- Initial release

## 📄 License

MIT

## 🙋 Support

Open an issue on GitHub.
```

---

## 🧪 Testing Your Plugin

```bash
# 1. Copy to local PHCloud fork
cp src/plugin.ts ~/phcloud/src/plugins/

# 2. Register it
# Edit ~/phcloud/src/plugins/index.ts

# 3. Run locally
cd ~/phcloud
npm run dev

# 4. Visit http://localhost:8787
# Check Cloudflare dashboard logs
```

---

## 📤 Publishing

### Step 1: Clean Up

```
✅ Plugin works with no errors
✅ README is complete
✅ LICENSE included
✅ No TODO comments
✅ Tested on local PHCloud
```

### Step 2: Push to GitHub

```bash
git init
git add .
git commit -m "Initial release"
git remote add origin git@github.com:you/phcloud-plugin.git
git push -u origin main
```

### Step 3: Add GitHub Topics

GitHub repo → Settings → Topics:
```
phcloud-plugin
phcloud
cms
cloudflare
workers
typescript
```

### Step 4: Share

- Post to r/webdev
- Hacker News "Show HN"
- PHCloud community (when exists)
- Twitter/LinkedIn

---

## 🎯 Plugin Ideas

| Category | Idea |
|----------|------|
| `seo` | News article schema, local business SEO, video sitemap |
| `security` | Rate limiting, bot detection, security headers |
| `forms` | Contact form handler, spam protection, newsletter signup |
| `analytics` | GA4, Plausible, Fathom, Microsoft Clarity |
| `backup` | JSON export, scheduled R2 backup, email backup |
| `ecommerce` | Stripe checkout, product schema, inventory tracking |
| `social` | Share buttons, auto-tweet, LinkedIn auto-post |
| `media` | Lazy loading, WebP conversion, image CDN |
| `custom` | A/B testing, chat widgets, cookie consent |

---

## 📚 Resources

- [PHCloud CMS Main Repo](https://github.com/steve/phcloud)
- [PHCloud Plugin Developer Guide](https://github.com/steve/phcloud/blob/main/PLUGIN_DEV.md)
- [PHCloud Brand Guidelines](https://github.com/steve/phcloud/blob/main/BRAND.md)
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Hono Framework Docs](https://hono.dev/)

---

## 📄 License

MIT — Build something awesome.

---

**Created for PHCloud CMS — The world's lightest CMS**