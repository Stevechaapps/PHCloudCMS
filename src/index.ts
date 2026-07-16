import { Hono } from "hono";
import type { Context } from "hono";
import { CMSRegistry } from "./cms/registry.js";
import { onboardingGuard, getCached } from "./cms/middleware.js";
import { migrate, seed, isConfigured, getSetting, getAllSettings } from "./cms/d1.js";
import { hashPassword, verifyPassword } from "./cms/auth.js";
import { renderMarkdown } from "./cms/markdown.js";
import { saveImage, getImage, deleteImage } from "./cms/images.js";
import { AVAILABLE_PLUGINS } from "./plugins/index.js";
import { getCookie, setCookie } from "hono/cookie";
import { css as themeCss } from "./themes/default.js";
import { esc, escXml } from "./cms/escape.js";
import {
  adminShell,
  dashboardBody,
  postsBody,
  newPostBody,
  editBody,
  loginForm,
  pluginsBody,
  pagesBody,
  newPageBody,
  editPageBody,
  tagsBody,
  navBody,
  settingsBody,
  imagesBody,
} from "./admin.js";

type Post = { title: string; content: string; updated_at: string };
type DbPost = Post & {
  id: number;
  slug: string;
  excerpt: string;
  published: number;
  type: string;
  publish_at: string | null;
  preview_token: string | null;
};
type NavItem = { label: string; url: string };

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

async function parseJsonBody(c: any): Promise<Record<string, unknown> | null> {
  try { return await c.req.json(); } catch { return null; }
}

function autoExcerpt(content: string): string {
  const text = content
    .replace(/[#*>`\[\]!\-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return text.slice(0, 160) + (text.length > 160 ? "…" : "");
}

async function publishScheduled(db: D1Database, cache?: KVNamespace): Promise<void> {
  if (cache) {
    const lastRun = await cache.get("cms:lastScheduledPublish");
    if (lastRun && Date.now() - Number(lastRun) < 60000) return;
  }
  const now = new Date().toISOString();
  await db
    .prepare(
      "UPDATE posts SET published=1, publish_at=NULL WHERE publish_at IS NOT NULL AND publish_at <= ?",
    )
    .bind(now)
    .run();
  if (cache) {
    await cache.put("cms:lastScheduledPublish", String(Date.now()), { expirationTtl: 120 });
  }
}

type Env = {
  DB: D1Database;
  CACHE: KVNamespace;
};

const SESSION_COOKIE = "phcloudcms_session";
const SESSION_TTL = 7 * 24 * 60 * 60;

const app = new Hono<{ Bindings: Env }>();

app.use("*", onboardingGuard);
app.use("*", async (c, next) => {
  await next();
  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  c.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  c.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  c.header("Content-Security-Policy", [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
  ].join("; "));
});

// ── Auth ──────────────────────────────────────────────────────────
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

async function requireAuth(c: Context): Promise<number | Response> {
  const sessionId = getCookie(c, SESSION_COOKIE);
  if (!sessionId)
    return c.body(JSON.stringify({ error: "Unauthorized" }), 401, {
      "Content-Type": "application/json",
    });
  const val = await c.env.CACHE.get(`session:${sessionId}`);
  if (!val)
    return c.body(JSON.stringify({ error: "Invalid session" }), 401, {
      "Content-Type": "application/json",
    });
  return parseInt(val, 10);
}

// ── Admin: Posts CRUD ──────────────────────────────────────────────

app.post("/api/admin/posts", async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) return auth;

  const body = await parseJsonBody(c);
  if (!body) return c.json({ error: "Invalid JSON" }, 400);
  const title = String(body.title ?? "");
  const slug = String(body.slug ?? "");
  const content = String(body.content ?? "");
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
  const content = String(body.content ?? "");
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

// ── Install wizard ────────────────────────────────────────────────

app.post("/api/install", async (c) => {
  const db = c.env.DB;
  if (await isConfigured(db)) {
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

// ── Markdown preview (admin) ─────────────────────────────────────

app.post("/api/preview", async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) return auth;
  const body = await parseJsonBody(c);
  if (!body) return c.json({ error: "Invalid JSON" }, 400);
  return c.json({ html: renderMarkdown(String(body.content ?? "")) });
});

// ── Sitemap ───────────────────────────────────────────────────────

app.get("/sitemap.xml", async (c) => {
  const registry = new CMSRegistry();
  const db = c.env.DB;

  const activePlugins = await getCached(c, "cms:plugins", 300, async () => {
    const rows = await db
      .prepare("SELECT id, active FROM plugins")
      .all<{ id: string; active: number }>();
    return Object.fromEntries(rows.results.map((p) => [p.id, p.active === 1]));
  });

  const isSitemapActive = activePlugins.sitemap === true;

  if (!isSitemapActive) return c.body(null, 204);

  initActivePlugins(registry, activePlugins);

  const posts = await getCached(c, "cms:posts:pub", 600, async () => {
    const rows = await db
      .prepare(
        "SELECT slug, updated_at FROM posts WHERE published = 1 ORDER BY updated_at DESC",
      )
      .all<{ slug: string; updated_at: string }>();
    return rows.results;
  });

  const baseUrl = new URL(c.req.url).origin;
  const result = await registry.executePipeline("render:sitemap", {
    baseUrl,
    posts,
  });

  return c.body(result.markup as string, 200, {
    "Content-Type": "application/xml",
  });
});

// ── Admin panel (HTML) ─────────────────────────────────────────────

app.get("/admin", async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) return c.redirect("/admin/login");
  return c.html(adminShell("Dashboard", dashboardBody()));
});

app.get("/admin/posts", async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) return auth;
  return c.html(adminShell("Posts", postsBody()));
});

app.get("/admin/new", async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) return auth;
  return c.html(adminShell("New Post", newPostBody()));
});

app.get("/admin/edit/:id", async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) return auth;
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

app.get("/admin/tags", async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) return auth;
  return c.html(adminShell("Tags", tagsBody()));
});

app.get("/admin/nav", async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) return auth;
  return c.html(adminShell("Navigation", navBody()));
});

app.get("/admin/settings", async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) return auth;
  return c.html(adminShell("Settings", settingsBody()));
});

app.get("/admin/images", async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) return auth;
  return c.html(adminShell("Image Library", imagesBody()));
});

app.get("/admin/login", (c) => {
  if (getCookie(c, SESSION_COOKIE)) return c.redirect("/admin");
  return c.html(loginForm());
});

// ── Plugin manager API ─────────────────────────────────────────────

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

// ── Admin: Settings API ────────────────────────────────────────────

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

// ── Image API ───────────────────────────────────────────────────────

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

// ── Plugin manager page ────────────────────────────────────────────

app.get("/admin/plugins", async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) return auth;
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

// ── Plugin bootstrap ──────────────────────────────────────────────

function initActivePlugins(registry: CMSRegistry, active: Record<string, boolean>): void {
  for (const p of AVAILABLE_PLUGINS) {
    if (active[p.id]) p.init(registry);
  }
}

app.get("/health", (c) => c.json({ ok: true }));

// ── RSS feed ──────────────────────────────────────────────────────

app.get("/feed.xml", async (c) => {
  const db = c.env.DB;
  const settings = await getCached(c, "cms:settings", 600, async () => await getAllSettings(db)) as Record<string, string>;
  const siteName = settings.site_name ?? "My Site";
  const posts = await db
    .prepare(
      "SELECT title, slug, excerpt, updated_at FROM posts WHERE published = 1 AND type = 'post' ORDER BY updated_at DESC LIMIT 50",
    )
    .all<{
      title: string;
      slug: string;
      excerpt: string;
      updated_at: string;
    }>();
  const baseUrl = new URL(c.req.url).origin;
  const items = posts.results
    .map(
      (p) => `
    <item>
      <title>${escXml(p.title)}</title>
      <link>${baseUrl}/${escXml(p.slug)}</link>
      <guid>${baseUrl}/${escXml(p.slug)}</guid>
      <description>${escXml(p.excerpt || p.title)}</description>
      <pubDate>${new Date(p.updated_at).toUTCString()}</pubDate>
    </item>`,
    )
    .join("");
  const xml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${escXml(siteName)}</title><link>${baseUrl}</link><description>${escXml(siteName)}</description>${items}</channel></rss>`;
  return c.body(xml, 200, { "Content-Type": "application/xml" });
});

// ── Search ──────────────────────────────────────────────────────────

app.get("/search", async (c) => {
  const q = c.req.query("q") ?? "";
  const db = c.env.DB;
  const settings = await getCached(c, "cms:settings", 600, async () => await getAllSettings(db)) as Record<string, string>;
  const siteName = settings.site_name ?? "My Site";
  const seoDescription = settings.seo_description ?? "";
  const safeQ = q.replace(/%/g, "\\%").replace(/_/g, "\\_");

  let bodyHtml = "<h1>Search</h1>";
  bodyHtml +=
    '<form action="/search" method="get" role="search" style="margin-bottom:2rem"><label for="search-input" class="sr-only" style="position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);border:0">Search</label><input type="text" id="search-input" name="q" value="' +
    esc(q) +
    '" placeholder="Search posts…" style="width:100%;padding:0.65rem;border:1px solid #cbd5e1;border-radius:4px;font-size:1rem" /><button type="submit" style="margin-top:0.5rem;padding:0.5rem 1rem;background:#0f172a;color:white;border:none;border-radius:4px;cursor:pointer;font-size:0.9rem">Search</button></form>';

  if (q) {
    const page = Math.max(1, parseInt(c.req.query("page") ?? "1", 10));
    const countRow = await db
      .prepare(
        "SELECT COUNT(*) as total FROM posts WHERE published = 1 AND type = 'post' AND (title LIKE ? ESCAPE '\\' OR content LIKE ? ESCAPE '\\')",
      )
      .bind("%" + safeQ + "%", "%" + safeQ + "%")
      .first<{ total: number }>();
    const totalPosts = countRow?.total ?? 0;
    const totalPages = Math.ceil(totalPosts / 10);

    const rows = await db
      .prepare(
        "SELECT slug, title, excerpt, updated_at FROM posts WHERE published = 1 AND type = 'post' AND (title LIKE ? ESCAPE '\\' OR content LIKE ? ESCAPE '\\') ORDER BY updated_at DESC LIMIT ? OFFSET ?",
      )
      .bind("%" + safeQ + "%", "%" + safeQ + "%", 10, (page - 1) * 10)
      .all<{
        slug: string;
        title: string;
        excerpt: string;
        updated_at: string;
      }>();
    if (rows.results.length) {
      bodyHtml += renderPostList(rows.results, "");
      bodyHtml += renderPagination(page, totalPages, "/search", { q });
    } else {
      bodyHtml +=
        '<p style="color:#64748b">No results found for "' + esc(q) + '"</p>';
    }
  }

  const registry = new CMSRegistry();
  const activePlugins = await getCached(c, "cms:plugins", 300, async () => {
    const rows = await db.prepare("SELECT id, active FROM plugins").all<{ id: string; active: number }>();
    return Object.fromEntries(rows.results.map((p) => [p.id, p.active === 1]));
  });
  initActivePlugins(registry, activePlugins);
  const headPayload = await registry.executePipeline("render:head", {
    siteName,
    title: "Search · " + siteName,
    description: seoDescription,
    markup: "",
    meta: {
      title: "Search · " + siteName,
      description: seoDescription,
      url: new URL(c.req.url).href,
    },
  });
  return c.html(
    shellFull(siteName, headPayload.markup as string, bodyHtml, []),
  );
});

// ── Tag pages ──────────────────────────────────────────────────────

app.get("/tag/:slug", async (c) => {
  const db = c.env.DB;
  const tagSlug = c.req.param("slug");
  const tag = await db
    .prepare("SELECT id, name FROM tags WHERE slug = ?")
    .bind(tagSlug)
    .first<{ id: number; name: string }>();
  if (!tag)
    return c.html(
      '<h1>Tag not found</h1><p><a href="/">Go home</a></p>',
      404,
    );

  const page = Math.max(
    1,
    parseInt(c.req.query("page") ?? "1", 10),
  );
  const countRow = await db
    .prepare(
      "SELECT COUNT(*) as total FROM posts p JOIN post_tags pt ON p.id = pt.post_id WHERE pt.tag_id = ? AND p.published = 1 AND p.type = 'post'",
    )
    .bind(tag.id)
    .first<{ total: number }>();
  const totalPosts = countRow?.total ?? 0;
  const totalPages = Math.ceil(totalPosts / 10);

  const rows = await db
    .prepare(
      "SELECT p.slug, p.title, p.excerpt, p.updated_at FROM posts p JOIN post_tags pt ON p.id = pt.post_id WHERE pt.tag_id = ? AND p.published = 1 AND p.type = 'post' ORDER BY p.updated_at DESC LIMIT ? OFFSET ?",
    )
    .bind(tag.id, 10, (page - 1) * 10)
    .all<{
      slug: string;
      title: string;
      excerpt: string;
      updated_at: string;
    }>();

  const siteName = await getCached(c, "cms:settings", 600, async () => {
    return (await getSetting(db, "site_name")) ?? "My Site";
  });
  const bodyHtml =
    '<h1 style="margin-bottom:1rem">' +
    esc(tag.name) +
    "</h1>" +
    (rows.results.length
      ? renderPostList(rows.results, "")
      : '<p style="color:#64748b">No posts with this tag.</p>') +
    renderPagination(page, totalPages, "/tag/" + esc(tagSlug), {});
  const registry = new CMSRegistry();
  const activePlugins = await getCached(c, "cms:plugins", 300, async () => {
    const rows = await db.prepare("SELECT id, active FROM plugins").all<{ id: string; active: number }>();
    return Object.fromEntries(rows.results.map((p) => [p.id, p.active === 1]));
  });
  initActivePlugins(registry, activePlugins);
  const headPayload = await registry.executePipeline("render:head", {
    siteName,
    title: tag.name + " · " + siteName,
    description: "",
    markup: "",
    meta: {
      title: tag.name + " · " + siteName,
      description: "",
      url: new URL(c.req.url).href,
    },
  });
  return c.html(
    shellFull(siteName, headPayload.markup as string, bodyHtml, []),
  );
});

// ── Admin: Tags API ────────────────────────────────────────────────

app.get("/api/admin/tags", async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) return auth;
  const rows = await c.env.DB.prepare(
    "SELECT id, name, slug FROM tags ORDER BY name",
  ).all<{ id: number; name: string; slug: string }>();
  return c.json(rows.results);
});

app.post("/api/admin/tags", async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) return auth;
  const body = await parseJsonBody(c);
  if (!body) return c.json({ error: "Invalid JSON" }, 400);
  const name = String(body.name ?? "").trim();
  const slug = String(body.slug ?? "").trim();
  if (!name || !slug) return c.json({ error: "Name and slug required" }, 400);
  await c.env.DB.prepare(
    "INSERT OR IGNORE INTO tags (name, slug) VALUES (?, ?)",
  )
    .bind(name, slug)
    .run();
  return c.json({ ok: true });
});

app.delete("/api/admin/tags/:id", async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) return auth;
  const id = c.req.param("id");
  await c.env.DB.prepare("DELETE FROM post_tags WHERE tag_id = ?").bind(id).run();
  await c.env.DB.prepare("DELETE FROM tags WHERE id = ?").bind(id).run();
  return c.json({ ok: true });
});

// ── Admin: Post tags API ───────────────────────────────────────────

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

// ── Admin: Nav menu API ────────────────────────────────────────────

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

// ── Admin: Pages (type=page) ──────────────────────────────────────

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
      .bind(title, slug, String(body.content ?? ""), body.published === true ? 1 : 0, now, now)
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
      String(body.content ?? ""),
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

// ── Image serving ──────────────────────────────────────────────────

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

// ── Public pages (catch-all — must be after all specific routes) ──

app.get("/:slug?", async (c) => {
  const registry = new CMSRegistry();
  const db = c.env.DB;
  const slug = c.req.param("slug") ?? "";

  await publishScheduled(db, c.env.CACHE);

  const [settings, navVal, plugins] = await Promise.all([
    getCached(c, "cms:settings", 600, async () => await getAllSettings(db)) as Promise<Record<string, string>>,
    getCached(c, "cms:nav", 600, async () => (await getSetting(db, "nav")) ?? "[]") as Promise<string>,
    getCached(c, "cms:plugins", 300, async () => {
      const rows = await db.prepare("SELECT id, active FROM plugins").all<{ id: string; active: number }>();
      return Object.fromEntries(rows.results.map((p) => [p.id, p.active === 1]));
    }) as Promise<Record<string, boolean>>,
  ]);

  const siteName = settings.site_name ?? "My Site";
  const seoDescription = settings.seo_description ?? "";
  const siteLogo = settings.site_logo ?? null;
  let nav: NavItem[];
  try { const p = JSON.parse(navVal); nav = Array.isArray(p) ? p : []; } catch { nav = []; }

  initActivePlugins(registry, plugins);

  if (slug) {
    const previewToken = new URL(c.req.url).searchParams.get("preview");
    let post;
    if (previewToken) {
      post = await db
        .prepare(
          "SELECT slug, title, content, excerpt, updated_at, type FROM posts WHERE slug = ? AND preview_token = ?",
        )
        .bind(slug, previewToken)
        .first<{
          slug: string;
          title: string;
          content: string;
          excerpt: string;
          updated_at: string;
          type: string;
        }>();
    } else {
      post = await db
        .prepare(
          "SELECT slug, title, content, excerpt, updated_at, type FROM posts WHERE slug = ? AND published = 1",
        )
        .bind(slug)
        .first<{
          slug: string;
          title: string;
          content: string;
          excerpt: string;
          updated_at: string;
          type: string;
        }>();
    }
    if (!post)
      return c.html(
        '<h1>404 — Not found</h1><p><a href="/">Go home</a></p>',
        404,
      );

    let bodyHtml: string;
    if (post.type === "page") {
      bodyHtml =
        "<h1>" +
        esc(post.title) +
        '</h1><div style="line-height:1.8">' +
        renderMarkdown(post.content) +
        "</div>";
    } else {
      const tagRows = await db
        .prepare(
          "SELECT t.name, t.slug FROM tags t JOIN post_tags pt ON t.id = pt.tag_id WHERE pt.post_id = (SELECT id FROM posts WHERE slug = ?)",
        )
        .bind(slug)
        .all<{ name: string; slug: string }>();
      const tags = tagRows.results;
      const tagsHtml = tags.length
        ? '<div style="color:#94a3b8;font-size:0.8rem;margin-bottom:1rem">' +
          tags
            .map(
              (t) =>
                '<a href="/tag/' +
                esc(t.slug) +
                '" style="color:#3b82f6;text-decoration:none">' +
                esc(t.name) +
                "</a>",
            )
            .join(" · ") +
          "</div>"
        : "";
      bodyHtml =
        '<p style="margin-bottom:2rem"><a href="/" style="color:#3b82f6;text-decoration:none">← Back to home</a></p>' +
        renderPost(post) +
        tagsHtml;
    }

    const origin = new URL(c.req.url).origin;
    const headPayload = await registry.executePipeline("render:head", {
      siteName,
      title: post.title,
      description: post.excerpt ?? "",
      markup: "",
      meta: {
        title: post.title,
        description: post.excerpt ?? "",
        url: origin + c.req.path,
        image: extractFirstImage(post.content, origin) ?? (siteLogo ? origin + siteLogo : ""),
      },
    });
    const bodyPayload = await registry.executePipeline("render:body", {
      bodyHtml,
      post,
      siteName,
      DB: db,
    });
    bodyHtml = (bodyPayload.bodyHtml as string) ?? bodyHtml;
    return c.html(
      shellFull(siteName, headPayload.markup as string, bodyHtml, nav),
    );
  }

  const page = Math.max(1, parseInt(c.req.query("page") ?? "1", 10));
  const countRow = await db
    .prepare(
      "SELECT COUNT(*) as total FROM posts WHERE published = 1 AND type = 'post'",
    )
    .first<{ total: number }>();
  const totalPosts = countRow?.total ?? 0;
  const totalPages = Math.ceil(totalPosts / 10);
  const limit = 10;
  const offset = (page - 1) * limit;

  const rows = await db
    .prepare(
      "SELECT slug, title, excerpt, updated_at FROM posts WHERE published = 1 AND type = 'post' ORDER BY updated_at DESC LIMIT ? OFFSET ?",
    )
    .bind(limit, offset)
    .all<{
      slug: string;
      title: string;
      excerpt: string;
      updated_at: string;
    }>();

  const origin = new URL(c.req.url).origin;
  const meta = {
    title: siteName,
    description: seoDescription,
    url: origin + c.req.path,
    image: siteLogo ? origin + siteLogo : "",
  };
  const rssLink =
    '<link rel="alternate" type="application/rss+xml" title="' +
    esc(siteName) +
    '" href="/feed.xml" />';
  const headPayload = await registry.executePipeline("render:head", {
    siteName,
    title: siteName,
    description: "",
    markup: rssLink,
    meta,
  });
  let bodyHtml = rows.results.length
    ? renderPostList(rows.results, siteName)
    : renderHomepage(siteName);
  bodyHtml += renderPagination(page, totalPages, "/", {});
  const bodyPayload = await registry.executePipeline("render:body", {
    bodyHtml,
    siteName,
    DB: db,
  });
  bodyHtml = (bodyPayload.bodyHtml as string) ?? bodyHtml;
  return c.html(
    shellFull(siteName, headPayload.markup as string, bodyHtml, nav),
  );
});

export default app;

// ══════════════════════════════════════════════════════════════════
//  Render helpers
// ══════════════════════════════════════════════════════════════════

const THEME_CSS = themeCss;

function shellFull(
  siteName: string,
  headMarkup: string,
  bodyHtml: string,
  nav: NavItem[],
): string {
  const navHtml = nav
    .map((n) => '<a href="' + esc(n.url) + '">' + esc(n.label) + "</a>")
    .join("");
  const adminLink = '<a href="/admin/login" style="color:#f97316">Admin</a>';
  return (
    '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>' +
    esc(siteName) +
    '</title><link rel="sitemap" type="application/xml" href="/sitemap.xml" /><link rel="alternate" type="application/rss+xml" title="' +
    esc(siteName) +
    '" href="/feed.xml" /><style>' +
    THEME_CSS +
    "</style>" +
    headMarkup +
    '</head><body><a href="#main" class="sr-only" style="position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);border:0">Skip to content</a><header><div class="inner"><a href="/" class="site-name">' +
    esc(siteName) +
    '</a><nav>' +
    navHtml +
    adminLink +
    "</nav></div></header><main id=\"main\">" +
    bodyHtml +
    "</main><footer>Powered by PHCloud CMS on Cloudflare Workers</footer></body></html>"
  );
}

function renderPost(post: {
  title: string;
  content: string;
  updated_at: string;
}): string {
  const date = new Date(post.updated_at).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  return (
    "<h1>" +
    esc(post.title) +
    '</h1><div style="color:#64748b;font-size:0.85rem;margin-bottom:2rem;">' +
    date +
    '</div><div style="line-height:1.8;">' +
    renderMarkdown(post.content) +
    "</div>"
  );
}

function renderHomepage(siteName: string): string {
  return (
    "<h1>" +
    esc(siteName) +
    '</h1><p style="color:#64748b;margin-bottom:2rem;">Welcome. Content served from Cloudflare D1.</p><p style="color:#64748b;"><a href="/admin/login">Log in</a> to manage your site.</p>'
  );
}

function renderPostList(
  posts: { slug: string; title: string; excerpt: string; updated_at: string }[],
  siteName: string,
): string {
  if (!posts.length) return renderHomepage(siteName);
  let html =
    '<h1 style="margin-bottom:2rem">' +
    esc(siteName) +
    '</h1><div style="display:flex;flex-direction:column;gap:1.5rem">';
  for (const p of posts) {
    const date = new Date(p.updated_at).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    html +=
      '<article style="border-bottom:1px solid #e5e7eb;padding-bottom:1.5rem">';
    html +=
      '<h2 style="font-size:1.15rem;margin-bottom:0.3rem"><a href="/' +
      esc(p.slug) +
      '" style="color:#0f172a;text-decoration:none">' +
      esc(p.title) +
      "</a></h2>";
    html +=
      '<div style="color:#94a3b8;font-size:0.8rem;margin-bottom:0.5rem">' +
      date +
      "</div>";
    if (p.excerpt)
      html +=
        '<p style="color:#64748b;line-height:1.6">' + esc(p.excerpt) + "</p>";
    html +=
      '<a href="/' +
      esc(p.slug) +
      '" style="color:#3b82f6;font-size:0.85rem;text-decoration:none">Read more →</a>';
    html += "</article>";
  }
  html += "</div>";
  return html;
}

function renderPagination(
  page: number,
  totalPages: number,
  basePath: string,
  additionalParams: Record<string, string>,
): string {
  if (totalPages <= 1) return "";
  const buildUrl = (p: number): string => {
    const params = new URLSearchParams(additionalParams);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return basePath + (qs ? "?" + qs : "");
  };
  let html =
    '<nav style="display:flex;justify-content:center;gap:0.5rem;margin-top:2rem;align-items:center">';
  if (page > 1)
    html +=
      '<a href="' +
      esc(buildUrl(page - 1)) +
      '" style="padding:0.4rem 0.8rem;border:1px solid #e5e7eb;border-radius:4px;text-decoration:none;color:#3b82f6">← Prev</a>';
  const startPage = Math.max(1, page - 2);
  const endPage = Math.min(totalPages, page + 2);
  if (startPage > 1) html += '<span style="color:#94a3b8">…</span>';
  for (let i = startPage; i <= endPage; i++) {
    if (i === page) {
      html +=
        '<span style="padding:0.4rem 0.8rem;background:#0f172a;color:white;border-radius:4px;font-weight:600">' +
        i +
        "</span>";
    } else {
      html +=
        '<a href="' +
        esc(buildUrl(i)) +
        '" style="padding:0.4rem 0.8rem;border:1px solid #e5e7eb;border-radius:4px;text-decoration:none;color:#3b82f6">' +
        i +
        "</a>";
    }
  }
  if (endPage < totalPages) html += '<span style="color:#94a3b8">…</span>';
  if (page < totalPages)
    html +=
      '<a href="' +
      esc(buildUrl(page + 1)) +
      '" style="padding:0.4rem 0.8rem;border:1px solid #e5e7eb;border-radius:4px;text-decoration:none;color:#3b82f6">Next →</a>';
  html += "</nav>";
  return html;
}

function extractFirstImage(content: string, origin: string): string | null {
  const match = content.match(/!\[.*?\]\((\/img\/\d+)\)/);
  return match ? origin + match[1] : null;
}
