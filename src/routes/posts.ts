// src/routes/posts.ts — admin Posts CRUD + editor preview + post admin pages.
// Post content is still markdown today; Phase 4 swaps the editor + storage.
// (Phase 2c extraction from index.ts.)

import { requireAuth } from "../cms/auth.js";
import { App, SLUG_RE, parseJsonBody } from "../cms/env.js";
import { DbPost, autoExcerpt } from "../cms/render.js";
import { sanitizePostHtml } from "../cms/sanitize.js";
import { adminShell, dashboardBody, postsBody, newPostBody, editBody } from "../admin.js";

export function registerPostRoutes(app: App): void {
  app.post("/api/admin/posts", async (c) => {
    const auth = await requireAuth(c);
    if (auth instanceof Response) return auth;

    const body = await parseJsonBody(c);
    if (!body) return c.json({ error: "Invalid JSON" }, 400);
    const title = String(body.title ?? "");
    const slug = String(body.slug ?? "");
    const content = sanitizePostHtml(String(body.content ?? ""));
    if (!title.trim()) return c.json({ error: "Title is required" }, 400);
    if (!slug || !SLUG_RE.test(slug)) return c.json({ error: "Invalid slug — use lowercase letters, numbers, and hyphens" }, 400);

    const db = c.env.DB;
    const now = new Date().toISOString();
    const publishAt = body.publish_at || null;
    const published = body.publish_at ? 0 : body.published === true ? 1 : 0;
    const previewToken = crypto.randomUUID();
    const excerpt = String(body.excerpt || autoExcerpt(content));

    let result;
    try {
      result = await db
        .prepare(
          "INSERT INTO posts (title, slug, content, excerpt, published, publish_at, preview_token, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(title, slug, content, excerpt, published, publishAt, previewToken, now, now)
        .run();
    } catch (e: any) {
      if (String(e?.message ?? "").includes("UNIQUE")) return c.json({ error: "A post with this slug already exists" }, 409);
      throw e;
    }

    const postId = result.meta.last_row_id;
    const tagIds = Array.isArray(body.tag_ids) ? body.tag_ids : [];
    if (tagIds.length) {
      for (const tid of tagIds) {
        await db
          .prepare("INSERT OR IGNORE INTO post_tags (post_id, tag_id) VALUES (?, ?)")
          .bind(postId, tid)
          .run();
      }
    }

    await c.env.CACHE.delete("cms:posts:pub");
    await c.env.CACHE.delete("cms:homepage");
    return c.json({ ok: true, id: postId });
  });

  app.get("/api/admin/posts", async (c) => {
    const auth = await requireAuth(c);
    if (auth instanceof Response) return auth;

    const page = Math.max(1, parseInt(c.req.query("page") ?? "1", 10));
    const limit = 20;
    const offset = (page - 1) * limit;
    const countRow = await c.env.DB.prepare(
      "SELECT COUNT(*) as total FROM posts",
    ).first<{ total: number }>();
    const total = countRow?.total ?? 0;
    const totalPages = Math.ceil(total / limit);

    const rows = await c.env.DB.prepare(
      "SELECT id, title, slug, published, publish_at, updated_at FROM posts ORDER BY updated_at DESC LIMIT ? OFFSET ?",
    )
      .bind(limit, offset)
      .all<{
        id: number;
        title: string;
        slug: string;
        published: number;
        publish_at: string | null;
        updated_at: string;
      }>();
    return c.json({ results: rows.results, total, page, totalPages });
  });

  app.get("/api/admin/posts/:id", async (c) => {
    const auth = await requireAuth(c);
    if (auth instanceof Response) return auth;

    const id = c.req.param("id");
    const post = await c.env.DB.prepare("SELECT * FROM posts WHERE id = ?")
      .bind(id)
      .first<DbPost>();
    if (!post)
      return c.body(JSON.stringify({ error: "Not found" }), 404, {
        "Content-Type": "application/json",
      });
    return c.json(post);
  });

  app.patch("/api/admin/posts/:id", async (c) => {
    const auth = await requireAuth(c);
    if (auth instanceof Response) return auth;

    const id = c.req.param("id");
    const body = await parseJsonBody(c);
    if (!body) return c.json({ error: "Invalid JSON" }, 400);
    const title = String(body.title ?? "");
    const slug = String(body.slug ?? "");
    const content = sanitizePostHtml(String(body.content ?? ""));
    if (!title.trim()) return c.json({ error: "Title is required" }, 400);
    if (!slug || !SLUG_RE.test(slug)) return c.json({ error: "Invalid slug — use lowercase letters, numbers, and hyphens" }, 400);

    const now = new Date().toISOString();
    const publishAt = body.publish_at || null;
    const published = body.publish_at ? 0 : body.published === true ? 1 : 0;
    const excerpt = String(body.excerpt || autoExcerpt(content));

    const existing = await c.env.DB.prepare("SELECT preview_token FROM posts WHERE id = ?").bind(id).first<{ preview_token: string | null }>();
    const previewToken = existing?.preview_token || crypto.randomUUID();

    let result;
    try {
      result = await c.env.DB.prepare(
        "UPDATE posts SET title=?, slug=?, content=?, excerpt=?, published=?, publish_at=?, preview_token=?, updated_at=? WHERE id=?",
      )
        .bind(title, slug, content, excerpt, published, publishAt, previewToken, now, id)
        .run();
    } catch (e: any) {
      if (String(e?.message ?? "").includes("UNIQUE")) return c.json({ error: "A post with this slug already exists" }, 409);
      throw e;
    }
    if (result.meta.changes === 0) return c.json({ error: "Post not found" }, 404);

    if (Array.isArray(body.tag_ids)) {
      await c.env.DB.prepare("DELETE FROM post_tags WHERE post_id = ?")
        .bind(id)
        .run();
      for (const tid of body.tag_ids) {
        await c.env.DB.prepare(
          "INSERT OR IGNORE INTO post_tags (post_id, tag_id) VALUES (?, ?)",
        )
          .bind(id, tid)
          .run();
      }
    }

    await c.env.CACHE.delete("cms:posts:pub");
    await c.env.CACHE.delete("cms:homepage");
    return c.json({ ok: true, preview_token: previewToken });
  });

  app.delete("/api/admin/posts/:id", async (c) => {
    const auth = await requireAuth(c);
    if (auth instanceof Response) return auth;

    const result = await c.env.DB.prepare("DELETE FROM posts WHERE id = ?")
      .bind(c.req.param("id"))
      .run();
    if (result.meta.changes === 0) return c.json({ error: "Post not found" }, 404);
    await c.env.CACHE.delete("cms:posts:pub");
    await c.env.CACHE.delete("cms:homepage");
    return c.json({ ok: true });
  });

  app.patch("/api/admin/posts/:id/publish", async (c) => {
    const auth = await requireAuth(c);
    if (auth instanceof Response) return auth;
    const now = new Date().toISOString();
    const result = await c.env.DB.prepare(
      "UPDATE posts SET published=1, publish_at=NULL, preview_token=NULL, updated_at=? WHERE id=?",
    )
      .bind(now, c.req.param("id"))
      .run();
    if (result.meta.changes === 0) return c.json({ error: "Post not found" }, 404);
    await c.env.CACHE.delete("cms:posts:pub");
    await c.env.CACHE.delete("cms:homepage");
    return c.json({ ok: true });
  });

  app.patch("/api/admin/posts/:id/unpublish", async (c) => {
    const auth = await requireAuth(c);
    if (auth instanceof Response) return auth;
    const now = new Date().toISOString();
    const result = await c.env.DB.prepare(
      "UPDATE posts SET published=0, updated_at=? WHERE id=?",
    )
      .bind(now, c.req.param("id"))
      .run();
    if (result.meta.changes === 0) return c.json({ error: "Post not found" }, 404);
    await c.env.CACHE.delete("cms:posts:pub");
    await c.env.CACHE.delete("cms:homepage");
    return c.json({ ok: true });
  });

  // ── Admin pages (HTML) ───────────────────────────────────────────
  app.get("/admin", async (c) => {
    const auth = await requireAuth(c);
    if (auth instanceof Response) return c.redirect("/admin/login");
    return c.html(adminShell("Dashboard", dashboardBody()));
  });

  app.get("/admin/posts", async (c) => {
    const auth = await requireAuth(c);
    if (auth instanceof Response) return c.redirect("/admin/login");
    return c.html(adminShell("Posts", postsBody()));
  });

  app.get("/admin/new", async (c) => {
    const auth = await requireAuth(c);
    if (auth instanceof Response) return c.redirect("/admin/login");
    return c.html(adminShell("New Post", newPostBody()));
  });

  app.get("/admin/edit/:id", async (c) => {
    const auth = await requireAuth(c);
    if (auth instanceof Response) return c.redirect("/admin/login");
    const id = c.req.param("id");
    const post = await c.env.DB.prepare("SELECT * FROM posts WHERE id = ?")
      .bind(id)
      .first<DbPost>();
    if (!post) return c.notFound();
    return c.html(
      adminShell(
        "Edit Post",
        editBody({
          id: post.id,
          title: post.title,
          slug: post.slug,
          content: post.content,
          excerpt: post.excerpt,
          published: post.published,
          publish_at: post.publish_at,
          preview_token: post.preview_token,
          updated_at: post.updated_at,
        }),
      ),
    );
  });

  // ── Post tags (admin) ────────────────────────────────────────────
  app.get("/api/admin/posts/:id/tags", async (c) => {
    const auth = await requireAuth(c);
    if (auth instanceof Response) return auth;
    const rows = await c.env.DB.prepare(
      "SELECT t.id, t.name FROM tags t JOIN post_tags pt ON t.id = pt.tag_id WHERE pt.post_id = ?",
    )
      .bind(c.req.param("id"))
      .all<{ id: number; name: string }>();
    return c.json(rows.results);
  });
}
