// src/plugins/sitemap.ts — Auto-generating XML sitemap module
// Hooks into the render:sitemap pipeline. Generates a standards-compliant XML sitemap.

import type { PluginHook, CMSRegistry } from '../cms/registry.js';

export function initSitemapPlugin(registry: CMSRegistry): void {
  registry.register('render:sitemap', sitemapHook);
}

const sitemapHook: PluginHook = (payload) => {
  const posts = (payload.posts as Array<{ slug: string; updated_at: string }> | undefined) ?? [];
  const baseUrl = String(payload.baseUrl ?? '').replace(/\/$/, '');

  const urls = posts
    .filter((p) => p.slug)
    .map((p) => `  <url>
    <loc>${baseUrl}/${escapeXml(p.slug)}</loc>
    <lastmod>${escapeXml(p.updated_at)}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`)
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;

  return { ...payload, markup: xml };
};

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
