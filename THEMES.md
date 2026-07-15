# Theming PHCloud CMS

PHCloud CMS uses a single static theme file: `src/themes/default.ts`. Unlike traditional CMS theme systems, there is no runtime theme registry or theme switcher — you reskin by editing the source file.

---

## Theme Structure

```typescript
export const layout = 'centered'; // 'centered' | 'sidebar-left' | 'wide'
export const css = `...`;
```

- **`layout`** — selects the page layout preset. Currently only `centered` is implemented.
- **`css`** — all styles for the public site, minified in a single string.

## Light & Dark Mode

The CSS includes a `@media (prefers-color-scheme: dark)` block that overrides the CSS custom properties on `:root`. This means dark mode is automatic based on the user's OS preference — no toggle needed.

## CSS Custom Properties

All colors and spacing use CSS custom properties on `:root`. To reskin, override these:

```css
--bg            /* Page background */
--surface       /* Card/component background */
--text          /* Primary text */
--text-light    /* Body text */
--text-muted    /* Secondary/meta text */
--accent        /* Links and highlights (orange by default) */
--accent-hover  /* Link hover state */
--border        /* Border color */
```

## How to Reskin

1. Fork the repository
2. Edit `src/themes/default.ts` — change the palette colors in `:root` and `@media (prefers-color-scheme: dark)`
3. Commit and push — Cloudflare auto-deploys
4. Your site updates immediately

To swap to a completely different theme file:

1. Copy another theme file into `src/themes/your-theme.ts`
2. In `src/index.ts`, change `import { css as themeCss } from './themes/default.js'` to `import { css as themeCss } from './themes/your-theme.js'`
3. Commit and push

## Distributing a Theme

Share your `src/themes/your-theme.ts` file via GitHub. Anyone can download it, drop it into their fork, and update the import in `src/index.ts`.
