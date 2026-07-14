// ── Example Theme ─────────────────────────────────────────────────
// Copy this file to create your own theme.
// Steps:
//   1. Copy this file to src/themes/my-theme.ts
//   2. Edit the id, name, css, and template overrides below
//   3. Add import './my-theme.js'; to src/themes/index.ts
//   4. Commit, push, deploy
//   5. Select it in Admin → Settings → Public Site Theme

import { registerTheme } from '../cms/theme.js';
import type { PostView, PostListItem } from '../cms/theme.js';

// ── CSS (required) ────────────────────────────────────────────────
// Override everything: colors, fonts, layout, spacing.
// Use CSS variables or plain values — your choice.

const css = `
:root {
  --bg: #f8fafc;
  --surface: #fff;
  --text: #1e293b;
  --accent: #3b82f6;
}
/* paste your full theme CSS here */
`;

// ── Template overrides (optional) ─────────────────────────────────
// Leave a function out to use the default template.
// Each function returns raw HTML for that part of the page.

function myShell(siteName: string, headMarkup: string, bodyHtml: string, nav: { label: string; url: string }[]): string {
  const navHtml = nav.map((n) => '<a href="' + n.url + '">' + n.label + '</a>').join('');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>${css}</style>
  ${headMarkup}
</head>
<body>
  <!-- Custom header / layout -->
  <header>
    <a href="/">${siteName}</a>
    <nav>${navHtml}<a href="/admin">Admin</a></nav>
  </header>
  <main>${bodyHtml}</main>
  <footer>My custom footer</footer>
</body>
</html>`;
}

function myPostCard(post: PostListItem, siteName: string): string {
  // Called for each post on the homepage list
  return '<article><h2><a href="/' + post.slug + '">' + post.title + '</a></h2></article>';
}

// ── Register ──────────────────────────────────────────────────────

registerTheme({
  id: 'my-custom-theme',     // unique ID (used in settings)
  name: 'My Custom Theme',   // display name in admin dropdown
  author: 'Your Name',
  description: 'A custom theme that overrides layout and colors.',
  version: '1.0.0',
  css,
  shell: myShell,            // <-- override the entire page shell
  renderPostList: (posts, sn) => posts.map((p) => myPostCard(p, sn)).join(''),
  // renderPost: (post) => ...,        // override single post view
  // renderHomepage: (sn) => ...,      // override empty homepage
});
