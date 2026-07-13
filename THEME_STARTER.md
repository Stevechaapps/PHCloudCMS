# PHCloud Theme Starter

Build beautiful, mobile-responsive themes for PHCloud CMS.

---

## 🚀 Quick Start

```bash
# 1. Fork this template
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

| Requirement | How |
|-------------|-----|
| **Responsive breakpoints** | Mobile (default) → Tablet (768px) → Desktop (1024px) |
| **Touch-friendly** | Buttons ≥44px, readable text ≥16px |
| **Fast load** | <1s on 3G, <200KB total assets |
| **Accessible** | WCAG 2.1 AA (contrast, keyboard nav) |
| **Tested** | iOS Safari, Android Chrome, desktop Chrome |

---

## 📁 Theme Structure

```
phcloud-theme-starter/
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
// src/themes/modern-responsive.ts
import type { PluginHook, CMSRegistry } from '../cms/registry.js';

/**
 * PHCloud Theme: Modern Responsive
 * @version 1.0.0
 * @author Your Name <your@email.com>
 * @category theme
 * @description Mobile-first, responsive theme for PHCloud CMS
 * @compatible PHCloud ^1.0.0
 * @license MIT
 */

// ═══════════════════════════════════════════════════════════════
//  CSS Variables (easy customization for site owners)
// ═══════════════════════════════════════════════════════════════

const CSS_VARS = `
:root {
  /* Colors */
  --color-primary: #2563eb;
  --color-secondary: #64748b;
  --color-background: #ffffff;
  --color-surface: #f8fafc;
  --color-text: #1e293b;
  --color-text-muted: #64748b;
  
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
  
  /* Layout */
  --container-max: 720px;
  --header-height: 60px;
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  :root {
    --color-background: #0f172a;
    --color-surface: #1e293b;
    --color-text: #f1f5f9;
    --color-text-muted: #94a3b8;
  }
}
`;

// ═══════════════════════════════════════════════════════════════
//  Responsive CSS (mobile-first)
// ═══════════════════════════════════════════════════════════════

const RESPONSIVE_CSS = `
/* BASE STYLES (mobile first - phones < 768px) */
* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: var(--font-family);
  font-size: var(--font-size-base);
  line-height: 1.6;
  color: var(--color-text);
  background: var(--color-background);
  padding-top: var(--header-height);
}

/* Header - sticky, touch-friendly */
.site-header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: var(--header-height);
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-text-muted);
  display: flex;
  align-items: center;
  padding: 0 var(--space-sm);
  z-index: 1000;
}

.site-logo {
  font-size: var(--font-size-lg);
  font-weight: 700;
  color: var(--color-primary);
  text-decoration: none;
}

/* Navigation - mobile menu */
.site-nav {
  margin-left: auto;
  display: flex;
  gap: var(--space-sm);
}

.nav-link {
  color: var(--color-text);
  text-decoration: none;
  font-size: var(--font-size-sm);
  padding: var(--space-xs) var(--space-sm);
  border-radius: 4px;
  min-height: 44px;  /* Touch target */
  min-width: 44px;
  display: flex;
  align-items: center;
}

.nav-link:hover {
  background: var(--color-primary);
  color: white;
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
  margin-bottom: var(--space-sm);
  line-height: 1.2;
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
}

/* Footer */
.site-footer {
  background: var(--color-surface);
  padding: var(--space-lg) var(--space-sm);
  text-align: center;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  border-top: 1px solid var(--color-text-muted);
}

/* Buttons - touch-friendly */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;  /* Touch target */
  padding: var(--space-sm) var(--space-md);
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: 6px;
  font-size: var(--font-size-base);
  text-decoration: none;
  cursor: pointer;
}

.btn:hover {
  opacity: 0.9;
}

/* Forms */
input, textarea {
  width: 100%;
  padding: var(--space-sm);
  border: 1px solid var(--color-text-muted);
  border-radius: 4px;
  font-size: var(--font-size-base);
  font-family: inherit;
}

input:focus, textarea:focus {
  outline: 2px solid var(--color-primary);
  border-color: transparent;
}

/* TABLET (768px and up) */
@media (min-width: 768px) {
  :root {
    --container-max: 960px;
    --header-height: 70px;
  }
  
  .site-header {
    padding: 0 var(--space-lg);
  }
  
  .site-main {
    padding: var(--space-lg);
  }
  
  .article-title {
    font-size: 2.5rem;
  }
}

/* DESKTOP (1024px and up) */
@media (min-width: 1024px) {
  :root {
    --container-max: 1200px;
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
}
`;

// ═══════════════════════════════════════════════════════════════
//  Theme Initialization
// ═══════════════════════════════════════════════════════════════

export function initModernResponsive(registry: CMSRegistry): void {
  registry.register('render:head', injectThemeHead);
  registry.register('render:body', wrapInThemeLayout);
}

const injectThemeHead: PluginHook = (payload) => {
  return {
    ...payload,
    markup: (payload.markup as string || '') + `
${CSS_VARS}
${RESPONSIVE_CSS}
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5">
`
  };
};

const wrapInThemeLayout: PluginHook = (payload) => {
  const siteName = payload.siteName as string || 'Site';
  const bodyHtml = payload.bodyHtml as string || '';
  
  const html = `
<header class="site-header">
  <a href="/" class="site-logo">${siteName}</a>
  <nav class="site-nav">
    <a href="/" class="nav-link">Home</a>
    <a href="/admin" class="nav-link">Admin</a>
  </nav>
</header>

<main class="site-main">
${bodyHtml}
</main>

<footer class="site-footer">
  <p>Powered by PHCloud CMS</p>
</footer>
`;

  return { ...payload, bodyHtml: html };
};
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
# Edit ~/phcloud/src/plugins/index.ts (or themes/index.ts)

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
mobile.png       - 375px width (iPhone)
tablet.png       - 768px width (iPad)
desktop.png      - 1440px width (Desktop)
dark-mode.png    - Dark theme variant (optional)
```

---

## 📖 README Template

```markdown
# Modern Responsive Theme for PHCloud CMS

Clean, mobile-first theme for PHCloud CMS sites.

## ✨ Features

- 📱 Mobile-first responsive design
- 🌙 Dark mode support
- ♿ WCAG 2.1 AA accessible
- ⚡ Fast load (<1s on 3G)
- 🎨 Easy color customization

## 📦 Install

```bash
# 1. Download
curl -O https://github.com/you/phcloud-modern-theme/raw/main/src/themes/modern-responsive.ts

# 2. Copy to PHCloud fork
cp modern-responsive.ts ~/my-phcloud-site/src/themes/

# 3. Register (see INSTALL.md)

# 4. Enable in /admin/plugins
```

## 🎨 Customize

Edit CSS variables in `modern-responsive.ts`:

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

## 🎯 Theme Ideas

| Theme | Use Case |
|-------|----------|
| **Modern Responsive** | Corporate, SaaS, services (this template) |
| **Minimal Writer** | Bloggers, authors, newsletters |
| **Magazine** | News sites, multi-author blogs |
| **Portfolio** | Designers, photographers, creatives |
| **Shop** | Ecommerce, product catalogs |
| **Startup** | Landing pages, MVP launches |
| **Local Business** | Restaurants, salons, contractors |

---

## 🔗 Resources

- [PHCloud Plugin Guide](./PLUGIN_DEV.md)
- [Mobile First Design](https://web.dev/learn/design/mobile-first)
- [WCAG 2.1 Checklist](https://www.w3.org/WAI/WCAG21/quickref/)
- [Google PageSpeed](https://pagespeed.web.dev)
- [Responsive Web Design](https://web.dev/learn/design/responsive)

---

**Build something beautiful. Mobile-first, always.**

_Made for PHCloud CMS_