// src/routes/install.ts — first-run install wizard endpoint.
// Hits D1 + KV to create the schema, seed settings, register plugins,
// and create the admin account, then auto-logs the installer in.
// (Phase 2c extraction from index.ts.)

import { setCookie } from "hono/cookie";
import { App, SESSION_COOKIE, SESSION_TTL } from "../cms/env.js";
import { migrate, seed, isConfigured } from "../cms/d1.js";
import { hashPassword } from "../cms/auth.js";
import { AVAILABLE_PLUGINS } from "../plugins/index.js";

export function registerInstallRoute(app: App): void {
  app.post("/api/install", async (c) => {
    const db = c.env.DB;
    // isConfigured() reads the `settings` table, but migrate() (below) is what
    // creates it — so on a fresh or freshly-wiped D1 this SELECT throws
    // "no such table: settings". That call sits outside the try/catch below, so
    // the throw escapes as a raw 500 (= the "Internal Server Error" the wizard
    // showed) and the install never runs. A config we can't read is, by
    // definition, not configured — treat the throw as false and let migrate()
    // create the table, then install proceeds normally.
    let configured = false;
    try {
      configured = await isConfigured(db);
    } catch {
      configured = false;
    }
    if (configured) {
      return c.json({ error: "Already configured" }, 409);
    }
    const lockKey = "install:lock";
    const lock = await c.env.CACHE.get(lockKey);
    if (lock) return c.json({ error: "Installation in progress" }, 429);
    await c.env.CACHE.put(lockKey, "1", { expirationTtl: 60 });
    try {
    const body = await c.req.parseBody();
    const siteName = String(body.siteName ?? "").trim();
    const adminUsername = String(body.adminUsername ?? "").trim();
      const adminPassword = String(body.adminPassword ?? "");
      if (!siteName) return c.json({ error: "Site name is required" }, 400);
      if (!adminUsername) return c.json({ error: "Admin username is required" }, 400);
      if (adminPassword.length < 8) {
        return c.json({ error: "Password must be at least 8 characters" }, 400);
      }

      await migrate(db);
      await seed(db, siteName);

      const seo = body.plugin_seo === "on";
      const sitemap = body.plugin_sitemap === "on";
      for (const p of AVAILABLE_PLUGINS) {
        await db
          .prepare("INSERT OR IGNORE INTO plugins (id, active) VALUES (?, 0)")
          .bind(p.id)
          .run();
      }
      if (seo)
        await db.prepare("UPDATE plugins SET active = 1 WHERE id = 'seo'").run();
      if (sitemap)
        await db
          .prepare("UPDATE plugins SET active = 1 WHERE id = 'sitemap'")
          .run();

      const adminPasswordHash = await hashPassword(adminPassword);
      const result = await db
        .prepare(
          "INSERT OR REPLACE INTO admins (username, password_hash) VALUES (?, ?)",
        )
        .bind(adminUsername, adminPasswordHash)
        .run();

      // Set configured status LAST so partial failures don't lock out re-install
      await db
        .prepare(
          "INSERT OR REPLACE INTO settings (key, value) VALUES ('status', 'configured')",
        )
        .run();

      await c.env.CACHE.delete("cms:settings");

      // Auto-login after install (return JSON, not redirect — fetch() doesn't
      // reliably set cookies from redirect responses on all platforms)
      const sessionId = crypto.randomUUID();
      const adminId = result.meta.last_row_id;
      await c.env.CACHE.put(`session:${sessionId}`, String(adminId), {
        expirationTtl: SESSION_TTL,
      });
      setCookie(c, SESSION_COOKIE, sessionId, {
        maxAge: SESSION_TTL,
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
        secure: true,
      });
      return c.json({ ok: true });
    } catch {
      await c.env.CACHE.delete(lockKey);
      return c.json({ error: "Installation failed. Check your D1 and KV bindings." }, 500);
    }
  });
}
