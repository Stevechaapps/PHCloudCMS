// src/routes/settings.ts — admin Settings API + settings admin page.
// (Phase 2c extraction from index.ts.)

import { requireAuth } from "../cms/auth.js";
import { App, parseJsonBody } from "../cms/env.js";
import { getAllSettings } from "../cms/d1.js";
import { adminShell, settingsBody } from "../admin.js";

export function registerSettingsRoutes(app: App): void {
  app.get("/api/admin/settings", async (c) => {
    const auth = await requireAuth(c);
    if (auth instanceof Response) return auth;
    const settings = await getAllSettings(c.env.DB);
    return c.json({
      site_name: settings.site_name ?? "",
      seo_description: settings.seo_description ?? "",
      site_logo: settings.site_logo ?? null,
    });
  });

  app.patch("/api/admin/settings", async (c) => {
    const auth = await requireAuth(c);
    if (auth instanceof Response) return auth;
    const body = await parseJsonBody(c);
    if (!body) return c.json({ error: "Invalid JSON" }, 400);
    const db = c.env.DB;
    if (body.site_name !== undefined)
      await db
        .prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('site_name', ?)")
        .bind(body.site_name)
        .run();
    if (body.seo_description !== undefined)
      await db
        .prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('seo_description', ?)")
        .bind(body.seo_description)
        .run();
    if (body.site_logo !== undefined)
      await db
        .prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('site_logo', ?)")
        .bind(body.site_logo ?? "")
        .run();
    await c.env.CACHE.delete("cms:settings");
    return c.json({ ok: true });
  });

  app.get("/admin/settings", async (c) => {
    const auth = await requireAuth(c);
    if (auth instanceof Response) return c.redirect("/admin/login");
    return c.html(adminShell("Settings", settingsBody()));
  });
}
