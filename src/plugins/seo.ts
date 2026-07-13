// src/plugins/seo.ts — SEO injection plugin
// Hooks into the render:head pipeline to inject meta tags, Open Graph, and canonical URLs.

import type { PluginHook, CMSRegistry } from '../cms/registry.js';

export function initSEOPlugin(registry: CMSRegistry): void {
  registry.register('render:head', seoHook);
}

const seoHook: PluginHook = (payload) => {
  const meta = payload.meta as Record<string, string> | undefined;
  if (!meta) return payload;

  const siteName = String(payload.siteName ?? 'Site');
  const title    = meta.title ? `${meta.title} · ${siteName}` : siteName;
  const desc     = meta.description ?? '';
  const url      = meta.url ?? '';
  const image    = meta.image ?? '';

  const tags = [
    `<title>${escapeHtml(title)}</title>`,
    `<meta name="description" content="${escapeHtml(desc)}" />`,
    `<link rel="canonical" href="${escapeHtml(url)}" />`,
    // Open Graph
    `<meta property="og:title" content="${escapeHtml(title)}" />`,
    `<meta property="og:description" content="${escapeHtml(desc)}" />`,
    `<meta property="og:url" content="${escapeHtml(url)}" />`,
    ...(image ? [`<meta property="og:image" content="${escapeHtml(image)}" />`] : []),
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${escapeHtml(siteName)}" />`,
    // Twitter Card
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeHtml(title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(desc)}" />`,
  ].join('\n    ');

  return {
    ...payload,
    markup: `${tags}\n    ${payload.markup ?? ''}`,
  };
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
