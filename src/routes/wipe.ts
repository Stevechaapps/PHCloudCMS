// src/routes/wipe.ts — emergency reset.
// Empties every D1 data table (keeping the schema) and flushes ALL KV, so a
// stuck or broken install can start over cleanly: the onboarding guard re-shows
// the install wizard (settings.status is gone, cms:settings cache is gone),
// the user recreates an admin, and is logged in fresh.
//
// Authorization — EITHER of:
//   1. A valid admin session cookie (requireAuth). Use this when you can still
//      log in: `fetch('/api/admin/wipe',{method:'POST'})` from the browser.
//   2. A bearer token matching the WIPE_TOKEN Worker secret, sent as
//      `Authorization: Bearer <token>`. Use this when you're locked OUT (stale
//      session / corrupted admin row) and can't reach any authed endpoint.
// Both paths are checked so the endpoint is never open to the public.

import { requireAuth } from "../cms/auth.js";
import { App } from "../cms/env.js";
import { migrate } from "../cms/d1.js";

export function registerWipeRoute(app: App): void {
  app.post("/api/admin/wipe", async (c) => {
    // Token path first — works with no session at all.
    const token = c.env.WIPE_TOKEN;
    const bearer = c.req.header("Authorization") ?? "";
    if (!token || bearer !== `Bearer ${token}`) {
      // Otherwise require a live admin session.
      const auth = await requireAuth(c);
      if (auth instanceof Response) return auth;
    }

    const db = c.env.DB;
    // Ensure every table exists first (no-op if present), then empty them.
    // This way the endpoint is safe whether tables exist or were dropped.
    await migrate(db);
    await db.batch([
      db.prepare("DELETE FROM post_tags"),
      db.prepare("DELETE FROM tags"),
      db.prepare("DELETE FROM images"),
      db.prepare("DELETE FROM posts"),
      db.prepare("DELETE FROM admins"),
      db.prepare("DELETE FROM plugins"),
      db.prepare("DELETE FROM settings"),
    ]);
    // Reset autoincrement counters. sqlite_sequence only exists once a table
    // with AUTOINCREMENT has been inserted into, so guard with try/catch.
    try {
      await db.prepare("DELETE FROM sqlite_sequence").run();
    } catch {
      /* table absent — nothing to reset */
    }

    // Flush ALL KV: stale sessions (so the loop cookie stops bouncing),
    // cms:settings (so the cached "configured" flag doesn't hide the wizard
    // for up to 10 min), login rate-limit counters, and page/image caches.
    let cursor: string | undefined;
    do {
      const list = cursor
        ? await c.env.CACHE.list({ cursor })
        : await c.env.CACHE.list();
      await Promise.all(list.keys.map((k) => c.env.CACHE.delete(k.name)));
      cursor = list.list_complete ? undefined : list.cursor;
    } while (cursor);

    return c.json({ ok: true, reset: true });
  });
}
