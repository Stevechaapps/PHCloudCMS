// src/plugins/seo.ts — SEO injection plugin
// Hooks into the render:head pipeline to inject meta tags, Open Graph, and canonical URLs.

import type { PluginHook, CMSRegistry } from '../cms/registry.js';
import { esc } from '../cms/escape.js';

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
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(desc)}" />`,
    `<link rel="canonical" href="${esc(url)}" />`,
    // Open Graph
    `<meta property="og:title" content="${esc(title)}" />`,
    `<meta property="og:description" content="${esc(desc)}" />`,
    `<meta property="og:url" content="${esc(url)}" />`,
    ...(image ? [`<meta property="og:image" content="${esc(image)}" />`] : []),
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${esc(siteName)}" />`,
    // Twitter Card
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(title)}" />`,
    `<meta name="twitter:description" content="${esc(desc)}" />`,
  ].join('\n    ');

  return {
    ...payload,
    markup: `${tags}\n    ${payload.markup ?? ''}`,
  };
};