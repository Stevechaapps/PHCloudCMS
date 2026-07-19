// src/cms/registry.ts — Plugin Hook & Event Bus

export type PluginHook = (payload: Record<string, unknown>) => Promise<Record<string, unknown>> | Record<string, unknown>;

export class CMSRegistry {
  private hooks = new Map<string, PluginHook[]>();

  /** Register a hook function under a named pipeline */
  register(hookName: string, fn: PluginHook): void {
    if (!this.hooks.has(hookName)) this.hooks.set(hookName, []);
    this.hooks.get(hookName)!.push(fn);
  }

  /** Run all functions registered for a hook, passing result through each */
  async executePipeline(hookName: string, initialPayload: Record<string, unknown>): Promise<Record<string, unknown>> {
    let current = { ...initialPayload };
    const fns = this.hooks.get(hookName) ?? [];
    for (const fn of fns) {
      try {
        current = await fn(current);
      } catch (e) {
        console.error(`[CMS] Plugin hook "${hookName}" failed:`, e);
      }
    }
    return current;
  }
}
