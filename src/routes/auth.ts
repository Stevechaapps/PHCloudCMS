// src/routes/auth.ts — login, logout, and the admin login page.
// Session bookkeeping lives in cms/auth + cms/env; this module only wires
// the three HTTP endpoints. (Phase 2c extraction from index.ts.)

import { getCookie, setCookie } from "hono/cookie";
import { verifyPassword } from "../cms/auth.js";
import { App, parseJsonBody, SESSION_COOKIE, SESSION_TTL } from "../cms/env.js";
import { loginForm } from "../admin.js";

export function registerAuthRoutes(app: App): void {
  app.post("/api/auth/login", async (c) => {
    const body = await parseJsonBody(c);
    if (!body) return c.json({ error: "Invalid JSON" }, 400);
    const usernameStr = String(body.username ?? "");
    const passwordStr = String(body.password ?? "");

    const existingSessionId = getCookie(c, SESSION_COOKIE);
    if (existingSessionId) {
      const sessionOk = await c.env.CACHE.get(`session:${existingSessionId}`);
      if (sessionOk) {
        const admin = await c.env.DB.prepare("SELECT id, password_hash FROM admins WHERE username = ?").bind(usernameStr).first<{ id: number; password_hash: string }>();
        const valid = admin && (await verifyPassword(passwordStr, admin.password_hash));
        if (valid) {
          const newSid = crypto.randomUUID();
          await c.env.CACHE.delete(`session:${existingSessionId}`);
          await c.env.CACHE.put(`session:${newSid}`, String(admin.id), { expirationTtl: SESSION_TTL });
          setCookie(c, SESSION_COOKIE, newSid, { maxAge: SESSION_TTL, path: "/", httpOnly: true, sameSite: "Lax", secure: true });
          return c.json({ ok: true });
        }
      }
    }

    const ip = c.req.header("cf-connecting-ip") ?? c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const key = `login:${ip}`;
    const count = await c.env.CACHE.get(key);
    const attempts = Number.parseInt(count ?? "0", 10);
    if (attempts >= 5) {
      const ttl = await c.env.CACHE.get(key + ":ts");
      if (ttl && Number(ttl) > Date.now()) {
        const waitSec = Math.ceil((Number(ttl) - Date.now()) / 1000);
        return c.json({ error: `Too many attempts. Try again in ${waitSec}s` }, 429);
      }
    }

    const db = c.env.DB;
    const admin = await db
      .prepare("SELECT id, password_hash FROM admins WHERE username = ?")
      .bind(usernameStr)
      .first<{ id: number; password_hash: string }>();

    const valid = admin && (await verifyPassword(passwordStr, admin.password_hash));

    if (!valid) {
      const newCount = attempts + 1;
      await c.env.CACHE.put(key, String(newCount), { expirationTtl: 300 });
      if (newCount >= 5) {
        await c.env.CACHE.put(key + ":ts", String(Date.now() + 300000), { expirationTtl: 300 });
      }
      return c.json({ error: "Invalid credentials" }, 401);
    }

    const sessionId = crypto.randomUUID();
    await c.env.CACHE.put(`session:${sessionId}`, String(admin.id), {
      expirationTtl: SESSION_TTL,
    });
    setCookie(c, SESSION_COOKIE, sessionId, {
      maxAge: SESSION_TTL,
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
      secure: true,
    });
    await c.env.CACHE.delete(key);
    return c.json({ ok: true });
  });

  app.post("/api/auth/logout", async (c) => {
    const sessionId = getCookie(c, SESSION_COOKIE);
    if (sessionId) await c.env.CACHE.delete(`session:${sessionId}`);
    setCookie(c, SESSION_COOKIE, "", {
      maxAge: 0,
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
      secure: true,
    });
    return c.json({ ok: true });
  });

  app.get("/admin/login", async (c) => {
    // Only skip the form if the session is actually valid in KV. A stale
    // cookie (KV TTL'd, cleared, or from a different env) must NOT bounce to
    // /admin — /admin's auth gate would then return 401 and push straight
    // back here, producing a /admin ↔ /admin/login reload loop.
    const sid = getCookie(c, SESSION_COOKIE);
    if (sid && (await c.env.CACHE.get(`session:${sid}`))) return c.redirect("/admin");
    return c.html(loginForm());
  });
}
