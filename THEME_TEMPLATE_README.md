# PHCloud Theme Template

**Starter template for building PHCloud CMS themes.**

Click **"Use this template"** → customize → publish your own theme.

---

## 🚀 Quick Start

```
1. Click "Use this template" (green button top right)
2. Name your repo: phcloud-your-theme-name
3. Clone your new repo
4. Edit src/themes/your-theme.ts
5. Add preview screenshots
6. Push → Share with PHCloud users
```

---

## 📁 What's Here

```
your-repo/
├── src/
│   └── themes/
│       └── your-theme.ts       ← Edit this file
├── preview/
│   ├── mobile.png              ← Add screenshot
│   ├── tablet.png              ← Add screenshot
│   └── desktop.png             ← Add screenshot
├── LICENSE                     ← Keep MIT (recommended)
└── README.md                   ← Customize this file
```

---

## 🎨 Customize Your Theme

### Step 1: Rename the Theme Function

```typescript
// In src/themes/your-theme.ts

// Change this:
export function initYourTheme(registry: CMSRegistry): void

// To this:
export function initModernBlue(registry: CMSRegistry): void
// or
export function initMinimal(registry: CMSRegistry): void
// or
export function initMagazine(registry: CMSRegistry): void
```

### Step 2: Update Metadata

```typescript
/**
 * PHCloud Theme: Modern Blue
 * @version 1.0.0
 * @author Your Name <your@email.com>
 * @category theme
 * @description A clean, professional theme with blue accents
 * @compatible PHCloud ^1.0.0
 * @license MIT
 * @repo https://github.com/yourname/phcloud-modern-blue
 */
```

### Step 3: Customize Colors

```typescript
const CSS_VARS = `
:root {
  --color-primary: #YOUR_COLOR;
  --color-secondary: #YOUR_COLOR;
  --color-background: #YOUR_COLOR;
  --color-text: #YOUR_COLOR;
}
`;
```

### Step 4: Add Your Fonts

```typescript
const FONTS = `
<link href="https://fonts.googleapis.com/css2?family=YOUR_FONT&display=swap" rel="stylesheet">
`;
```

### Step 5: Test Locally

```bash
# Copy to your PHCloud fork
cp src/themes/your-theme.ts ~/phcloud/src/themes/

# Run PHCloud locally
cd ~/phcloud
npm run dev

# Visit http://localhost:8787
# Check mobile, tablet, desktop views
```

---

## 📸 Add Preview Screenshots

Take screenshots of your theme:

```
preview/mobile.png    - 375px width (iPhone SE)
preview/tablet.png    - 768px width (iPad)
preview/desktop.png   - 1440px width (Desktop)
```

**How to capture:**
1. Run PHCloud locally with your theme
2. Open DevTools → Device Toolbar
3. Select device size
4. Take screenshot (DevTools → three dots → Capture screenshot)

---

## 📝 Customize README.md

Replace ALL placeholders in this README:

```markdown
# [Your Theme Name] for PHCloud CMS

[One sentence description]

## ✨ Features

- Feature 1 (e.g., Mobile-first responsive)
- Feature 2 (e.g., Dark mode support)
- Feature 3 (e.g., Custom color variables)

## 📦 Install

1. Download `src/themes/[your-theme].ts`
2. Copy to your PHCloud fork: `src/themes/[your-theme].ts`
3. Register in `src/plugins/index.ts` (see docs)
4. Enable in /admin/plugins

## 🎨 Customize

Edit CSS variables in the theme file:

```typescript
const CSS_VARS = `
:root {
  --color-primary: #CHANGE_ME;
}
`;
```

## 📱 Preview

![Mobile](preview/mobile.png)
![Desktop](preview/desktop.png)

## 📄 License

MIT License - use freely
```

---

## ✅ Before Publishing

```
□ Theme works with no errors
□ Mobile responsive (tested on real device or simulator)
□ Touch targets ≥44px
□ Text readable (≥16px base)
□ Screenshots added to preview/
□ README customized (no [placeholders] left)
□ LICENSE included
□ GitHub topics added (see below)
```

---

## 🏷 Add GitHub Topics

In your repo → Settings → Tags → Topics:

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
git commit -m "Initial release: [Theme Name]"

# Push to GitHub
git remote add origin git@github.com:YOUR_NAME/phcloud-[theme-name].git
git push -u origin main
```

---

## 🔗 Submit to PHCloud Theme Gallery

Open a PR to add your theme to the official list:

github.com/steve/phcloud → THEMES.md

```markdown
| [Your Theme] | [Preview](link) | [Download](link) | @yourname |
```

---

## 🎯 Theme Ideas

Stuck on what to build?

| Idea | Use Case |
|------|----------|
| Modern Blue | Corporate, SaaS, professional |
| Minimal | Bloggers, writers, newsletters |
| Magazine | News, multi-author blogs |
| Portfolio | Designers, photographers |
| Shop | Ecommerce, products |
| Local | Restaurants, salons, contractors |
| Startup | Landing pages, MVPs |

---

## 📚 Resources

- [PHCloud Theme Guide](https://github.com/steve/phcloud/blob/main/THEME_STARTER.md)
- [PHCloud Plugin Guide](https://github.com/steve/phcloud/blob/main/PLUGIN_DEV.md)
- [Mobile First Design](https://web.dev/learn/design/mobile-first)
- [WCAG Accessibility](https://www.w3.org/WAI/WCAG21/quickref/)
- [Google Fonts](https://fonts.google.com)

---

## 📄 License

**MIT License** — Build something awesome.

Feel free to change this if you want different licensing.

---

**Created for PHCloud CMS — The world's lightest CMS**