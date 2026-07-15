// src/plugins/index.ts — Plugin auto-discovery hub
import type { CMSRegistry } from '../cms/registry.js';
import { initSEOPlugin } from './seo.js';
import { initSitemapPlugin } from './sitemap.js';

export type PluginEntry = {
  id: string;
  name: string;
  description: string;
  category: string;
  version: string;
  author: string;
  hooks: string[];
  init: (registry: CMSRegistry) => void;
};

export const AVAILABLE_PLUGINS: PluginEntry[] = [
  {
    id: 'seo',
    name: 'SEO',
    description: 'Automatic meta tags, Open Graph, Twitter Cards, and canonical URLs.',
    category: 'seo',
    version: '1.0.0',
    author: 'PHCloud CMS',
    hooks: ['render:head'],
    init: initSEOPlugin,
  },
  {
    id: 'sitemap',
    name: 'Sitemap',
    description: 'Generates an XML sitemap at /sitemap.xml for search engines.',
    category: 'seo',
    version: '1.0.0',
    author: 'PHCloud CMS',
    hooks: ['render:sitemap'],
    init: initSitemapPlugin,
  },
];
