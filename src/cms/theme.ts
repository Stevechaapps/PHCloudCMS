export interface ThemeRenderContext {
  siteName: string;
  nav: { label: string; url: string }[];
}

export interface PostView {
  title: string;
  content: string;
  slug?: string;
  excerpt?: string;
  updated_at: string;
}

export interface PostListItem {
  slug: string;
  title: string;
  excerpt: string;
  updated_at: string;
}

export interface Theme {
  id: string;
  name: string;
  author: string;
  description: string;
  version: string;
  css: string;
  shell?: (siteName: string, headMarkup: string, bodyHtml: string, nav: { label: string; url: string }[]) => string;
  renderPost?: (post: PostView) => string;
  renderPostList?: (posts: PostListItem[], siteName: string) => string;
  renderHomepage?: (siteName: string) => string;
}

const registry = new Map<string, Theme>();

export function registerTheme(theme: Theme): void {
  registry.set(theme.id, theme);
}

export function getTheme(id: string): Theme | undefined {
  return registry.get(id);
}

export function getAllThemes(): Theme[] {
  return Array.from(registry.values());
}

export function getDefaultTheme(): Theme {
  return registry.get('default')!;
}
