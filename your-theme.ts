// PHCloud Theme: Your Theme Name
// Starter template for building PHCloud CMS themes.
// Edit this file to create your custom theme.

import type { PluginHook, CMSRegistry } from '../cms/registry.js';

// ═══════════════════════════════════════════════════════════════
//  THEME METADATA - Edit this section
// ═══════════════════════════════════════════════════════════════

/**
 * PHCloud Theme: [Your Theme Name]
 * @version 1.0.0
 * @author Your Name <your@email.com>
 * @category theme
 * @description A beautiful, mobile-responsive theme for PHCloud CMS
 * @compatible PHCloud ^1.0.0
 * @license MIT
 * @repo https://github.com/yourname/phcloud-your-theme
 */

// ═══════════════════════════════════════════════════════════════
//  CSS VARIABLES - Customize your theme colors
// ═══════════════════════════════════════════════════════════════

const CSS_VARS = `
<style>
:root {
  /* Primary Colors */
  --color-primary: #2563eb;       /* Blue - change to your brand color */
  --color-primary-hover: #1d4ed8; /* Darker blue for hover */

  /* Background Colors */
  --color-background: #ffffff;     /* Page background */
  --color-surface: #f8fafc;        /* Cards, headers, footers */

  /* Text Colors */
  --color-text: #1e293b;           /* Main text */
  --color-text-muted: #64748b;     /* Secondary text */
  --color-text-inverse: #ffffff;   /* Text on dark backgrounds */

  /* Spacing Scale */
  --space-xs: 0.5rem;   /* 8px */
  --space-sm: 1rem;     /* 16px */
  --space-md: 1.5rem;   /* 24px */
  --space-lg: 2rem;     /* 32px */
  --space-xl: 3rem;     /* 48px */

  /* Typography */
  --font-family: 'Inter', system-ui, -apple-system, sans-serif;
  --font-size-base: 16px;
  --font-size-sm: 0.875rem;
  --font-size-lg: 1.125rem;
  --font-size-xl: 1.5rem;
  --font-size-2xl: 2rem;
  --font-size-3xl: 3rem;

  /* Layout */
  --container-max: 720px;    /* Mobile-first max-width */
  --container-tablet: 960px; /* Tablet max-width */
  --container-desktop: 1200px; /* Desktop max-width */
  --header-height: 64px;

  /* Borders */
  --border-color: #e5e7eb;
  --border-radius: 8px;

  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
  --shadow-md: 0 4px 6px rgba(0,0,0,0.1);
  --shadow-lg: 0 10px 15px rgba(0,0,0,0.1);
}

/* Dark Mode (auto-detects system preference) */
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
//  RESPONSIVE CSS - Mobile-first design
// ═══════════════════════════════════════════════════════════════

const RESPONSIVE_CSS = `
<style>
/* ═══════════════════════════════════════════════════════════════
   BASE STYLES (Mobile First - phones < 768px)
   ═══════════════════════════════════════════════════════════════ */

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

/* Header - Fixed, touch-friendly */
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
  min-height: 44px;  /* Touch target size */
  min-width: 44px;
  display: flex;
  align-items: center;
  transition: background 0.2s ease;
}

.nav-link:hover {
  background: var(--color-primary);
  color: var(--color-text-inverse);
}

/* Main content area */
.site-main {
  max-width: var(--container-max);
  margin: 0 auto;
  padding: var(--space-md) var(--space-sm);
}

/* Article/Post styling */
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

.article-content h3 {
  font-size: var(--font-size-lg);
  margin: var(--space-md) 0 var(--space-sm);
}

.article-content a {
  color: var(--color-primary);
  text-decoration: underline;
}

.article-content a:hover {
  text-decoration: none;
}

.article-content img {
  max-width: 100%;
  height: auto;
  border-radius: var(--border-radius);
  margin: var(--space-md) 0;
}

.article-content ul, .article-content ol {
  margin: var(--space-md) 0;
  padding-left: var(--space-lg);
}

.article-content li {
  margin-bottom: var(--space-xs);
}

.article-content blockquote {
  border-left: 4px solid var(--color-primary);
  padding-left: var(--space-sm);
  color: var(--color-text-muted);
  font-style: italic;
}

.article-content code {
  background: var(--color-surface);
  padding: 0.2em 0.4em;
  border-radius: 4px;
  font-family: 'SF Mono', Consolas, monospace;
  font-size: 0.9em;
}

/* Buttons - Touch-friendly (44px minimum) */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  padding: var(--space-sm) var(--space-md);
  background: var(--color-primary);
  color: var(--color-text-inverse);
  border: none;
  border-radius: var(--border-radius);
  font-size: var(--font-size-base);
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
  transition: opacity 0.2s ease;
}

.btn:hover {
  opacity: 0.9;
  text-decoration: none;
}

.btn-secondary {
  background: var(--color-surface);
  color: var(--color-text);
  border: 1px solid var(--border-color);
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

/* Forms */
input[type="text"],
input[type="email"],
input[type="password"],
input[type="search"],
textarea {
  width: 100%;
  padding: var(--space-sm);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius);
  font-size: var(--font-size-base);
  font-family: inherit;
  background: var(--color-background);
  color: var(--color-text);
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

input:focus, textarea:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

/* Cards */
.card {
  background: var(--color-surface);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius);
  padding: var(--space-md);
  margin-bottom: var(--space-md);
  box-shadow: var(--shadow-sm);
}

.card-title {
  font-size: var(--font-size-lg);
  font-weight: 600;
  margin-bottom: var(--space-xs);
}

/* Post list */
.post-list {
  list-style: none;
}

.post-item {
  padding: var(--space-md) 0;
  border-bottom: 1px solid var(--border-color);
}

.post-item:last-child {
  border-bottom: none;
}

.post-title {
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--color-text);
  text-decoration: none;
  display: block;
  margin-bottom: var(--space-xs);
}

.post-title:hover {
  color: var(--color-primary);
  text-decoration: underline;
}

.post-excerpt {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  line-height: 1.6;
}

/* Alert/Notice */
.alert {
  background: var(--color-surface);
  border-left: 4px solid var(--color-primary);
  padding: var(--space-md);
  border-radius: var(--border-radius);
  margin: var(--space-md) 0;
}

/* ═══════════════════════════════════════════════════════════════
   TABLET BREAKPOINT (≥768px)
   ═══════════════════════════════════════════════════════════════ */

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

  .nav-link {
    padding: var(--space-xs) var(--space-md);
  }
}

/* ═══════════════════════════════════════════════════════════════
   DESKTOP BREAKPOINT (≥1024px)
   ═══════════════════════════════════════════════════════════════ */

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

/* ═══════════════════════════════════════════════════════════════
   PRINT STYLES
   ═══════════════════════════════════════════════════════════════ */

@media print {
  .site-header,
  .site-footer,
  .site-nav {
    display: none !important;
  }

  .site-main {
    padding: 0;
    max-width: none;
  }

  body {
    font-size: 12pt;
    line-height: 1.5;
  }

  a {
    color: #000;
  }
}
</style>
`;

// ═══════════════════════════════════════════════════════════════
//  GOOGLE FONTS - Customize or remove
// ═══════════════════════════════════════════════════════════════

const GOOGLE_FONTS = `
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
`;

// ═══════════════════════════════════════════════════════════════
//  THEME INITIALIZATION
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
//  HELPERS
// ═══════════════════════════════════════════════════════════════

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"');
}