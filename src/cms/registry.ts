// src/cms/registry.ts — Plugin Hook & Event Bus with manifest system
// Plugins register themselves via manifest + hook bindings.
// Auto-discovered at build time from src/plugins/index.ts

export type PluginHook = (payload: Record<string, unknown>) => Promise<Record<string, unknown>> | Record<string, unknown>;

export type PluginCategory =
  | 'seo'
  | 'security'
  | 'forms'
  | 'analytics'
  | 'backup'
  | 'ecommerce'
  | 'social'
  | 'media'
  | 'custom';

export interface ConfigField {
  key: string;
  type: 'text' | 'textarea' | 'toggle' | 'select';
  label: string;
  required?: boolean;
  options?: { value: string; label: string }[];
}

export interface PluginManifest {
  id: string;
  name: string;
  description: string;
  category: PluginCategory;
  version: string;
  author: string;
  icon?: string;
  configFields?: ConfigField[];
}

export interface RegisteredPlugin {
  manifest: PluginManifest;
  hooks: string[];
  register: () => void;
}

export class CMSRegistry {
  private hooks = new Map<string, PluginHook[]>();
  private plugins = new Map<string, RegisteredPlugin>();

  /** Register a hook function under a named pipeline */
  register(hookName: string, fn: PluginHook): void {
    if (!this.hooks.has(hookName)) this.hooks.set(hookName, []);
    this.hooks.get(hookName)!.push(fn);
  }

  /** Register a full plugin with manifest and its hook bindings */
  registerPlugin(manifest: PluginManifest, hookNames: string[], registerFn: () => void): void {
    this.plugins.set(manifest.id, { manifest, hooks: hookNames, register: registerFn });
    registerFn();
  }

  /** Run all functions registered for a hook, passing result through each */
  async executePipeline(hookName: string, initialPayload: Record<string, unknown>): Promise<Record<string, unknown>> {
    let current = { ...initialPayload };
    const fns = this.hooks.get(hookName) ?? [];
    for (const fn of fns) {
      try {
        current = await fn(current);
      } catch {
        // Skip failed hooks so one bad plugin doesn't break the page
      }
    }
    return current;
  }

  /** Check if any hook is registered under this name */
  has(hookName: string): boolean {
    return (this.hooks.get(hookName)?.length ?? 0) > 0;
  }

  /** Get all registered plugin manifests */
  getPlugins(): RegisteredPlugin[] {
    return Array.from(this.plugins.values());
  }

  /** Get a specific plugin by ID */
  getPlugin(id: string): RegisteredPlugin | undefined {
    return this.plugins.get(id);
  }
}
