// src/plugins/index.ts — Plugin auto-discovery hub
// Add new plugins here; the registry imports this single entry point.
import type { CMSRegistry } from '../cms/registry.js';
import { initSEOPlugin } from './seo.js';
import { initSitemapPlugin } from './sitemap.js';

export function initAllPlugins(registry: CMSRegistry): void {
  initSEOPlugin(registry);
  initSitemapPlugin(registry);
}

/**
 * list of all available plugins (for the admin plugin manager).
 * Each entry matches the manifest passed to registry.registerPlugin().
 */
export const AVAILABLE_PLUGINS = [
  {
    id: 'seo',
    name: 'SEO',
    description: 'Automatic meta tags, Open Graph, Twitter Cards, and canonical URLs.',
    category: 'seo' as const,
    version: '1.0.0',
    author: 'EdgeCMS',
    hooks: ['render:head'],
  },
  {
    id: 'sitemap',
    name: 'Sitemap',
    description: 'Generates an XML sitemap at /sitemap.xml for search engines.',
    category: 'seo' as const,
    version: '1.0.0',
    author: 'EdgeCMS',
    hooks: ['render:sitemap'],
  },
];
