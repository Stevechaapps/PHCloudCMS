// src/routes/plugins.ts — plugin manager API + plugin manager admin page.
// (Phase 2c extraction from index.ts.)

import { requireAuth } from "../cms/auth.js";
import { App, parseJsonBody } from "../cms/env.js";
import { AVAILABLE_PLUGINS } from "../plugins/index.js";
import { adminShell, pluginsBody } from "../admin.js";

export function registerPluginRoutes(app: App): void {
  app.patch("/api/admin/plugins/:id", async (c) => {
    const auth = await requireAuth(c);
    if (auth instanceof Response) return auth;
    const id = c.req.param("id");
    const validIds = AVAILABLE_PLUGINS.map((p) => p.id);
    if (!validIds.includes(id)) return c.json({ error: "Unknown plugin" }, 404);
    const body = await parseJsonBody(c);
    if (!body) return c.json({ error: "Invalid JSON" }, 400);
    const active = body.active === true ? 1 : 0;
    await c.env.DB.prepare("INSERT OR REPLACE INTO plugins (id, active) VALUES (?, ?)")
      .bind(id, active)
      .run();
    await c.env.CACHE.delete("cms:plugins");
    return c.json({ ok: true });
  });

  app.get("/admin/plugins", async (c) => {
    const auth = await requireAuth(c);
    if (auth instanceof Response) return c.redirect("/admin/login");
    const rows = await c.env.DB.prepare("SELECT id, active FROM plugins").all<{
      id: string;
      active: number;
    }>();
    const activeSet = new Set(
      rows.results.filter((p) => p.active === 1).map((p) => p.id),
    );
    return c.html(
      adminShell("Plugins", pluginsBody(AVAILABLE_PLUGINS, activeSet)),
    );
  });
}
