import { Hono } from 'hono';
import type { Context } from 'hono';
import { CMSRegistry } from './cms/registry.js';
import { onboardingGuard, getCached } from './cms/middleware.js';
import { migrate, seed, isConfigured, getSetting } from './cms/d1.js';
import { hashPassword, verifyPassword } from './cms/auth.js';
import { AVAILABLE_PLUGINS } from './plugins/index.js';
import { initSEOPlugin } from './plugins/seo.js';
import { initSitemapPlugin } from './plugins/sitemap.js';
import { getCookie, setCookie } from 'hono/cookie';
import { adminShell, dashboardBody, postsBody, newPostBody, editBody, loginForm, pluginsBody, pagesBody, newPageBody, editPageBody, categoriesBody, navBody, settingsBody } from './admin.js';

type Post = { title: string; content: string; updated_at: string };
type DbPost = Post & { id: number; slug: string; excerpt: string; published: number; type: string; publish_at: string | null; preview_token: string | null };
type NavItem = { label: string; url: string };

function autoExcerpt(content: string): string {
  const text = content.replace(/[#*>`\[\]!\-]/g, '').replace(/\s+/g, ' ').trim();
  return text.slice(0, 160) + (text.length > 160 ? '…' : '');
}

async function publishScheduled(db: D1Database): Promise<void> {
  const now = new Date().toISOString();
  await db.prepare(
    "UPDATE posts SET published=1, publish_at=NULL WHERE publish_at IS NOT NULL AND publish_at <= ?"
  ).bind(now).run();
}

type Env = {
  DB: D1Database;
  CACHE: KVNamespace;
};

const SESSION_COOKIE = 'phcloudcms_session';
const SESSION_TTL = 7 * 24 * 60 * 60;

const app = new Hono<{ Bindings: Env }>();

app.use('*', onboardingGuard);

// ── Auth ──────────────────────────────────────────────────────────

app.post('/api/auth/login', async (c) => {
  const { username, password } = await c.req.json<{ username?: string; password?: string }>();
  const db = c.env.DB;
  const admin = await db.prepare(
    "SELECT id, password_hash FROM admins WHERE username = ?"
  ).bind(String(username ?? '')).first<{ id: number; password_hash: string }>();

  if (!admin) return c.body(JSON.stringify({ error: 'Invalid credentials' }), 401, { 'Content-Type': 'application/json' });

  const valid = await verifyPassword(String(password ?? ''), admin.password_hash);
  if (!valid) return c.body(JSON.stringify({ error: 'Invalid credentials' }), 401, { 'Content-Type': 'application/json' });

  const sessionId = crypto.randomUUID();
  await c.env.CACHE.put(`session:${sessionId}`, String(admin.id), { expirationTtl: SESSION_TTL });
  setCookie(c, SESSION_COOKIE, sessionId, { maxAge: SESSION_TTL, path: '/', httpOnly: true, sameSite: 'Lax', secure: true });
  return c.json({ ok: true, sessionId });
});

app.post('/api/auth/logout', async (c) => {
  const sessionId = getCookie(c, SESSION_COOKIE);
  if (sessionId) await c.env.CACHE.delete(`session:${sessionId}`);
  setCookie(c, SESSION_COOKIE, '', { maxAge: 0, path: '/', httpOnly: true, sameSite: 'Lax', secure: true });
  return c.json({ ok: true });
});

async function requireAuth(c: Context): Promise<number | Response> {
  const sessionId = getCookie(c, SESSION_COOKIE);
  if (!sessionId) return c.body(JSON.stringify({ error: 'Unauthorized' }), 401, { 'Content-Type': 'application/json' });
  const val = await c.env.CACHE.get(`session:${sessionId}`);
  if (!val) return c.body(JSON.stringify({ error: 'Invalid session' }), 401, { 'Content-Type': 'application/json' });
  return parseInt(val, 10);
}

// ── Admin: Posts CRUD ──────────────────────────────────────────────

app.post('/api/admin/posts', async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) return auth;

  const body = await c.req.json<{
    title?: string;
    slug?: string;
    content?: string;
    excerpt?: string;
    published?: boolean;
    publish_at?: string | null;
    category_ids?: number[];
  }>();
  const db = c.env.DB;
  const now = new Date().toISOString();
  const publishAt = body.publish_at || null;
  const published = body.publish_at ? 0 : (body.published === true ? 1 : 0);
  const previewToken = crypto.randomUUID();
  const content = body.content ?? '';
  const excerpt = body.excerpt || autoExcerpt(content);
  const result = await db.prepare(
    "INSERT INTO posts (title, slug, content, excerpt, published, publish_at, preview_token, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).bind(
    body.title ?? '',
    body.slug ?? '',
    content,
    excerpt,
    published,
    publishAt,
    previewToken,
    now,
    now,
  ).run();

  const postId = result.meta.last_row_id;
  if (body.category_ids?.length) {
    for (const cid of body.category_ids) {
      await db.prepare("INSERT OR IGNORE INTO post_categories (post_id, category_id) VALUES (?, ?)").bind(postId, cid).run();
    }
  }

  await c.env.CACHE.delete('cms:posts:pub');
  await c.env.CACHE.delete('cms:homepage');
  return c.json({ id: postId, preview_token: previewToken });
});

app.get('/api/admin/posts', async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) return auth;

  const rows = await c.env.DB.prepare(
    "SELECT id, title, slug, published, publish_at, updated_at FROM posts ORDER BY updated_at DESC"
  ).all<{ id: number; title: string; slug: string; published: number; publish_at: string | null; updated_at: string }>();
  return c.json(rows.results);
});

app.get('/api/admin/posts/:id', async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) return auth;

  const id = c.req.param('id');
  const post = await c.env.DB.prepare("SELECT * FROM posts WHERE id = ?").bind(id).first<DbPost>();
  if (!post) return c.body(JSON.stringify({ error: 'Not found' }), 404, { 'Content-Type': 'application/json' });
  return c.json(post);
});

app.patch('/api/admin/posts/:id', async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) return auth;

  const id = c.req.param('id');
  const body = await c.req.json<{
    title?: string;
    slug?: string;
    content?: string;
    excerpt?: string;
    published?: boolean;
    publish_at?: string | null;
    category_ids?: number[];
  }>();
  const now = new Date().toISOString();
  const publishAt = body.publish_at || null;
  const published = body.publish_at ? 0 : (body.published === true ? 1 : 0);
  const previewToken = crypto.randomUUID();
  const content = body.content ?? '';
  const excerpt = body.excerpt || autoExcerpt(content);

  await c.env.DB.prepare(
    "UPDATE posts SET title=?, slug=?, content=?, excerpt=?, published=?, publish_at=?, preview_token=?, updated_at=? WHERE id=?"
  ).bind(
    body.title ?? '',
    body.slug ?? '',
    content,
    excerpt,
    published,
    publishAt,
    previewToken,
    now,
    id,
  ).run();

  if (body.category_ids) {
    await c.env.DB.prepare("DELETE FROM post_categories WHERE post_id = ?").bind(id).run();
    for (const cid of body.category_ids) {
      await c.env.DB.prepare("INSERT OR IGNORE INTO post_categories (post_id, category_id) VALUES (?, ?)").bind(id, cid).run();
    }
  }

  await c.env.CACHE.delete('cms:posts:pub');
  await c.env.CACHE.delete('cms:homepage');
  return c.json({ ok: true, preview_token: previewToken });
});

app.delete('/api/admin/posts/:id', async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) return auth;

  await c.env.DB.prepare("DELETE FROM posts WHERE id = ?").bind(c.req.param('id')).run();
  await c.env.CACHE.delete('cms:posts:pub');
  await c.env.CACHE.delete('cms:homepage');
  await c.env.CACHE.delete('cms:config');
  return c.json({ ok: true });
});

app.patch('/api/admin/posts/:id/publish', async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) return auth;
  const now = new Date().toISOString();
  await c.env.DB.prepare(
    "UPDATE posts SET published=1, publish_at=NULL, updated_at=? WHERE id=?"
  ).bind(now, c.req.param('id')).run();
  await c.env.CACHE.delete('cms:posts:pub');
  await c.env.CACHE.delete('cms:homepage');
  return c.json({ ok: true });
});

app.patch('/api/admin/posts/:id/unpublish', async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) return auth;
  const now = new Date().toISOString();
  await c.env.DB.prepare(
    "UPDATE posts SET published=0, updated_at=? WHERE id=?"
  ).bind(now, c.req.param('id')).run();
  await c.env.CACHE.delete('cms:posts:pub');
  await c.env.CACHE.delete('cms:homepage');
  return c.json({ ok: true });
});

// ── Install wizard ────────────────────────────────────────────────

app.post('/api/install', async (c) => {
  const db = c.env.DB;
  try {
    const body = await c.req.parseBody();
    const siteName = String(body.siteName ?? 'My Site');
    const adminPassword = String(body.adminPassword ?? '');
    if (adminPassword.length < 8) {
      return c.body(JSON.stringify({ error: 'Password must be at least 8 characters' }), 400, { 'Content-Type': 'application/json' });
    }

    await migrate(db);
    await seed(db, siteName);

    const seo = body.plugin_seo === 'on';
    const sitemap = body.plugin_sitemap === 'on';
    for (const p of AVAILABLE_PLUGINS) {
      await db.prepare("INSERT OR IGNORE INTO plugins (id, active) VALUES (?, 0)").bind(p.id).run();
    }
    if (seo) await db.prepare("UPDATE plugins SET active = 1 WHERE id = 'seo'").run();
    if (sitemap) await db.prepare("UPDATE plugins SET active = 1 WHERE id = 'sitemap'").run();

    const adminUsername = String(body.adminUsername ?? 'admin');
    const adminPasswordHash = await hashPassword(adminPassword);
    const result = await db.prepare("INSERT OR REPLACE INTO admins (username, password_hash) VALUES (?, ?)")
      .bind(adminUsername, adminPasswordHash).run();

    // Set configured status LAST so partial failures don't lock out re-install
    await db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('status', 'configured')").run();

    await c.env.CACHE.delete('cms:config');

    // Auto-login after install (return JSON, not redirect — fetch() doesn't
    // reliably set cookies from redirect responses on all platforms)
    const sessionId = crypto.randomUUID();
    const adminId = result.meta.last_row_id;
    await c.env.CACHE.put(`session:${sessionId}`, String(adminId), { expirationTtl: SESSION_TTL });
    setCookie(c, SESSION_COOKIE, sessionId, { maxAge: SESSION_TTL, path: '/', httpOnly: true, sameSite: 'Lax', secure: true });
    return c.json({ ok: true });
  } catch (err) {
    // Surface the real error so install failures are diagnosable from the
    // wizard UI instead of a generic "Check your D1 binding".
    return c.body(JSON.stringify({ error: 'install_failed', detail: String(err) }), 500, { 'Content-Type': 'application/json' });
  }
});

// ── Sitemap ───────────────────────────────────────────────────────

app.get('/sitemap.xml', async (c) => {
  const registry = new CMSRegistry();
  const db = c.env.DB;

  const activePlugins = await getCached(c, 'cms:plugins', 300, async () => {
    const rows = await db.prepare("SELECT id, active FROM plugins").all<{ id: string; active: number }>();
    return Object.fromEntries(rows.results.map((p) => [p.id, p.active === 1]));
  });

  const isSitemapActive = activePlugins.sitemap === true;

  if (!isSitemapActive) return c.body(null, 204);

  initActivePlugins(registry, activePlugins);

  const posts = await getCached(c, 'cms:posts:pub', 600, async () => {
    const rows = await db.prepare(
      "SELECT slug, updated_at FROM posts WHERE published = 1 ORDER BY updated_at DESC"
    ).all<{ slug: string; updated_at: string }>();
    return rows.results;
  });

  const baseUrl = new URL(c.req.url).origin;
  const result = await registry.executePipeline('render:sitemap', { baseUrl, posts });

  return c.body(result.markup as string, 200, { 'Content-Type': 'application/xml' });
});

// ── Admin panel (HTML) ─────────────────────────────────────────────

app.get('/admin', async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) return auth;
  return c.html(adminShell('Dashboard', dashboardBody()));
});

app.get('/admin/posts', async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) return auth;
  return c.html(adminShell('Posts', postsBody()));
});

app.get('/admin/new', async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) return auth;
  return c.html(adminShell('New Post', newPostBody()));
});

app.get('/admin/edit/:id', async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) return auth;
  const id = c.req.param('id');
  const post = await c.env.DB.prepare("SELECT * FROM posts WHERE id = ?").bind(id).first<DbPost>();
  if (!post) return c.notFound();
  return c.html(adminShell('Edit Post', editBody({ id: post.id, title: post.title, slug: post.slug, content: post.content, excerpt: post.excerpt, published: post.published, publish_at: post.publish_at, preview_token: post.preview_token, updated_at: post.updated_at })));
});

app.get('/admin/pages', async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) return auth;
  return c.html(adminShell('Pages', pagesBody()));
});

app.get('/admin/pages/new', async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) return auth;
  return c.html(adminShell('New Page', newPageBody()));
});

app.get('/admin/pages/edit/:id', async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) return auth;
  const id = c.req.param('id');
  const page = await c.env.DB.prepare("SELECT id, title, slug, content, published, updated_at FROM posts WHERE id = ? AND type = 'page'").bind(id).first<{ id: number; title: string; slug: string; content: string; published: number; updated_at: string }>();
  if (!page) return c.notFound();
  return c.html(adminShell('Edit Page', editPageBody(page)));
});

app.get('/admin/categories', async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) return auth;
  return c.html(adminShell('Categories', categoriesBody()));
});

app.get('/admin/nav', async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) return auth;
  return c.html(adminShell('Navigation', navBody()));
});

app.get('/admin/settings', async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) return auth;
  return c.html(adminShell('Settings', settingsBody()));
});

app.get('/admin/login', (c) => {
  if (getCookie(c, SESSION_COOKIE)) return c.redirect('/admin');
  return c.html(loginForm());
});

// ── Plugin manager API ─────────────────────────────────────────────

app.patch('/api/admin/plugins/:id', async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) return auth;
  const id = c.req.param('id');
  const { active } = await c.req.json<{ active?: boolean }>();
  await c.env.DB.prepare("UPDATE plugins SET active = ? WHERE id = ?").bind(active === true ? 1 : 0, id).run();
  await c.env.CACHE.delete('cms:plugins');
  return c.json({ ok: true });
});

// ── Image upload proxy ──────────────────────────────────────────────

app.post('/api/upload', async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) return auth;
  const formData = await c.req.raw.formData();
  const file = formData.get('image') as File | null;
  if (!file) return c.json({ error: 'No image file provided' }, 400);
  const buf = await file.arrayBuffer();
  const clientId = 'dcd01ec7c5a4cca';
  const boundary = '----Boundary' + Math.random().toString(36).slice(2);
  const enc = (s: string) => new TextEncoder().encode(s);
  const header = enc('--' + boundary + '\r\nContent-Disposition: form-data; name="image"\r\n\r\n');
  const footer = enc('\r\n--' + boundary + '--\r\n');
  const body = new Uint8Array(header.byteLength + buf.byteLength + footer.byteLength);
  body.set(header, 0);
  body.set(new Uint8Array(buf), header.byteLength);
  body.set(footer, header.byteLength + buf.byteLength);
  const res = await fetch('https://api.imgur.com/3/image', {
    method: 'POST',
    headers: { 'Content-Type': 'multipart/form-data; boundary=' + boundary, 'Authorization': 'Client-ID ' + clientId },
    body
  });
  const data = await res.json() as Record<string, unknown>;
  if ((data as Record<string, unknown>).success && (data as Record<string, unknown>).data) {
    const link = ((data as Record<string, unknown>).data as Record<string, unknown>).link as string | undefined;
    if (link) return c.json({ url: link });
  }
  return c.json({ error: JSON.stringify(data) }, 500);
});

// ── Plugin manager page ────────────────────────────────────────────

app.get('/admin/plugins', async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) return auth;
  const rows = await c.env.DB.prepare("SELECT id, active FROM plugins").all<{ id: string; active: number }>();
  const activeSet = new Set(rows.results.filter((p) => p.active === 1).map((p) => p.id));
  return c.html(adminShell('Plugins', pluginsBody(AVAILABLE_PLUGINS, activeSet)));
});

// ── Plugin bootstrap ──────────────────────────────────────────────

function initActivePlugins(registry: CMSRegistry, active: Record<string, boolean>): void {
  if (active.seo) initSEOPlugin(registry);
  if (active.sitemap) initSitemapPlugin(registry);
  // new plugins: add an `if (active.<id>)` line here
}

app.get('/health', (c) => c.json({ ok: true }));

// ── RSS feed ──────────────────────────────────────────────────────

app.get('/feed.xml', async (c) => {
  const db = c.env.DB;
  const siteName = await getCached(c, 'cms:config', 600, async () => {
    return await getSetting(db, 'site_name') ?? 'My Site';
  });
  const posts = await db.prepare(
    "SELECT title, slug, excerpt, updated_at FROM posts WHERE published = 1 AND type = 'post' ORDER BY updated_at DESC LIMIT 50"
  ).all<{ title: string; slug: string; excerpt: string; updated_at: string }>();
  const baseUrl = new URL(c.req.url).origin;
  const items = posts.results.map((p) => `
    <item>
      <title>${escXml(p.title)}</title>
      <link>${baseUrl}/${escXml(p.slug)}</link>
      <guid>${baseUrl}/${escXml(p.slug)}</guid>
      <description>${escXml(p.excerpt || p.title)}</description>
      <pubDate>${new Date(p.updated_at).toUTCString()}</pubDate>
    </item>`).join('');
  const xml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${escXml(siteName)}</title><link>${baseUrl}</link><description>${escXml(siteName)}</description>${items}</channel></rss>`;
  return c.body(xml, 200, { 'Content-Type': 'application/xml' });
});

// ── Search ──────────────────────────────────────────────────────────

app.get('/search', async (c) => {
  const q = c.req.query('q') ?? '';
  const db = c.env.DB;
  const siteName = await getCached(c, 'cms:config', 600, async () => {
    return await getSetting(db, 'site_name') ?? 'My Site';
  });

  let bodyHtml = '<h1>Search</h1>';
  bodyHtml += '<form action="/search" method="get" style="margin-bottom:2rem"><input type="text" name="q" value="' + esc(q) + '" placeholder="Search posts…" style="width:100%;padding:0.65rem;border:1px solid #cbd5e1;border-radius:4px;font-size:1rem"/></form>';

  if (q) {
    const rows = await db.prepare(
      "SELECT slug, title, excerpt, updated_at FROM posts WHERE published = 1 AND type = 'post' AND (title LIKE ? OR content LIKE ?) ORDER BY updated_at DESC"
    ).bind('%' + q + '%', '%' + q + '%').all<{ slug: string; title: string; excerpt: string; updated_at: string }>();
    if (rows.results.length) {
      bodyHtml += renderPostList(rows.results, '');
    } else {
      bodyHtml += '<p style="color:#64748b">No results found for "' + esc(q) + '"</p>';
    }
  }

  const registry = new CMSRegistry();
  const headPayload = await registry.executePipeline('render:head', { siteName, title: 'Search · ' + siteName, description: '', markup: '', meta: { title: 'Search · ' + siteName, description: '', url: new URL(c.req.url).href } });
  return c.html(shellFull(siteName, headPayload.markup as string, bodyHtml, []));
});

// ── Category pages ─────────────────────────────────────────────────

app.get('/category/:slug', async (c) => {
  const db = c.env.DB;
  const catSlug = c.req.param('slug');
  const cat = await db.prepare("SELECT id, name FROM categories WHERE slug = ?").bind(catSlug).first<{ id: number; name: string }>();
  if (!cat) return c.html('<h1>Category not found</h1><p><a href="/">Go home</a></p>', 404);

  const rows = await db.prepare(
    "SELECT p.slug, p.title, p.excerpt, p.updated_at FROM posts p JOIN post_categories pc ON p.id = pc.post_id WHERE pc.category_id = ? AND p.published = 1 ORDER BY p.updated_at DESC"
  ).bind(cat.id).all<{ slug: string; title: string; excerpt: string; updated_at: string }>();

  const siteName = await getCached(c, 'cms:config', 600, async () => {
    return await getSetting(db, 'site_name') ?? 'My Site';
  });
  const bodyHtml = '<h1 style="margin-bottom:1rem">' + esc(cat.name) + '</h1>' + (rows.results.length ? renderPostList(rows.results, '') : '<p style="color:#64748b">No posts in this category.</p>');
  const registry = new CMSRegistry();
  const headPayload = await registry.executePipeline('render:head', { siteName, title: cat.name + ' · ' + siteName, description: '', markup: '', meta: { title: cat.name + ' · ' + siteName, description: '', url: new URL(c.req.url).href } });
  return c.html(shellFull(siteName, headPayload.markup as string, bodyHtml, []));
});

// ── Admin: Categories API ──────────────────────────────────────────

app.get('/api/admin/categories', async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) return auth;
  const rows = await c.env.DB.prepare("SELECT id, name, slug FROM categories ORDER BY name").all<{ id: number; name: string; slug: string }>();
  return c.json(rows.results);
});

app.post('/api/admin/categories', async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) return auth;
  const { name, slug } = await c.req.json<{ name?: string; slug?: string }>();
  if (!name || !slug) return c.body(JSON.stringify({ error: 'Name and slug required' }), 400, { 'Content-Type': 'application/json' });
  await c.env.DB.prepare("INSERT OR IGNORE INTO categories (name, slug) VALUES (?, ?)").bind(name, slug).run();
  return c.json({ ok: true });
});

app.delete('/api/admin/categories/:id', async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) return auth;
  await c.env.DB.prepare("DELETE FROM post_categories WHERE category_id = ?").bind(c.req.param('id')).run();
  await c.env.DB.prepare("DELETE FROM categories WHERE id = ?").bind(c.req.param('id')).run();
  return c.json({ ok: true });
});

// ── Admin: Post categories API ─────────────────────────────────────

app.get('/api/admin/posts/:id/categories', async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) return auth;
  const rows = await c.env.DB.prepare(
    "SELECT c.id, c.name FROM categories c JOIN post_categories pc ON c.id = pc.category_id WHERE pc.post_id = ?"
  ).bind(c.req.param('id')).all<{ id: number; name: string }>();
  return c.json(rows.results);
});

// ── Admin: Nav menu API ────────────────────────────────────────────

app.post('/api/admin/nav', async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) return auth;
  const { items } = await c.req.json<{ items: NavItem[] }>();
  await c.env.DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('nav', ?)").bind(JSON.stringify(items)).run();
  await c.env.CACHE.delete('cms:config');
  return c.json({ ok: true });
});

app.get('/api/admin/nav', async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) return auth;
  const val = await getSetting(c.env.DB, 'nav');
  return c.json(val ? JSON.parse(val) : []);
});

// ── Admin: Pages (type=page) ──────────────────────────────────────

app.post('/api/admin/pages', async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) return auth;
  const body = await c.req.json<{ title?: string; slug?: string; content?: string; published?: boolean }>();
  const db = c.env.DB;
  const now = new Date().toISOString();
  const result = await db.prepare(
    "INSERT INTO posts (title, slug, content, excerpt, type, published, created_at, updated_at) VALUES (?, ?, ?, '', 'page', ?, ?, ?)"
  ).bind(body.title ?? '', body.slug ?? '', body.content ?? '', body.published === true ? 1 : 0, now, now).run();
  await c.env.CACHE.delete('cms:homepage');
  return c.json({ id: result.meta.last_row_id });
});

app.get('/api/admin/pages', async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) return auth;
  const rows = await c.env.DB.prepare(
    "SELECT id, title, slug, published, updated_at FROM posts WHERE type = 'page' ORDER BY updated_at DESC"
  ).all<{ id: number; title: string; slug: string; published: number; updated_at: string }>();
  return c.json(rows.results);
});

app.get('/api/admin/pages/:id', async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) return auth;
  const post = await c.env.DB.prepare("SELECT * FROM posts WHERE id = ? AND type = 'page'").bind(c.req.param('id')).first<DbPost>();
  if (!post) return c.body(JSON.stringify({ error: 'Not found' }), 404, { 'Content-Type': 'application/json' });
  return c.json(post);
});

app.patch('/api/admin/pages/:id', async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) return auth;
  const body = await c.req.json<{ title?: string; slug?: string; content?: string; published?: boolean }>();
  const now = new Date().toISOString();
  await c.env.DB.prepare(
    "UPDATE posts SET title=?, slug=?, content=?, published=?, updated_at=? WHERE id=? AND type='page'"
  ).bind(body.title ?? '', body.slug ?? '', body.content ?? '', body.published === true ? 1 : 0, now, c.req.param('id')).run();
  await c.env.CACHE.delete('cms:homepage');
  return c.json({ ok: true });
});

app.delete('/api/admin/pages/:id', async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) return auth;
  await c.env.DB.prepare("DELETE FROM posts WHERE id = ? AND type = 'page'").bind(c.req.param('id')).run();
  await c.env.CACHE.delete('cms:homepage');
  return c.json({ ok: true });
});

// ── Public pages (catch-all — must be after all specific routes) ──

app.get('/:slug?', async (c) => {
  const registry = new CMSRegistry();
  const db = c.env.DB;
  const slug = c.req.param('slug') ?? '';

  await publishScheduled(db);

  const [siteName, navVal, plugins] = await Promise.all([
    getCached(c, 'cms:config', 600, async () => await getSetting(db, 'site_name') ?? 'My Site') as Promise<string>,
    getCached(c, 'cms:nav', 600, async () => await getSetting(db, 'nav') ?? '[]') as Promise<string>,
    getCached(c, 'cms:plugins', 300, async () => {
      const rows = await db.prepare("SELECT id, active FROM plugins").all<{ id: string; active: number }>();
      return Object.fromEntries(rows.results.map((p) => [p.id, p.active === 1]));
    }) as Promise<Record<string, boolean>>,
  ]);

  const nav: NavItem[] = JSON.parse(navVal);

  initActivePlugins(registry, plugins);

  if (slug) {
    const previewToken = new URL(c.req.url).searchParams.get('preview');
    let post;
    if (previewToken) {
      post = await db.prepare(
        "SELECT slug, title, content, excerpt, updated_at, type FROM posts WHERE slug = ? AND preview_token = ?"
      ).bind(slug, previewToken).first<{ slug: string; title: string; content: string; excerpt: string; updated_at: string; type: string }>();
    } else {
      post = await db.prepare(
        "SELECT slug, title, content, excerpt, updated_at, type FROM posts WHERE slug = ? AND published = 1"
      ).bind(slug).first<{ slug: string; title: string; content: string; excerpt: string; updated_at: string; type: string }>();
    }
    if (!post) return c.html('<h1>404 — Not found</h1><p><a href="/">Go home</a></p>', 404);

    let bodyHtml: string;
    if (post.type === 'page') {
      bodyHtml = '<h1>' + esc(post.title) + '</h1><div style="line-height:1.8">' + markdownToHtml(post.content) + '</div>';
    } else {
      const catRows = await db.prepare(
        "SELECT c.name FROM categories c JOIN post_categories pc ON c.id = pc.category_id WHERE pc.post_id = (SELECT id FROM posts WHERE slug = ?)"
      ).bind(slug).all<{ name: string }>();
      const cats = catRows.results.map((c) => c.name);
      const catsHtml = cats.length ? '<div style="color:#94a3b8;font-size:0.8rem;margin-bottom:1rem">' + cats.map((n) => '<a href="/category/' + esc(n.toLowerCase().replace(/\s+/g, '-')) + '" style="color:#3b82f6;text-decoration:none">' + esc(n) + '</a>').join(' · ') + '</div>' : '';
      bodyHtml = '<p style="margin-bottom:2rem"><a href="/" style="color:#3b82f6;text-decoration:none">← Back to home</a></p>' + renderPost(post) + catsHtml;
    }

    const headPayload = await registry.executePipeline('render:head', { siteName, title: post.title, description: post.excerpt ?? '', markup: '', meta: { title: post.title, description: post.excerpt ?? '', url: new URL(c.req.url).href } });
    const bodyPayload = await registry.executePipeline('render:body', { bodyHtml, post, siteName });
    bodyHtml = (bodyPayload.bodyHtml as string) ?? bodyHtml;
    return c.html(shellFull(siteName, headPayload.markup as string, bodyHtml, nav));
  }

  const rows = await getCached(c, 'cms:homepage', 60, async () => {
    const r = await db.prepare(
      "SELECT slug, title, excerpt, updated_at FROM posts WHERE published = 1 AND type = 'post' ORDER BY updated_at DESC"
    ).all<{ slug: string; title: string; excerpt: string; updated_at: string }>();
    return r.results;
  });

  const meta = { title: siteName, description: '', url: new URL(c.req.url).href };
  const rssLink = '<link rel="alternate" type="application/rss+xml" title="' + esc(siteName) + '" href="/feed.xml" />';
  const headPayload = await registry.executePipeline('render:head', { siteName, title: siteName, description: '', markup: rssLink, meta });
  let bodyHtml = rows.length ? renderPostList(rows, siteName) : renderHomepage(siteName);
  const bodyPayload = await registry.executePipeline('render:body', { bodyHtml, siteName });
  bodyHtml = (bodyPayload.bodyHtml as string) ?? bodyHtml;
  return c.html(shellFull(siteName, headPayload.markup as string, bodyHtml, nav));
});

export default app;

// ══════════════════════════════════════════════════════════════════
//  Render helpers
// ══════════════════════════════════════════════════════════════════

const THEME_CSS = '*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,-apple-system,sans-serif;background:#fff;color:#1e293b;line-height:1.6}header{border-bottom:1px solid #e5e7eb;padding:1.25rem 2rem;display:flex;align-items:center;justify-content:space-between;max-width:960px;margin:0 auto}header a{text-decoration:none}header .site-name{font-weight:700;font-size:1.1rem;color:#0f172a}header nav{display:flex;gap:1.25rem}header nav a{color:#64748b;font-size:0.9rem}header nav a:hover{color:#0f172a}main{max-width:720px;margin:2rem auto;padding:0 1.5rem}footer{text-align:center;padding:2rem;color:#94a3b8;font-size:0.8rem;max-width:960px;margin:0 auto}';

function shellFull(siteName: string, headMarkup: string, bodyHtml: string, nav: NavItem[]): string {
  const navHtml = nav.map((n) => '<a href="' + esc(n.url) + '">' + esc(n.label) + '</a>').join('');
  const adminLink = '<a href="/admin/login" style="color:#f97316">Admin</a>';
  return '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><style>' + THEME_CSS + '</style>' + headMarkup + '</head><body><header><a href="/" class="site-name">' + esc(siteName) + '</a><nav>' + navHtml + adminLink + '</nav></header><main>' + bodyHtml + '</main><footer>Powered by PHCloud CMS on Cloudflare Workers</footer></body></html>';
}

function renderPost(post: { title: string; content: string; updated_at: string }): string {
  const date = new Date(post.updated_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  return '<h1>' + esc(post.title) + '</h1><div style="color:#64748b;font-size:0.85rem;margin-bottom:2rem;">' + date + '</div><div style="line-height:1.8;">' + markdownToHtml(post.content) + '</div>';
}

function renderHomepage(siteName: string): string {
  return '<h1>' + esc(siteName) + '</h1><p style="color:#64748b;margin-bottom:2rem;">Welcome. Content served from Cloudflare D1.</p><p style="color:#64748b;"><a href="/admin/login">Log in</a> to manage your site.</p>';
}

function renderPostList(posts: { slug: string; title: string; excerpt: string; updated_at: string }[], siteName: string): string {
  if (!posts.length) return renderHomepage(siteName);
  let html = '<h1 style="margin-bottom:2rem">' + esc(siteName) + '</h1><div style="display:flex;flex-direction:column;gap:1.5rem">';
  for (const p of posts) {
    const date = new Date(p.updated_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    html += '<article style="border-bottom:1px solid #e5e7eb;padding-bottom:1.5rem">';
    html += '<h2 style="font-size:1.15rem;margin-bottom:0.3rem"><a href="/' + esc(p.slug) + '" style="color:#0f172a;text-decoration:none">' + esc(p.title) + '</a></h2>';
    html += '<div style="color:#94a3b8;font-size:0.8rem;margin-bottom:0.5rem">' + date + '</div>';
    if (p.excerpt) html += '<p style="color:#64748b;line-height:1.6">' + esc(p.excerpt) + '</p>';
    html += '<a href="/' + esc(p.slug) + '" style="color:#3b82f6;font-size:0.85rem;text-decoration:none">Read more →</a>';
    html += '</article>';
  }
  html += '</div>';
  return html;
}

function markdownToHtml(md: string): string {
  let html = esc(md);
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/!\[(.*?)\]\((.+?)\)/g, '<img src="$2" alt="$1" style="max-width:100%;border-radius:6px;margin:1rem 0" />');
  html = html.replace(/\[(.+?)\]\((.+?)\)/g, (_, text, url) => {
    const safeUrl = url.replace(/^javascript:/i, '').replace(/^data:/i, '');
    return '<a href="' + safeUrl + '" rel="noopener">' + text + '</a>';
  });
  html = html.replace(/`(.+?)`/g, '<code style="background:#f1f5f9;padding:0.15rem 0.35rem;border-radius:3px;font-size:0.9em;">$1</code>');
  html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*?<\/li>\n?)+/g, '<ul>$&</ul>');
  return html.split('\n\n').map((block) => {
    if (block.startsWith('<')) return block;
    return '<p>' + block.replace(/\n/g, '<br/>') + '</p>';
  }).join('\n');
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}
