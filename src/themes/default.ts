// src/themes/default.ts — Functional visual layout
// Renders the full public-facing HTML shell. Used by all non-admin responses.

import type { PluginHook, CMSRegistry } from '../cms/registry.js';

export type ThemeRenderPayload = {
  siteName: string;
  title: string;
  content: string;
  meta: Record<string, string>;
  postHtml?: string;
};

export function applyDefaultTheme(registry: CMSRegistry, payload: ThemeRenderPayload): Promise<Record<string, unknown>> {
  return registry.executePipeline('render:head', payload);
}

export function renderDefaultShell(p: ThemeRenderPayload, postHtml?: string): string {
  const headPayload = { siteName: p.siteName, title: p.title, markup: '', meta: p.meta };
  // We don't have registry access here — meta is injected by the caller via the pipeline
  // This renders the body shell only; <head> comes from the pipeline result.
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <!-- head pipeline result injected by caller -->
    <body>
      <header style="border-bottom:1px solid #e5e7eb;padding:1.25rem 2rem;">
        <a href="/" style="font-weight:700;font-size:1.1rem;color:#0f172a;text-decoration:none;">${escapeHtml(p.siteName)}</a>
      </header>
      <main style="max-width:720px;margin:2rem auto;padding:0 1.5rem;">
        ${postHtml ?? `<h1>${escapeHtml(p.title)}</h1><div style="line-height:1.7">${p.content}</div>`}
      </main>
      <footer style="text-align:center;padding:2rem;color:#94a3b8;font-size:0.8rem;">
        Powered by EdgeCMS on Cloudflare Pages
      </footer>
    </body>
    </html>
  `;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
