// src/routes/public.ts — read-only public surface: homepage, posts, pages,
// tag pages, search, RSS feed, sitemap.xml, /health, and the catch-all.
// The catch-all MUST be registered after every specific route so /:slug?
// doesn't shadow them — index.ts calls registerPublicRoutes() last.
// (Phase 2c extraction from index.ts.)

import { App } from "../cms/env.js";
import { getCached } from "../cms/middleware.js";
import { getSetting, getAllSettings } from "../cms/d1.js";
import { CMSRegistry } from "../cms/registry.js";
import { initActivePlugins } from "../plugins/index.js";
import { esc, escXml } from "../cms/escape.js";
import { sanitizePostHtml } from "../cms/sanitize.js";
import {
  NavItem,
  extractFirstImage,
  renderPost,
  renderPostList,
  renderPagination,
  renderHomepage,
  shellFull,
} from "../cms/render.js";

// Publish any posts whose scheduled publish_at has passed. Cheap KV gate
// so the catch-all doesn't run the UPDATE more than once a minute.
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

export function registerPublicRoutes(app: App): void {
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
          sanitizePostHtml(post.content) +
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
}
