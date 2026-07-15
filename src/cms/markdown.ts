// src/cms/markdown.ts — marked wrapper with link href sanitization.
//
// Sanitization strategy: marked v4+ does NOT sanitize HTML by default (DOMPurify
// is the upstream-recommended approach, ~20KB). For a single-admin CMS where the
// only person writing markdown is the admin themselves (auth on every write
// endpoint), raw marked output is acceptable — XSS risk is limited to admin
// self-XSS. We DO sanitize link hrefs to strip `javascript:` and `data:` URLs,
// which is the same protection the old hand-rolled parser had.

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

export function renderMarkdown(md: string): string {
  return marked.parse(md, { async: false }) as string;
}
