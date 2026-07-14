export interface Theme {
  id: string;
  name: string;
  author: string;
  description: string;
  version: string;
  css: string;
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
