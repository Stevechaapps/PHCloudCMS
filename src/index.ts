import { Hono } from 'hono';
import type { Context } from 'hono';
import { CMSRegistry } from './cms/registry.js';
import { onboardingGuard, getCached } from './cms/middleware.js';
import { migrate, seed, isConfigured, getSetting } from './cms/d1.js';
import { hashPassword, verifyPassword } from './cms/auth.js';
import { AVAILABLE_PLUGINS } from './plugins/index.js';
import { initSEOPlugin } from './plugins/seo.js';
import { initSitemapPlugin } from './plugins/sitemap.js';
import './themes/index.js';
import { getTheme, getAllThemes } from './cms/theme.js';
import type { PostView, PostListItem } from './cms/theme.js';
import { getCookie, setCookie } from 'hono/cookie';
import { adminShell, dashboardBody, postsBody, newPostBody, editBody, loginForm, pluginsBody, pagesBody, newPageBody, editPageBody, categoriesBody, navBody, settingsBody } from './admin.js';

type Post = { title: string; content: string; updated_at: string };
type DbPost = Post & { id: number; slug: string; excerpt: string; published: number; type: string };
type NavItem = { label: string; url: string };

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
    category_ids?: number[];
  }>();
  const db = c.env.DB;
  const now = new Date().toISOString();
  const result = await db.prepare(
    "INSERT INTO posts (title, slug, content, excerpt, published, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).bind(
    body.title ?? '',
    body.slug ?? '',
    body.content ?? '',
    body.excerpt ?? '',
    body.published === true ? 1 : 0,
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
  return c.json({ id: postId });
});

app.get('/api/admin/posts', async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) return auth;

  const rows = await c.env.DB.prepare(
    "SELECT id, title, slug, published, updated_at FROM posts ORDER BY updated_at DESC"
  ).all<{ id: number; title: string; slug: string; published: number; updated_at: string }>();
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
    category_ids?: number[];
  }>();
  const now = new Date().toISOString();

  await c.env.DB.prepare(
    "UPDATE posts SET title=?, slug=?, content=?, excerpt=?, published=?, updated_at=? WHERE id=?"
  ).bind(
    body.title ?? '',
    body.slug ?? '',
    body.content ?? '',
    body.excerpt ?? '',
    body.published === true ? 1 : 0,
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
  return c.json({ ok: true });
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
  return c.html(adminShell('Edit Post', editBody({ id: post.id, title: post.title, slug: post.slug, content: post.content, excerpt: post.excerpt, published: post.published, updated_at: post.updated_at })));
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
  const imgurClientId = (await getSetting(c.env.DB, 'imgur_client_id')) ?? '';
  const themeId = (await getSetting(c.env.DB, 'theme')) ?? 'default';
  const available = getAllThemes().map((t) => ({ id: t.id, name: t.name }));
  return c.html(adminShell('Settings', settingsBody({ imgur_client_id: imgurClientId, theme: themeId, available_themes: available })));
});

app.get('/admin/login', (c) => {
  if (getCookie(c, SESSION_COOKIE)) return c.redirect('/admin');
  return c.html(loginForm());
});

// ── Settings API ──────────────────────────────────────────────────

app.get('/api/admin/settings', async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) return auth;
  const imgurClientId = await getSetting(c.env.DB, 'imgur_client_id') ?? '';
  return c.json({ imgur_client_id: imgurClientId });
});

app.post('/api/admin/settings', async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) return auth;
  const body = await c.req.json<{ imgur_client_id?: string; theme?: string }>();
  await c.env.DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('imgur_client_id', ?)").bind(body.imgur_client_id ?? '').run();
  if (body.theme) {
    await c.env.DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('theme', ?)").bind(body.theme).run();
    await c.env.CACHE.delete('cms:theme');
  }
  await c.env.CACHE.delete('cms:config');
  return c.json({ ok: true });
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
  bodyHtml += '<form action="/search" method="get" class="search-form"><input type="text" name="q" value="' + esc(q) + '" placeholder="Search posts…" /></form>';

  if (q) {
    const rows = await db.prepare(
      "SELECT slug, title, excerpt, updated_at FROM posts WHERE published = 1 AND type = 'post' AND (title LIKE ? OR content LIKE ?) ORDER BY updated_at DESC"
    ).bind('%' + q + '%', '%' + q + '%').all<{ slug: string; title: string; excerpt: string; updated_at: string }>();
    if (rows.results.length) {
      bodyHtml += renderPostList(rows.results, '');
    } else {
      bodyHtml += '<p style="color:var(--text-light)">No results found for "' + esc(q) + '"</p>';
    }
  }

  const registry = new CMSRegistry();
  const themeId = await getCached(c, 'cms:theme', 600, async () => await getSetting(db, 'theme') ?? 'default');
  const themeCss = (getTheme(themeId)?.css) ?? getTheme('default')!.css;
  const headPayload = await registry.executePipeline('render:head', { siteName, title: 'Search · ' + siteName, description: '', markup: '', meta: { title: 'Search · ' + siteName, description: '', url: new URL(c.req.url).href } });
  return c.html(shellFull(siteName, headPayload.markup as string, bodyHtml, [], themeCss));
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
  const bodyHtml = '<h1>' + esc(cat.name) + '</h1>' + (rows.results.length ? renderPostList(rows.results, '') : '<p style="color:var(--text-light)">No posts in this category.</p>');
  const registry = new CMSRegistry();
  const themeId = await getCached(c, 'cms:theme', 600, async () => await getSetting(db, 'theme') ?? 'default');
  const themeCss = (getTheme(themeId)?.css) ?? getTheme('default')!.css;
  const headPayload = await registry.executePipeline('render:head', { siteName, title: cat.name + ' · ' + siteName, description: '', markup: '', meta: { title: cat.name + ' · ' + siteName, description: '', url: new URL(c.req.url).href } });
  return c.html(shellFull(siteName, headPayload.markup as string, bodyHtml, [], themeCss));
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

  const [siteName, navVal, plugins, themeId] = await Promise.all([
    getCached(c, 'cms:config', 600, async () => await getSetting(db, 'site_name') ?? 'My Site') as Promise<string>,
    getCached(c, 'cms:nav', 600, async () => await getSetting(db, 'nav') ?? '[]') as Promise<string>,
    getCached(c, 'cms:plugins', 300, async () => {
      const rows = await db.prepare("SELECT id, active FROM plugins").all<{ id: string; active: number }>();
      return Object.fromEntries(rows.results.map((p) => [p.id, p.active === 1]));
    }) as Promise<Record<string, boolean>>,
    getCached(c, 'cms:theme', 600, async () => await getSetting(db, 'theme') ?? 'default') as Promise<string>,
  ]);

  const nav: NavItem[] = JSON.parse(navVal);
  const activeTheme = getTheme(themeId) ?? getTheme('default')!;
  const themeCss = activeTheme.css;

  const tpl = {
    shell: (sn: string, h: string, b: string, n: NavItem[]) => activeTheme.shell?.(sn, h, b, n) ?? shellFull(sn, h, b, n, themeCss),
    post: (p: PostView) => activeTheme.renderPost?.(p) ?? renderPost(p),
    list: (posts: PostListItem[], sn: string) => activeTheme.renderPostList?.(posts, sn) ?? renderPostList(posts, sn),
    home: (sn: string) => activeTheme.renderHomepage?.(sn) ?? renderHomepage(sn),
  };

  initActivePlugins(registry, plugins);

  if (slug) {
    const post = await db.prepare(
      "SELECT slug, title, content, excerpt, updated_at, type FROM posts WHERE slug = ? AND published = 1"
    ).bind(slug).first<{ slug: string; title: string; content: string; excerpt: string; updated_at: string; type: string }>();
    if (!post) return c.html('<h1>404 — Not found</h1><p><a href="/" class="back-link">Go home</a></p>', 404);

    let bodyHtml: string;
    if (post.type === 'page') {
      bodyHtml = '<h1>' + esc(post.title) + '</h1><div class="post-content">' + markdownToHtml(post.content) + '</div>';
    } else {
      const catRows = await db.prepare(
        "SELECT c.name FROM categories c JOIN post_categories pc ON c.id = pc.category_id WHERE pc.post_id = (SELECT id FROM posts WHERE slug = ?)"
      ).bind(slug).all<{ name: string }>();
      const cats = catRows.results.map((c) => c.name);
      const catsHtml = cats.length ? '<div class="post-meta">' + cats.map((n) => '<a href="/category/' + esc(n.toLowerCase().replace(/\s+/g, '-')) + '" class="category-pill">' + esc(n) + '</a>').join('') + '</div>' : '';
      bodyHtml = '<a href="/" class="back-link">← Back to home</a>' + tpl.post(post) + catsHtml;
    }

    const headPayload = await registry.executePipeline('render:head', { siteName, title: post.title, description: post.excerpt ?? '', markup: '', meta: { title: post.title, description: post.excerpt ?? '', url: new URL(c.req.url).href } });
    const bodyPayload = await registry.executePipeline('render:body', { bodyHtml, post, siteName });
    bodyHtml = (bodyPayload.bodyHtml as string) ?? bodyHtml;
    return c.html(tpl.shell(siteName, headPayload.markup as string, bodyHtml, nav));
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
  let bodyHtml = rows.length ? tpl.list(rows, siteName) : tpl.home(siteName);
  const bodyPayload = await registry.executePipeline('render:body', { bodyHtml, siteName });
  bodyHtml = (bodyPayload.bodyHtml as string) ?? bodyHtml;
  return c.html(tpl.shell(siteName, headPayload.markup as string, bodyHtml, nav));
});

export default app;

// ══════════════════════════════════════════════════════════════════
//  Render helpers
// ══════════════════════════════════════════════════════════════════

function shellFull(siteName: string, headMarkup: string, bodyHtml: string, nav: NavItem[], themeCss: string): string {
  const navHtml = nav.map((n) => '<a href="' + esc(n.url) + '">' + esc(n.label) + '</a>').join('');
  const adminLink = '<a href="/admin/login" class="admin-link">Admin</a>';
  return '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><style>' + themeCss + '</style>' + headMarkup + '</head><body><header><div class="inner"><a href="/" class="site-name">' + esc(siteName) + '</a><nav>' + navHtml + adminLink + '</nav></div></header><main>' + bodyHtml + '</main><footer><a href="/admin">Admin</a> · <a href="/sitemap.xml">Sitemap</a> · <a href="/feed.xml">RSS</a> · <a href="https://github.com/Stevechaapps/phcloudcms" target="_blank" rel="noopener">GitHub</a><br/><span style="opacity:0.6">Powered by <a href="https://github.com/Stevechaapps/phcloudcms" target="_blank" rel="noopener">PHCloud CMS</a> on <a href="https://www.cloudflare.com/workers/" target="_blank" rel="noopener">Cloudflare Workers</a></span></footer></body></html>';
}

function renderPost(post: { title: string; content: string; updated_at: string }): string {
  const date = new Date(post.updated_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  return '<h1>' + esc(post.title) + '</h1><div class="post-meta">' + date + '</div><div class="post-content">' + markdownToHtml(post.content) + '</div>';
}

function renderHomepage(siteName: string): string {
  return '<div class="site-title"><h1>' + esc(siteName) + '</h1><p>Welcome. Content served from Cloudflare D1.</p><p><a href="/admin/login">Log in</a> to manage your site.</p></div>';
}

function renderPostList(posts: { slug: string; title: string; excerpt: string; updated_at: string }[], siteName: string): string {
  if (!posts.length) return renderHomepage(siteName);
  let html = '<div class="site-title"><h1>' + esc(siteName) + '</h1></div><div class="post-list">';
  for (const p of posts) {
    const date = new Date(p.updated_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    html += '<article class="post-card">';
    html += '<h2><a href="/' + esc(p.slug) + '">' + esc(p.title) + '</a></h2>';
    html += '<div class="meta">' + date + '</div>';
    if (p.excerpt) html += '<p class="excerpt">' + esc(p.excerpt) + '</p>';
    html += '<a href="/' + esc(p.slug) + '" class="read-more">Read more →</a>';
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
  html = html.replace(/\[(.+?)\]\((.+?)\)/g, (_, text, url) => {
    const safeUrl = url.replace(/^javascript:/i, '').replace(/^data:/i, '');
    return '<a href="' + safeUrl + '" rel="noopener">' + text + '</a>';
  });
  html = html.replace(/`(.+?)`/g, '<code>$1</code>');
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
