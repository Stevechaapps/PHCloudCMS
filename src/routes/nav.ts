// src/routes/nav.ts — admin Nav menu API + nav admin page.
// (Phase 2c extraction from index.ts.)

import { requireAuth } from "../cms/auth.js";
import { App, parseJsonBody } from "../cms/env.js";
import { NavItem } from "../cms/render.js";
import { getSetting } from "../cms/d1.js";
import { adminShell, navBody } from "../admin.js";

export function registerNavRoutes(app: App): void {
  app.post("/api/admin/nav", async (c) => {
    const auth = await requireAuth(c);
    if (auth instanceof Response) return auth;
    const body = await parseJsonBody(c);
    if (!body) return c.json({ error: "Invalid JSON" }, 400);
    const items = Array.isArray(body.items) ? body.items : [];
    await c.env.DB.prepare(
      "INSERT OR REPLACE INTO settings (key, value) VALUES ('nav', ?)",
    )
      .bind(JSON.stringify(items))
      .run();
    await c.env.CACHE.delete("cms:settings");
    return c.json({ ok: true });
  });

  app.get("/api/admin/nav", async (c) => {
    const auth = await requireAuth(c);
    if (auth instanceof Response) return auth;
    const val = await getSetting(c.env.DB, "nav");
    let navParsed: NavItem[];
    try { const p = val ? JSON.parse(val) : []; navParsed = Array.isArray(p) ? p : []; } catch { navParsed = []; }
    return c.json(navParsed);
  });

  app.get("/admin/nav", async (c) => {
    const auth = await requireAuth(c);
    if (auth instanceof Response) return auth;
    return c.html(adminShell("Navigation", navBody()));
  });
}
