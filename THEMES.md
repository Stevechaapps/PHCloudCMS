# PHCloud Theme Gallery

Official curated themes for PHCloud CMS. All themes are **mobile-first**, **touch-friendly**, and **dark-mode ready**.

---

## 🎨 Official Themes

| Theme | Preview | Download | Author |
|-------|---------|----------|--------|
| **Default** | [Preview](#) | [Download](https://github.com/steve/phcloud/blob/main/src/themes/default.ts) | @steve |
| **Modern Blue** | [Preview](#) | [Download](https://github.com/steve/phcloud/blob/main/your-theme.ts) | PHCloud Team |
| **Minimal** | [Preview](#) | Coming soon | — |
| **Magazine** | [Preview](#) | Coming soon | — |

---

## 🌟 Community Themes

| Theme | Preview | Download | Author |
|-------|---------|----------|--------|
| — | — | — | — |

*Want your theme listed? [Submit a PR](https://github.com/steve/phcloud/pulls) adding your theme to this table.*

---

## 📥 How to Install a Theme

Themes work exactly like plugins — they're TypeScript files you copy into your PHCloud fork:

```bash
# 1. Download the theme .ts file
# 2. Copy to your PHCloud fork:
cp your-theme.ts ~/my-phcloud-site/src/themes/

# 3. Register in src/plugins/index.ts:
import { initYourTheme } from './themes/your-theme.js';
initYourTheme(registry);

# 4. Commit + push
git add src/plugins/
git commit -m "Add Your Theme"
git push

# 5. Enable in PHCloud admin: /admin/plugins
```

---

## 🎨 Build Your Own Theme

Use our **Theme Template** to create and share your own theme:

1. **Fork the template**: [github.com/steve/phcloud-theme-starter](https://github.com/steve/phcloud-theme-starter)
2. **Customize colors, fonts, layout** in `src/themes/your-theme.ts`
3. **Add screenshots** to `preview/` folder
4. **Publish** on your GitHub
5. **Submit** to this gallery via PR

📖 **Full guide:** [`THEME_STARTER.md`](./THEME_STARTER.md)

---

## 🏷 Theme Categories

Themes are tagged by use case:

| Category | Use Case | Example Themes |
|----------|----------|----------------|
| **Modern** | Corporate, SaaS, professional sites | Modern Blue |
| **Minimal** | Bloggers, writers, newsletters | Minimal (coming) |
| **Magazine** | News sites, multi-author blogs | Magazine (coming) |
| **Portfolio** | Designers, photographers, creatives | — |
| **Shop** | Ecommerce, product catalogs | — |
| **Startup** | Landing pages, MVP launches | — |
| **Local** | Restaurants, salons, contractors | — |

---

## ✅ Theme Requirements

All themes in this gallery must:

```
□ Mobile-first responsive (mobile → 768px → 1024px)
□ Touch targets ≥44px
□ Text readable (≥16px base)
□ Dark mode support (prefers-color-scheme)
□ WCAG 2.1 AA accessible (contrast, keyboard nav)
□ Tested on iPhone + Android + Desktop
□ Screenshots provided (mobile, tablet, desktop)
□ MIT License
□ GitHub Topics: phcloud-theme, phcloud, cms
```

---

## 🎨 Theme Development Resources

- [Theme Starter Template](https://github.com/steve/phcloud-theme-starter)
- [Theme Developer Guide](./THEME_STARTER.md)
- [Plugin Developer Guide](./PLUGIN_DEV.md)
- [Mobile First Design](https://web.dev/learn/design/mobile-first)
- [WCAG Accessibility](https://www.w3.org/WAI/WCAG21/quickref/)
- [Google Fonts](https://fonts.google.com)

---

**PHCloud CMS** — The world's lightest CMS.

Made with ☁️ on Cloudflare Workers.