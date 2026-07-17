// src/routes/pages.ts — admin Pages CRUD (type='page') + page admin pages.
// (Phase 2c extraction from index.ts.)

import { requireAuth } from "../cms/auth.js";
import { App, SLUG_RE, parseJsonBody } from "../cms/env.js";
import { DbPost } from "../cms/render.js";
import { sanitizePostHtml } from "../cms/sanitize.js";
import { adminShell, pagesBody, newPageBody, editPageBody } from "../admin.js";

export function registerPageRoutes(app: App): void {
  app.post("/api/admin/pages", async (c) => {
    const auth = await requireAuth(c);
    if (auth instanceof Response) return auth;
    const body = await parseJsonBody(c);
    if (!body) return c.json({ error: "Invalid JSON" }, 400);
    const title = String(body.title ?? "").trim();
    const slug = String(body.slug ?? "").trim();
    if (!title) return c.json({ error: "Title is required" }, 400);
    if (!slug || !SLUG_RE.test(slug)) return c.json({ error: "Invalid slug" }, 400);
    const db = c.env.DB;
    const now = new Date().toISOString();
    let result;
    try {
      result = await db
        .prepare(
          "INSERT INTO posts (title, slug, content, excerpt, type, published, created_at, updated_at) VALUES (?, ?, ?, '', 'page', ?, ?, ?)",
        )
        .bind(title, slug, sanitizePostHtml(String(body.content ?? "")), body.published === true ? 1 : 0, now, now)
        .run();
    } catch (e: any) {
      if (String(e?.message ?? "").includes("UNIQUE")) return c.json({ error: "A page with this slug already exists" }, 409);
      throw e;
    }
    await c.env.CACHE.delete("cms:homepage");
    return c.json({ ok: true, id: result.meta.last_row_id });
  });

  app.get("/api/admin/pages", async (c) => {
    const auth = await requireAuth(c);
    if (auth instanceof Response) return auth;
    const rows = await c.env.DB.prepare(
      "SELECT id, title, slug, published, updated_at FROM posts WHERE type = 'page' ORDER BY updated_at DESC",
    ).all<{
      id: number;
      title: string;
      slug: string;
      published: number;
      updated_at: string;
    }>();
    return c.json(rows.results);
  });

  app.get("/api/admin/pages/:id", async (c) => {
    const auth = await requireAuth(c);
    if (auth instanceof Response) return auth;
    const post = await c.env.DB.prepare(
      "SELECT * FROM posts WHERE id = ? AND type = 'page'",
    )
      .bind(c.req.param("id"))
      .first<DbPost>();
    if (!post)
      return c.body(JSON.stringify({ error: "Not found" }), 404, {
        "Content-Type": "application/json",
      });
    return c.json(post);
  });

  app.patch("/api/admin/pages/:id", async (c) => {
    const auth = await requireAuth(c);
    if (auth instanceof Response) return auth;
    const body = await parseJsonBody(c);
    if (!body) return c.json({ error: "Invalid JSON" }, 400);
    const now = new Date().toISOString();
    const result = await c.env.DB.prepare(
      "UPDATE posts SET title=?, slug=?, content=?, published=?, updated_at=? WHERE id=? AND type='page'",
    )
      .bind(
        String(body.title ?? ""),
        String(body.slug ?? ""),
        sanitizePostHtml(String(body.content ?? "")),
        body.published === true ? 1 : 0,
        now,
        c.req.param("id"),
      )
      .run();
    if (result.meta.changes === 0) return c.json({ error: "Page not found" }, 404);
    await c.env.CACHE.delete("cms:homepage");
    return c.json({ ok: true });
  });

  app.delete("/api/admin/pages/:id", async (c) => {
    const auth = await requireAuth(c);
    if (auth instanceof Response) return auth;
    const result = await c.env.DB.prepare("DELETE FROM posts WHERE id = ? AND type = 'page'")
      .bind(c.req.param("id"))
      .run();
    if (result.meta.changes === 0) return c.json({ error: "Page not found" }, 404);
    await c.env.CACHE.delete("cms:homepage");
    return c.json({ ok: true });
  });

  // ── Admin pages (HTML) ───────────────────────────────────────────
  app.get("/admin/pages", async (c) => {
    const auth = await requireAuth(c);
    if (auth instanceof Response) return auth;
    return c.html(adminShell("Pages", pagesBody()));
  });

  app.get("/admin/pages/new", async (c) => {
    const auth = await requireAuth(c);
    if (auth instanceof Response) return auth;
    return c.html(adminShell("New Page", newPageBody()));
  });

  app.get("/admin/pages/edit/:id", async (c) => {
    const auth = await requireAuth(c);
    if (auth instanceof Response) return auth;
    const id = c.req.param("id");
    const page = await c.env.DB.prepare(
      "SELECT id, title, slug, content, published, updated_at FROM posts WHERE id = ? AND type = 'page'",
    )
      .bind(id)
      .first<{
        id: number;
        title: string;
        slug: string;
        content: string;
        published: number;
        updated_at: string;
      }>();
    if (!page) return c.notFound();
    return c.html(adminShell("Edit Page", editPageBody(page)));
  });
}
