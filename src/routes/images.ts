// src/routes/images.ts — admin Image API + image admin page + public /img/:id.
// (Phase 2c extraction from index.ts.)

import { requireAuth } from "../cms/auth.js";
import { App, parseJsonBody } from "../cms/env.js";
import { saveImage, getImage, deleteImage } from "../cms/images.js";
import { adminShell, imagesBody } from "../admin.js";

export function registerImageRoutes(app: App): void {
  app.post("/api/admin/images", async (c) => {
    const auth = await requireAuth(c);
    if (auth instanceof Response) return auth;
    const body = await parseJsonBody(c);
    if (!body) return c.json({ error: "Invalid JSON" }, 400);
    const data = String(body.data ?? "");
    const filename = String(body.filename ?? "");
    if (!data) return c.json({ error: "No image data" }, 400);
    const match = data.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!match) return c.json({ error: "Invalid image data" }, 400);
    const mime = match[1];
    const ALLOWED_MIMES = ["image/png", "image/jpeg", "image/webp"];
    if (!ALLOWED_MIMES.includes(mime)) {
      return c.json({ error: `Unsupported image type: ${mime}. Allowed: PNG, JPEG, WebP.` }, 400);
    }
    const base64 = match[2];
    const MAX_BASE64 = 700000; // ~500KB decoded
    if (base64.length > MAX_BASE64) {
      return c.json({ error: "Image too large. Maximum size is ~500KB." }, 413);
    }
    const binaryStr = atob(base64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
    const id = await saveImage(
      c.env.DB,
      filename || "paste." + mime.split("/")[1],
      bytes,
      mime,
    );
    return c.json({ url: "/img/" + id });
  });

  app.get("/api/admin/images", async (c) => {
    const auth = await requireAuth(c);
    if (auth instanceof Response) return auth;
    const page = Math.max(1, Number.parseInt(c.req.query("page") ?? "1", 10));
    const perPage = 20;
    const offset = (page - 1) * perPage;
    const [countRow, rows] = await Promise.all([
      c.env.DB.prepare("SELECT COUNT(*) as cnt FROM images").first<{ cnt: number }>(),
      c.env.DB
        .prepare(
          "SELECT id, filename, mime, size, created_at FROM images ORDER BY created_at DESC LIMIT ? OFFSET ?",
        )
        .bind(perPage, offset)
        .all<{
          id: number;
          filename: string;
          mime: string;
          size: number;
          created_at: string;
        }>(),
    ]);
    return c.json({
      results: rows.results,
      total: countRow?.cnt ?? 0,
      page,
      totalPages: Math.ceil((countRow?.cnt ?? 0) / perPage),
    });
  });

  app.delete("/api/admin/images/:id", async (c) => {
    const auth = await requireAuth(c);
    if (auth instanceof Response) return auth;
    const id = parseInt(c.req.param("id"), 10);
    if (isNaN(id)) return c.body(null, 400);
    await deleteImage(c.env.DB, id, c.env.CACHE);
    return c.body(null, 204);
  });

  app.get("/admin/images", async (c) => {
    const auth = await requireAuth(c);
    if (auth instanceof Response) return c.redirect("/admin/login");
    return c.html(adminShell("Image Library", imagesBody()));
  });

  // ── Public image serving ─────────────────────────────────────────
  app.get("/img/:id", async (c) => {
    const id = parseInt(c.req.param("id"), 10);
    if (isNaN(id)) return c.body(null, 404);
    const [cachedData, cachedMime] = await Promise.all([
      c.env.CACHE.get(`img:${id}:data`, "arrayBuffer"),
      c.env.CACHE.get(`img:${id}:meta`),
    ]);
    if (cachedData && cachedMime) {
      return c.body(cachedData, 200, {
        "Content-Type": cachedMime,
        "Cache-Control": "public, max-age=31536000, immutable",
      });
    }
    const img = await getImage(c.env.DB, id);
    if (!img) return c.body(null, 404);
    await Promise.all([
      c.env.CACHE.put(`img:${id}:data`, img.data, { expirationTtl: 2592000 }),
      c.env.CACHE.put(`img:${id}:meta`, img.mime, { expirationTtl: 2592000 }),
    ]);
    return c.body(img.data, 200, {
      "Content-Type": img.mime,
      "Cache-Control": "public, max-age=31536000, immutable",
    });
  });
}
