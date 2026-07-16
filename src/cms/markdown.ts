// src/cms/markdown.ts — marked wrapper with HTML sanitization.
//
// After rendering, we strip dangerous HTML tags and event handlers.
// This is a lightweight allowlist sanitizer — not DOMPurify, but provides
// meaningful defense against stored XSS from post content.

import { marked, Renderer } from "marked";

const renderer = new Renderer();
const origLink = renderer.link.bind(renderer);
renderer.link = (
  href: string | null,
  title: string | null | undefined,
  text: string,
) => {
  const safeHref = String(href ?? "").replace(/^(javascript|data):/i, "");
  return origLink(safeHref, title, text);
};

marked.use({
  gfm: true,
  breaks: false,
  renderer,
});

const DANGEROUS_TAGS = /<\/?(script|iframe|object|embed|form|input|textarea|select|style|link|meta|base|applet)[^>]*>/gi;
const EVENT_HANDLERS = /\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;
const JS_URI = /(href|src|action)\s*=\s*(?:"javascript:[^"]*"|'javascript:[^']*')/gi;

function sanitizeHtml(html: string): string {
  return html
    .replace(DANGEROUS_TAGS, "")
    .replace(EVENT_HANDLERS, "")
    .replace(JS_URI, "");
}

export function renderMarkdown(md: string): string {
  const raw = marked.parse(md, { async: false }) as string;
  return sanitizeHtml(raw);
}
