# Developing Themes for PHCloud CMS

A theme controls every pixel of your public site — colors, fonts, layout, navigation, cards, footer. Themes are TypeScript files in `src/themes/` that register CSS and optional HTML template overrides.

---

## Table of Contents

- [Quick Start](#quick-start)
- [Theme Anatomy](#theme-anatomy)
  - [CSS](#css)
  - [shell — Full Page Wrapper](#shell--full-page-wrapper)
  - [renderPost — Single Post View](#renderpost--single-post-view)
  - [renderPostList — Homepage Listing](#renderpostlist--homepage-listing)
  - [renderHomepage — Empty State](#renderhomepage--empty-state)
- [Template Function Signatures](#template-function-signatures)
- [The Default HTML Structure](#the-default-html-structure)
- [CSS Variables Used by Default Templates](#css-variables-used-by-default-templates)
- [Distributing a Theme](#distributing-a-theme)
- [Theme Best Practices](#theme-best-practices)
- [Example: Overriding the Shell](#example-overriding-the-shell)
- [Example: Custom Post Card Design](#example-custom-post-card-design)
- [Example: Adding a Sidebar](#example-adding-a-sidebar)

---

## Quick Start

```
cp src/themes/example.ts src/themes/my-theme.ts
```

1. Edit `src/themes/my-theme.ts` — change the CSS and template functions
2. Add `import './my-theme.js';` to `src/themes/index.ts`
3. Run `npm run dev` to preview locally
4. Commit and push — Workers Builds deploys automatically
5. Select your theme in **Admin → Settings → Public Site Theme**

---

## Theme Anatomy

A theme is registered by calling `registerTheme()` with an object:

```typescript
import { registerTheme } from '../cms/theme.js';

registerTheme({
  id: 'my-theme',        // unique, no spaces
  name: 'My Theme',      // shown in admin dropdown
  author: 'Your Name',
  description: 'What it does',
  version: '1.0.0',
  css: `...`,             // required — injected in <style>
  shell: myShell,         // optional — full page HTML
  renderPost: myPostView, // optional — single post
  renderPostList: myList, // optional — homepage list
  renderHomepage: myHome, // optional — empty state
});
```

Every field except `css` and the identity fields (`id`, `name`, `author`, `description`, `version`) is optional. Leave out any template function to use the default.

### CSS

The `css` string is injected verbatim into the public site's `<style>` tag. It receives no scoping — write global CSS.

**Must provide CSS for at least:**

| Selector | Purpose |
|----------|---------|
| `body` | font family, background, text color, line height |
| `a` | link color, hover |
| `header` | sticky header background, border, shadow |
| `header .inner` | max-width, centering, layout |
| `header .site-name` | site title styling |
| `header nav` | nav layout, gap |
| `header nav a` | nav link color, hover |
| `main` | max-width, margin, padding, min-height |
| `footer` | text color, border, spacing |
| `h1`, `h2`, `h3` | heading sizes, weights |
| `.post-card` | post list card (border, radius, padding, shadow, hover) |
| `.post-card h2` | card title size |
| `.post-card h2 a` | card title link |
| `.post-card .meta` | date styling |
| `.post-card .excerpt` | excerpt color, line-height |
| `.post-card .read-more` | "Read more" link |
| `.post-content` | post body (line-height, font-size, color) |
| `.post-content p` | paragraph spacing |
| `.post-content img` | image max-width, radius, margin |
| `.post-content code` | inline code background |
| `.post-content pre` | code block background, padding |
| `.post-content blockquote` | blockquote accent border, padding, background |
| `.post-content ul`, `.post-content ol` | list padding, color |
| `.post-meta` | post metadata (date, categories) |
| `.back-link` | "Back to home" link |
| `.site-title` | homepage title centering |
| `.search-form input` | search input styling |
| `.category-pill` | category badges |
| Responsive breakpoints for mobile |

The **easiest approach**: copy the default theme's CSS and change the values. See `src/themes/default.ts`.

### shell — Full Page Wrapper

```typescript
shell?: (siteName: string, headMarkup: string, bodyHtml: string, nav: { label: string; url: string }[]) => string
```

Returns the full `<!DOCTYPE html>` page. You control everything: doctype, `<html>`, `<head>`, `<body>`, header, nav, main slot, footer.

**Must include:**
- `<meta charset="utf-8" />`
- `<meta name="viewport" content="width=device-width, initial-scale=1" />`
- `<style>${css}</style>` — inject the theme's CSS
- `${headMarkup}` — plugin-injected head content (SEO meta tags, RSS link, etc.)
- `${bodyHtml}` — the main content slot
- Admin link somewhere (usually in nav or footer)

**Parameters:**
- `siteName` — the configured site name (already escaped)
- `headMarkup` — HTML to inject in `<head>` (from plugins, RSS link, etc.)
- `bodyHtml` — the rendered page content (post list, single post, search results, etc.)
- `nav` — array of `{ label, url }` from the Navigation settings in admin

### renderPost — Single Post View

```typescript
renderPost?: (post: PostView) => string
```

Wraps a single post. Default output:

```html
<h1>Post Title</h1>
<div class="post-meta">July 14, 2026</div>
<div class="post-content">...rendered markdown...</div>
```

**`PostView` fields:**
| Field | Type | Always present? |
|-------|------|----------------|
| `title` | `string` | yes |
| `content` | `string` | yes |
| `excerpt` | `string \| undefined` | no |
| `slug` | `string \| undefined` | no (included for reference) |
| `updated_at` | `string` | yes (ISO 8601) |

Note: content is raw Markdown, pass it through `markdownToHtml()` if you render it yourself.

### renderPostList — Homepage Listing

```typescript
renderPostList?: (posts: PostListItem[], siteName: string) => string
```

Renders the list of post cards on the homepage. Called with all published posts of `type = 'post'`.

**`PostListItem` fields:**
| Field | Type | Description |
|-------|------|-------------|
| `slug` | `string` | URL segment |
| `title` | `string` | Post title |
| `excerpt` | `string` | Short description |
| `updated_at` | `string` | ISO 8601 date |

If there are no posts, this function is NOT called — `renderHomepage` is used instead.

### renderHomepage — Empty State

```typescript
renderHomepage?: (siteName: string) => string
```

Shown when there are zero published posts. Default shows the site name and a "Log in to manage" message.

---

## Template Function Signatures

```typescript
import type { PostView, PostListItem } from '../cms/theme.js';

shell(siteName: string, headMarkup: string, bodyHtml: string, nav: { label: string; url: string }[]): string
renderPost(post: PostView): string
renderPostList(posts: PostListItem[], siteName: string): string
renderHomepage(siteName: string): string
```

---

## The Default HTML Structure

If you override `shell`, match this structure for consistent plugin injection:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>/* theme CSS */</style>
  <!-- headMarkup (SEO meta, RSS link, etc.) -->
</head>
<body>
  <header>
    <div class="inner">
      <a href="/" class="site-name">Site Name</a>
      <nav><!-- nav links + Admin --></nav>
    </div>
  </header>
  <main>
    <!-- bodyHtml (post list, single post, search, etc.) -->
  </main>
  <footer><!-- links + credits --></footer>
</body>
</html>
```

The default `renderPost` output:

```html
<h1>Post Title</h1>
<div class="post-meta">July 14, 2026</div>
<div class="post-content"><!-- rendered Markdown --></div>
```

The default `renderPostList` output:

```html
<div class="site-title"><h1>Site Name</h1></div>
<div class="post-list">
  <article class="post-card">
    <h2><a href="/post-slug">Post Title</a></h2>
    <div class="meta">July 14, 2026</div>
    <p class="excerpt">Post excerpt...</p>
    <a href="/post-slug" class="read-more">Read more →</a>
  </article>
  <!-- more posts... -->
</div>
```

---

## CSS Variables Used by Default Templates

The default theme relies on these CSS custom properties. Override them in your CSS:

| Variable | Default | Purpose |
|----------|---------|---------|
| `--bg` | `#f8fafc` | Page background |
| `--surface` | `#fff` | Card/surface background |
| `--text` | `#1e293b` | Body text color |
| `--text-light` | `#64748b` | Muted text |
| `--text-muted` | `#94a3b8` | Very muted text (dates, footer) |
| `--accent` | `#f97316` | Link/accent color (orange) |
| `--accent-hover` | `#ea580c` | Link hover |
| `--border` | `#e2e8f0` | Borders, dividers |
| `--radius` | `8px` | Border radius |
| `--font` | system-ui stack | Body font |
| `--font-mono` | JetBrains Mono / Fira Code | Code font |
| `--shadow` | subtle | Card shadow |
| `--shadow-lg` | larger | Card hover shadow |

You don't have to use these — they're a convenience. Write plain CSS if you prefer.

---

## Distributing a Theme

Themes follow the same GitHub-based model as plugins:

1. Create a fork of the PHCloud repo (or a standalone GitHub repo)
2. Develop your theme in `src/themes/` and register it in `src/themes/index.ts`
3. Document the theme in your repo's README — include a screenshot
4. Users copy your `.ts` file into their own fork's `src/themes/` directory and add the import to `src/themes/index.ts`

That's it. No package manager, no registry, no build step.

---

## Theme Best Practices

1. **Start from example.ts** — it has every template function stubbed with comments
2. **Use CSS variables for colors** — makes it easy for downstream users to tweak
3. **Keep the `<header>`/`<main>`/`<footer>` structure** — plugins assume content lives in `<main>`
4. **Always include an admin link** — users need to reach the admin panel
5. **Test empty states** — what does your theme look like with zero posts?
6. **Match the default class names** if you only override `css` — the default templates output `.post-card`, `.post-content`, `.post-meta`, `.back-link`, `.site-title`, `.search-form`, `.category-pill`, `.post-list` classes
7. **Escape user content** — use `s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')` on any title, excerpt, or nav label you render
8. **Responsive** — add `@media(max-width:600px)` breakpoints for mobile

---

## Example: Overriding the Shell

This shell override changes the layout to a centered single-column with a different nav position:

```typescript
function myShell(siteName: string, headMarkup: string, bodyHtml: string, nav: { label: string; url: string }[]): string {
  const navLinks = nav.map((n) =>
    '<a href="' + n.url.replace(/&/g, '&amp;') + '">' + n.label.replace(/&/g, '&amp;') + '</a>'
  ).join('');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>${css}</style>
  ${headMarkup}
</head>
<body>
  <nav style="text-align:center;padding:1rem;background:#0f172a;color:white">
    ${navLinks} · <a href="/admin" style="color:#f97316">Admin</a>
  </nav>
  <header style="text-align:center;padding:2rem 1rem 0">
    <h1 style="font-size:1.5rem;margin:0"><a href="/" style="color:inherit;text-decoration:none">${siteName}</a></h1>
  </header>
  <main style="max-width:680px;margin:2rem auto;padding:0 1.5rem">${bodyHtml}</main>
  <footer style="text-align:center;padding:2rem;color:#94a3b8;font-size:0.8rem">
    <a href="/admin">Admin</a> · <a href="/sitemap.xml">Sitemap</a> · Powered by ${siteName}
  </footer>
</body>
</html>`;
}
```

---

## Example: Custom Post Card Design

This override renders homepage posts as a horizontal card with a large date:

```typescript
function myPostList(posts: PostListItem[], siteName: string): string {
  return `<h1 style="margin-bottom:2rem">${siteName}</h1>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem">
  ${posts.map((p) => {
    const date = new Date(p.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `<article style="background:white;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
      <div style="padding:1.25rem">
        <div style="font-size:0.75rem;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em">${date}</div>
        <h2 style="font-size:1.1rem;margin:0.5rem 0"><a href="/${p.slug}" style="color:#1e293b;text-decoration:none">${p.title}</a></h2>
        ${p.excerpt ? '<p style="color:#64748b;font-size:0.9rem;line-height:1.5">' + p.excerpt + '</p>' : ''}
        <a href="/${p.slug}" style="color:#f97316;font-size:0.85rem;font-weight:500">Read →</a>
      </div>
    </article>`;
  }).join('')}
</div>`;
}
```

---

## Example: Adding a Sidebar

Override `shell` to include a sidebar layout:

```typescript
function sidebarShell(siteName: string, headMarkup: string, bodyHtml: string, nav: { label: string; url: string }[]): string {
  const navLinks = nav.map((n) =>
    '<a href="' + n.url.replace(/&/g, '&amp;') + '" style="display:block;padding:0.4rem 0;color:#64748b">' + n.label.replace(/&/g, '&amp;') + '</a>'
  ).join('');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>${css}</style>
  ${headMarkup}
</head>
<body>
  <header style="border-bottom:1px solid #e2e8f0;padding:1rem 2rem">
    <a href="/" style="font-weight:700;color:#1e293b;text-decoration:none">${siteName}</a>
  </header>
  <div style="display:grid;grid-template-columns:220px 1fr;max-width:960px;margin:0 auto">
    <aside style="padding:2rem 1.5rem;border-right:1px solid #e2e8f0">
      ${navLinks}
      <a href="/admin" style="display:block;padding:0.4rem 0;color:#f97316">Admin</a>
    </aside>
    <main style="padding:2rem">${bodyHtml}</main>
  </div>
  <footer style="text-align:center;padding:2rem;color:#94a3b8;font-size:0.8rem;border-top:1px solid #e2e8f0">
    Powered by PHCloud CMS on Cloudflare Workers
  </footer>
</body>
</html>`;
}
```

---

For more examples, see `src/themes/example.ts` in the repo.
