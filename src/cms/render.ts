// src/cms/render.ts — public-site render helpers + shared content types.
// Everything that turns D1 rows into public HTML lives here, so index.ts
// and the route modules stay small. Post/page content is authored as HTML
// (contentEditable editor), sanitized on WRITE via src/cms/sanitize.ts, and
// emitted here on READ. We re-sanitize on read as defense-in-depth (idempotent
// on already-clean stored HTML) so the snapshot this code reads is never worse
// than the write path produced.

import { esc } from "./escape.js";
import { sanitizePostHtml, htmlToText } from "./sanitize.js";
import { css as themeCss } from "../themes/default.js";

// ── Shared types ───────────────────────────────────────────────────
export type NavItem = { label: string; url: string };
export type Post = { title: string; content: string; updated_at: string };
export type DbPost = Post & {
  id: number;
  slug: string;
  excerpt: string;
  published: number;
  type: string;
  publish_at: string | null;
  preview_token: string | null;
};

// ── Excerpt ────────────────────────────────────────────────────────
// Plain-text preview of a post. `content` is stored sanitized HTML; strip
// its tags (and raw-text/script content), decode entities, and collapse
// whitespace to a single line. Caller escapes the result.
export function autoExcerpt(content: string): string {
  const text = htmlToText(content);
  return text.slice(0, 160) + (text.length > 160 ? "…" : "");
}

// ── Public page shell ──────────────────────────────────────────────
const THEME_CSS = themeCss;

// Light/dark toggle. The public site adapts to the OS color scheme via a
// @media(prefers-color-scheme:dark) block in the theme CSS, AND offers a
// manual override stored in localStorage('phcloud-theme'). THEME_INIT_SCRIPT
// runs in <head> before paint so there's no flash of the wrong theme; the
// attribute it sets (html[data-theme="dark"|"light"]) is what the theme CSS
// selectors key off of. THEME_TOGGLE_SCRIPT (end of <body>) wires the button,
// keeps its glyph/aria in sync, and persists the choice.
export const THEME_INIT_SCRIPT = `<script>(function(){try{var t=localStorage.getItem('phcloud-theme');if(t==='dark'){document.documentElement.setAttribute('data-theme','dark')}else if(t==='light'){document.documentElement.setAttribute('data-theme','light')}}catch(e){}})();</script>`;

export const THEME_TOGGLE_BTN =
  '<button type="button" class="theme-toggle" id="theme-toggle" aria-label="Toggle color theme" aria-pressed="false">☾</button>';

export const THEME_TOGGLE_SCRIPT = `<script>(function(){var d=document.documentElement,b=document.getElementById('theme-toggle');if(!b)return;function dark(){var t=d.getAttribute('data-theme');if(t==='dark')return true;if(t==='light')return false;return !!(window.matchMedia&&window.matchMedia('(prefers-color-scheme:dark)').matches)}function render(){var on=dark();b.setAttribute('aria-pressed',on?'true':'false');b.setAttribute('aria-label',on?'Switch to light mode':'Switch to dark mode');b.textContent=on?'☀':'☾'}render();if(window.matchMedia){try{window.matchMedia('(prefers-color-scheme:dark)').addEventListener('change',render)}catch(e){}}b.addEventListener('click',function(){var next=dark()?'light':'dark';d.setAttribute('data-theme',next);try{localStorage.setItem('phcloud-theme',next)}catch(e){}render()})})();</script>`;

export function shellFull(
  siteName: string,
  headMarkup: string,
  bodyHtml: string,
  nav: NavItem[],
  siteLogo: string | null = null,
): string {
  const navHtml = nav
    .map((n) => '<a href="' + esc(n.url) + '">' + esc(n.label) + "</a>")
    .join("");

  return (
    '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>' +
    esc(siteName) +
    '</title><link rel="sitemap" type="application/xml" href="/sitemap.xml" /><link rel="alternate" type="application/rss+xml" title="' +
    esc(siteName) +
    '" href="/feed.xml" /><style>' +
    THEME_CSS +
    "</style>" +
    headMarkup +
    THEME_INIT_SCRIPT +
    '</head><body><a href="#main" class="sr-only" style="position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);border:0">Skip to content</a><header><div class="inner"><a href="/" class="site-name">' +
    (siteLogo
      ? '<img src="' + esc(siteLogo) + '" alt="' + esc(siteName) + '" style="height:32px;width:auto;vertical-align:middle;max-width:180px"/>'
      : esc(siteName)) +
    '</a><nav><form action="/search" method="get" class="search-wrap" role="search"><input type="text" name="q" placeholder="Search..." aria-label="Search site"></form>' +
    navHtml +
    // Toggle is a sibling of <nav>, not inside it: the mobile CSS hides
    // header nav (display:none under 768px) to save space, so a toggle
    // inside the nav would vanish on phones. As a direct child of .inner
    // it stays reachable; .inner's space-between gives logo-left /
    // nav-center / toggle-right on desktop.
    "</nav>" +
    THEME_TOGGLE_BTN +
    '</div></header><main id="main">' +
    bodyHtml +
    '</main><footer><div class="inner"><p class="colophon">Powered by <a href="https://github.com/Stevechaapps/phcloudcms" target="_blank" rel="noopener">PHCloud CMS</a> on <a href="https://cloudflare.com" target="_blank" rel="noopener">Cloudflare</a> · <a href="/admin" rel="nofollow">Manage</a></p></div></footer>' +
    THEME_TOGGLE_SCRIPT +
    '</body></html>'
  );
}

// ── Post + list rendering ──────────────────────────────────────────
export function renderPost(post: Post): string {
  const date = new Date(post.updated_at).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  return (
    "<h1 style=\"margin-bottom:0.5rem\">" +
    esc(post.title) +
    '</h1><div style="color:var(--text-muted);font-size:0.9rem;margin-bottom:2.5rem;font-variant-numeric:tabular-nums">' +
    date +
    '</div><div class="post-content">' +
    sanitizePostHtml(post.content) +
    "</div>"
  );
}

export function renderHomepage(siteName: string): string {
  return (
    '<div class="site-title"><h1>' +
    esc(siteName) +
    '</h1><p>Welcome to my digital garden. Explore posts, thoughts, and guides below.</p></div>'
  );
}

export function renderPostList(
  posts: { slug: string; title: string; excerpt: string; updated_at: string }[],
  siteName: string,
): string {
  if (!posts.length) return renderHomepage(siteName);
  let html =
    '<div class="post-list">';
  for (const p of posts) {
    const date = new Date(p.updated_at).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    html +=
      '<article class="post-card">';
    html +=
      '<div class="meta">' + date + '</div>';
    html +=
      '<h2><a href="/' +
      esc(p.slug) +
      '">' +
      esc(p.title) +
      '</a></h2>';
    if (p.excerpt)
      html +=
        '<div class="excerpt">' +
        esc(p.excerpt) +
        '</div>';
    html +=
      '<a href="/' +
      esc(p.slug) +
      '" class="read-more">Read more →</a>';
    html += "</article>";
  }
  html += "</div>";
  return html;
}

export function renderPagination(
  page: number,
  totalPages: number,
  basePath: string,
  additionalParams: Record<string, string>,
): string {
  if (totalPages <= 1) return "";
  const buildUrl = (p: number): string => {
    const params = new URLSearchParams(additionalParams);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return basePath + (qs ? "?" + qs : "");
  };
  let html =
    '<nav style="display:flex;justify-content:center;gap:0.5rem;margin-top:3rem;align-items:center">';
  if (page > 1)
    html +=
      '<a href="' +
      esc(buildUrl(page - 1)) +
      '" style="padding:0.4rem 0.8rem;border:1px solid var(--border);border-radius:6px;text-decoration:none;color:var(--accent)">← Prev</a>';
  const startPage = Math.max(1, page - 2);
  const endPage = Math.min(totalPages, page + 2);
  if (startPage > 1) html += '<span style="color:var(--text-muted)">…</span>';
  for (let i = startPage; i <= endPage; i++) {
    if (i === page) {
      html +=
        '<span style="padding:0.4rem 0.8rem;background:var(--accent);color:#fff;border-radius:6px;font-weight:600">' +
        i +
        "</span>";
    } else {
      html +=
        '<a href="' +
        esc(buildUrl(i)) +
        '" style="padding:0.4rem 0.8rem;border:1px solid var(--border);border-radius:6px;text-decoration:none;color:var(--accent)">' +
        i +
        "</a>";
    }
  }
  if (endPage < totalPages)
    html += '<span style="color:var(--text-muted)">…</span>';
  if (page < totalPages)
    html +=
      '<a href="' +
      esc(buildUrl(page + 1)) +
      '" style="padding:0.4rem 0.8rem;border:1px solid var(--border);border-radius:6px;text-decoration:none;color:var(--accent)">Next →</a>';
  html += "</nav>";
  return html;
}

// ── Helpers ────────────────────────────────────────────────────────
// OG / twitter card image: first <img src> of a post. Content is stored as
// sanitized HTML (see sanitize.ts); the sanitizer always emits double-quoted
// src. We return an absolute URL: absolute http(s) as-is, relative (/img/:id)
// with origin prefixed — anything else (data:, etc.) yields no card image.
export function extractFirstImage(
  content: string,
  origin: string,
): string | null {
  const match = content.match(/<img\s[^>]*?src="([^"]*)"/i);
  if (!match) return null;
  const src = match[1];
  if (/^https?:\/\//i.test(src)) return src;
  if (src.startsWith("/")) return origin + src;
  return null;
}
