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

export function shellFull(
  siteName: string,
  headMarkup: string,
  bodyHtml: string,
  nav: NavItem[],
): string {
  const navHtml = nav
    .map((n) => '<a href="' + esc(n.url) + '">' + esc(n.label) + "</a>")
    .join("");
  const adminLink = '<a href="/admin/login" style="color:#f97316">Admin</a>';
  return (
    '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>' +
    esc(siteName) +
    '</title><link rel="sitemap" type="application/xml" href="/sitemap.xml" /><link rel="alternate" type="application/rss+xml" title="' +
    esc(siteName) +
    '" href="/feed.xml" /><style>' +
    THEME_CSS +
    "</style>" +
    headMarkup +
    '</head><body><a href="#main" class="sr-only" style="position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);border:0">Skip to content</a><header><div class="inner"><a href="/" class="site-name">' +
    esc(siteName) +
    '</a><nav>' +
    navHtml +
    adminLink +
    "</nav></div></header><main id=\"main\">" +
    bodyHtml +
    "</main><footer>Powered by PHCloud CMS on Cloudflare Workers</footer></body></html>"
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
    "<h1>" +
    esc(post.title) +
    '</h1><div style="color:#64748b;font-size:0.85rem;margin-bottom:2rem;">' +
    date +
    '</div><div style="line-height:1.8;">' +
    sanitizePostHtml(post.content) +
    "</div>"
  );
}

export function renderHomepage(siteName: string): string {
  return (
    "<h1>" +
    esc(siteName) +
    '</h1><p style="color:#64748b;margin-bottom:2rem;">Welcome. Content served from Cloudflare D1.</p><p style="color:#64748b;"><a href="/admin/login">Log in</a> to manage your site.</p>'
  );
}

export function renderPostList(
  posts: { slug: string; title: string; excerpt: string; updated_at: string }[],
  siteName: string,
): string {
  if (!posts.length) return renderHomepage(siteName);
  let html =
    '<h1 style="margin-bottom:2rem">' +
    esc(siteName) +
    '</h1><div style="display:flex;flex-direction:column;gap:1.5rem">';
  for (const p of posts) {
    const date = new Date(p.updated_at).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    html +=
      '<article style="border-bottom:1px solid #e5e7eb;padding-bottom:1.5rem">';
    html +=
      '<h2 style="font-size:1.15rem;margin-bottom:0.3rem"><a href="/' +
      esc(p.slug) +
      '" style="color:#0f172a;text-decoration:none">' +
      esc(p.title) +
      "</a></h2>";
    html +=
      '<div style="color:#94a3b8;font-size:0.8rem;margin-bottom:0.5rem">' +
      date +
      "</div>";
    if (p.excerpt)
      html +=
        '<p style="color:#64748b;line-height:1.6">' + esc(p.excerpt) + "</p>";
    html +=
      '<a href="/' +
      esc(p.slug) +
      '" style="color:#3b82f6;font-size:0.85rem;text-decoration:none">Read more →</a>';
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
    '<nav style="display:flex;justify-content:center;gap:0.5rem;margin-top:2rem;align-items:center">';
  if (page > 1)
    html +=
      '<a href="' +
      esc(buildUrl(page - 1)) +
      '" style="padding:0.4rem 0.8rem;border:1px solid #e5e7eb;border-radius:4px;text-decoration:none;color:#3b82f6">← Prev</a>';
  const startPage = Math.max(1, page - 2);
  const endPage = Math.min(totalPages, page + 2);
  if (startPage > 1) html += '<span style="color:#94a3b8">…</span>';
  for (let i = startPage; i <= endPage; i++) {
    if (i === page) {
      html +=
        '<span style="padding:0.4rem 0.8rem;background:#0f172a;color:white;border-radius:4px;font-weight:600">' +
        i +
        "</span>";
    } else {
      html +=
        '<a href="' +
        esc(buildUrl(i)) +
        '" style="padding:0.4rem 0.8rem;border:1px solid #e5e7eb;border-radius:4px;text-decoration:none;color:#3b82f6">' +
        i +
        "</a>";
    }
  }
  if (endPage < totalPages) html += '<span style="color:#94a3b8">…</span>';
  if (page < totalPages)
    html +=
      '<a href="' +
      esc(buildUrl(page + 1)) +
      '" style="padding:0.4rem 0.8rem;border:1px solid #e5e7eb;border-radius:4px;text-decoration:none;color:#3b82f6">Next →</a>';
  html += "</nav>";
  return html;
}

// ── Helpers ────────────────────────────────────────────────────────
// OG / twitter card image: first <img src> of a post. Content is stored as
// sanitized HTML (see sanitize.ts); the sanitizer always emits double-quoted
// src. We return an absolute URL: absolute http(s) as-is, relative (/img/:id)
// with origin prefixed — anything else (data:, etc.) yields no card image.
export function extractFirstImage(content: string, origin: string): string | null {
  const match = content.match(/<img\s[^>]*?src="([^"]*)"/i);
  if (!match) return null;
  const src = match[1];
  if (/^https?:\/\//i.test(src)) return src;
  if (src.startsWith("/")) return origin + src;
  return null;
}
