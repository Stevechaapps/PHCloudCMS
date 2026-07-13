# PHCloud Theme Developer Guide

Build beautiful, mobile-responsive themes for PHCloud CMS.

---

## 🎯 What is a PHCloud Theme?

A theme is a **TypeScript plugin** that hooks into PHCloud's rendering pipeline to inject CSS and wrap content in your HTML layout.

**Key insight:** Themes use the same plugin system — no separate theme infrastructure needed.

---

## 🚀 Quick Start

```bash
# 1. Fork the theme template
github.com/steve/phcloud-theme-starter → Your fork

# 2. Customize
#    - Colors (CSS variables)
#    - Fonts (Google Fonts)
#    - Layout (CSS Grid/Flexbox)

# 3. Test locally
#    Copy to PHCloud fork → npm run dev → test on phone

# 4. Publish
#    Push to GitHub → add screenshots → share
```

---

## 📱 Mobile-First Requirements

Every PHCloud theme **MUST**:

| Requirement | How | Why |
|-------------|-----|-----|
| **Responsive breakpoints** | Mobile (default) → Tablet (768px) → Desktop (1024px) | 55-60% traffic is mobile |
| **Touch-friendly** | Buttons ≥44px, readable text ≥16px | Thumb-friendly navigation |
| **Fast load** | <1s on 3G, <200KB total assets | Bounce rate spikes after 3s |
| **Accessible** | WCAG 2.1 AA (contrast, keyboard nav) | Legal compliance + inclusivity |
| **Tested** | iOS Safari, Android Chrome, desktop Chrome | Real devices, not just simulators |

---

## 📁 Theme Structure

```
phcloud-your-theme/
├── src/
│   └── themes/
│       └── your-theme.ts      # Theme plugin file
├── preview/
│   ├── mobile.png             # Screenshot: mobile view
│   ├── tablet.png             # Screenshot: tablet view
│   └── desktop.png            # Screenshot: desktop view
├── README.md                   # Theme docs + install
└── LICENSE                     # MIT recommended
```

---

## 🎨 Theme Template (Copy This)

```typescript
// src/themes/your-theme.ts
import type { PluginHook, CMSRegistry } from '../cms/registry.js';

/**
 * PHCloud Theme: Your Theme Name
 * @version 1.0.0
 * @author Your Name <your@email.com>
 * @category theme
 * @description Mobile-first, responsive theme for PHCloud CMS
 * @compatible PHCloud ^1.0.0
 * @license MIT
 * @repo https://github.com/yourname/phcloud-your-theme
 */

// ═══════════════════════════════════════════════════════════════
//  CSS Variables (easy customization for site owners)
// ═══════════════════════════════════════════════════════════════

const CSS_VARS = `
<style>
:root {
  /* Colors */
  --color-primary: #2563eb;
  --color-primary-hover: #1d4ed8;
  --color-background: #ffffff;
  --color-surface: #f8fafc;
  --color-text: #1e293b;
  --color-text-muted: #64748b;
  --color-text-inverse: #ffffff;
  
  /* Spacing */
  --space-xs: 0.5rem;
  --space-sm: 1rem;
  --space-md: 1.5rem;
  --space-lg: 2rem;
  --space-xl: 3rem;
  
  /* Typography */
  --font-family: 'Inter', system-ui, sans-serif;
  --font-size-base: 16px;
  --font-size-sm: 0.875rem;
  --font-size-lg: 1.125rem;
  --font-size-xl: 1.5rem;
  --font-size-2xl: 2rem;
  --font-size-3xl: 3rem;
  
  /* Layout */
  --container-max: 720px;
  --container-tablet: 960px;
  --container-desktop: 1200px;
  --header-height: 64px;
  
  /* Borders */
  --border-color: #e5e7eb;
  --border-radius: 8px;
  
  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
  --shadow-md: 0 4px 6px rgba(0,0,0,0.1);
  --shadow-lg: 0 10px 15px rgba(0,0,0,0.1);
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  :root {
    --color-background: #0f172a;
    --color-surface: #1e293b;
    --color-text: #f1f5f9;
    --color-text-muted: #94a3b8;
    --border-color: #334155;
  }
}
</style>
`;

// ═══════════════════════════════════════════════════════════════
//  Responsive CSS (mobile-first)
// ═══════════════════════════════════════════════════════════════

const RESPONSIVE_CSS = `
<style>
/* BASE STYLES (mobile first - phones < 768px) */
* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: var(--font-family);
  font-size: var(--font-size-base);
  line-height: 1.7;
  color: var(--color-text);
  background: var(--color-background);
  padding-top: var(--header-height);
  min-height: 100vh;
}

/* Header - fixed, touch-friendly */
.site-header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: var(--header-height);
  background: var(--color-surface);
  border-bottom: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--space-sm);
  z-index: 1000;
  box-shadow: var(--shadow-sm);
}

.site-logo {
  font-size: var(--font-size-lg);
  font-weight: 700;
  color: var(--color-primary);
  text-decoration: none;
}

.site-logo:hover {
  opacity: 0.8;
}

/* Navigation */
.site-nav {
  display: flex;
  gap: var(--space-xs);
}

.nav-link {
  color: var(--color-text);
  text-decoration: none;
  font-size: var(--font-size-sm);
  padding: var(--space-xs) var(--space-sm);
  border-radius: var(--border-radius);
  min-height: 44px;  /* Touch target */
  min-width: 44px;
  display: flex;
  align-items: center;
  transition: background 0.2s ease;
}

.nav-link:hover {
  background: var(--color-primary);
  color: var(--color-text-inverse);
}

/* Main content */
.site-main {
  max-width: var(--container-max);
  margin: 0 auto;
  padding: var(--space-md) var(--space-sm);
}

/* Article styling */
.article {
  margin-bottom: var(--space-xl);
}

.article-title {
  font-size: var(--font-size-2xl);
  font-weight: 700;
  line-height: 1.2;
  margin-bottom: var(--space-sm);
  color: var(--color-text);
}

.article-meta {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  margin-bottom: var(--space-md);
}

.article-content {
  line-height: 1.8;
}

.article-content p {
  margin-bottom: var(--space-md);
}

.article-content h2 {
  font-size: var(--font-size-xl);
  margin: var(--space-lg) 0 var(--space-sm);
}

.article-content a {
  color: var(--color-primary);
  text-decoration: underline;
}

.article-content img {
  max-width: 100%;
  height: auto;
  border-radius: var(--border-radius);
  margin: var(--space-md) 0;
}

/* Footer */
.site-footer {
  background: var(--color-surface);
  padding: var(--space-lg) var(--space-sm);
  text-align: center;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  border-top: 1px solid var(--border-color);
}

/* TABLET (768px and up) */
@media (min-width: 768px) {
  :root {
    --container-max: var(--container-tablet);
    --header-height: 72px;
  }
  
  .site-header {
    padding: 0 var(--space-lg);
  }
  
  .site-main {
    padding: var(--space-lg);
  }
  
  .article-title {
    font-size: var(--font-size-3xl);
  }
}

/* DESKTOP (1024px and up) */
@media (min-width: 1024px) {
  :root {
    --container-max: var(--container-desktop);
  }
  
  .site-header {
    padding: 0 var(--space-xl);
  }
  
  .site-main {
    padding: var(--space-xl);
  }
}

/* Print styles */
@media print {
  .site-header, .site-footer, .site-nav { display: none; }
  .site-main { padding: 0; }
  body { font-size: 12pt; }
}
</style>
`;

// ═══════════════════════════════════════════════════════════════
//  Google Fonts
// ═══════════════════════════════════════════════════════════════

const GOOGLE_FONTS = `
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
`;

// ═══════════════════════════════════════════════════════════════
//  Theme Initialization
// ═══════════════════════════════════════════════════════════════

export function initYourTheme(registry: CMSRegistry): void {
  registry.register('render:head', injectThemeHead);
  registry.register('render:body', wrapInThemeLayout);
}

const injectThemeHead: PluginHook = (payload) => {
  return {
    ...payload,
    markup: (payload.markup as string || '') + '\n' + GOOGLE_FONTS + '\n' + CSS_VARS + '\n' + RESPONSIVE_CSS
  };
};

const wrapInThemeLayout: PluginHook = (payload) => {
  const siteName = (payload.siteName as string) || 'Site';
  const bodyHtml = (payload.bodyHtml as string) || '';
  
  const html = `
<header class="site-header">
  <a href="/" class="site-logo">${escapeHtml(siteName)}</a>
  <nav class="site-nav">
    <a href="/" class="nav-link">Home</a>
    <a href="/admin" class="nav-link">Admin</a>
  </nav>
</header>

<main class="site-main">
${bodyHtml}
</main>

<footer class="site-footer">
  <p>&copy; ${new Date().getFullYear()} ${escapeHtml(siteName)}. Powered by PHCloud CMS.</p>
</footer>
`;

  return { ...payload, bodyHtml: html };
};

// ═══════════════════════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════════════════════

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"');
}
```

---

## ✅ Mobile-First Checklist

Before publishing your theme:

```
□ Tested on iPhone (Safari) - actual device or simulator
□ Tested on Android (Chrome) - actual device or simulator
□ Tested on iPad or tablet viewport (768px)
□ Tested on desktop (1024px+)
□ Touch targets ≥44px (buttons, links, form inputs)
□ Text readable without zooming (16px base minimum)
□ No horizontal scroll at any breakpoint
□ Images responsive (max-width: 100%)
□ Dark mode respecting (prefers-color-scheme)
□ Contrast ratio ≥4.5:1 (use webaim.org/resources/contrastchecker)
□ Keyboard navigation works (Tab through all elements)
□ Load time <2s on 3G (use pagespeed.web.dev)
```

---

## 🧪 Test Your Theme

```bash
# 1. Copy to PHCloud fork
cp src/themes/your-theme.ts ~/phcloud/src/themes/

# 2. Register it
# Edit ~/phcloud/src/plugins/index.ts

# 3. Run locally
cd ~/phcloud
npm run dev

# 4. Test on real devices
# - Phone: http://YOUR-LOCAL-IP:8787
# - Tablet: DevTools → Toggle Device Toolbar
# - Desktop: Normal view
```

---

## 📸 Screenshots to Include

In your theme's `preview/` folder:

```
mobile.png       - 375px width (iPhone SE)
tablet.png       - 768px width (iPad)
desktop.png      - 1440px width (Desktop)
dark-mode.png    - Dark theme variant (optional but recommended)
```

**How to capture:**

1. Run PHCloud locally with your theme
2. Open DevTools → Device Toolbar (Ctrl+Shift+M)
3. Select device: iPhone SE, iPad, Responsive (1440px)
4. Capture: Three dots → "Capture screenshot" or use extension
5. Save as PNG in `preview/` folder

---

## 📖 README Template

```markdown
# [Your Theme Name] for PHCloud CMS

[One sentence description — e.g., "Clean, professional theme for SaaS companies."]

## ✨ Features

- 📱 Mobile-first responsive design
- 🌙 Dark mode support (auto-detects system preference)
- ♿ WCAG 2.1 AA accessible
- ⚡ Fast load (<1s on 3G)
- 🎨 Easy color customization via CSS variables

## 📦 Install

```bash
# 1. Download
curl -O https://github.com/you/phcloud-your-theme/raw/main/src/themes/your-theme.ts

# 2. Copy to PHCloud fork
cp your-theme.ts ~/my-phcloud-site/src/themes/

# 3. Register in src/plugins/index.ts:
import { initYourTheme } from './themes/your-theme.js';
initYourTheme(registry);

# 4. Commit + push
git add src/plugins/
git commit -m "Add Your Theme"
git push

# 5. Enable in /admin/plugins
```

## 🎨 Customize

Edit CSS variables in `your-theme.ts`:

```typescript
const CSS_VARS = `
:root {
  --color-primary: #YOUR_COLOR;
  --color-background: #YOUR_COLOR;
  /* etc */
}
`;
```

## 📱 Preview

![Mobile](preview/mobile.png)
![Desktop](preview/desktop.png)

## 📄 License

MIT
```

---

## 🏷 Add GitHub Topics

GitHub repo → Settings → Topics:

```
phcloud-theme
phcloud
cms
cloudflare
workers
typescript
responsive
mobile-first
```

---

## 📤 Publish Your Theme

```bash
# Initialize git
git init
git add .
git commit -m "Initial release: Your Theme Name"

# Push to GitHub
git remote add origin git@github.com:YOU/phcloud-your-theme.git
git branch -M main
git push -u origin main
```

---

## 🔗 Submit to PHCloud Theme Gallery

Open a PR to add your theme to the official list:

github.com/steve/phcloud → THEMES.md

```markdown
| [Your Theme Name] | [Preview](link) | [Download](link) | @yourname |
```

---

## 🎯 Theme Ideas

| Theme | Use Case |
|-------|----------|
| **Modern Blue** | Corporate, SaaS, professional services |
| **Minimal** | Bloggers, writers, newsletters |
| **Magazine** | News sites, multi-author blogs |
| **Portfolio** | Designers, photographers, creatives |
| **Shop** | Ecommerce, product catalogs |
| **Startup** | Landing pages, MVP launches |
| **Local Business** | Restaurants, salons, contractors |

---

## 📚 Resources

- [PHCloud Plugin Guide](./PLUGIN_DEV.md)
- [Mobile First Design](https://web.dev/learn/design/mobile-first)
- [Responsive Web Design](https://web.dev/learn/design/responsive)
- [WCAG 2.1 Checklist](https://www.w3.org/WAI/WCAG21/quickref/)
- [Google PageSpeed](https://pagespeed.web.dev)
- [Google Fonts](https://fonts.google.com)

---

## 📄 License

**MIT** — Build something beautiful.

---

**Created for PHCloud CMS — The world's lightest CMS**

_Made with ☁️ on Cloudflare Workers_