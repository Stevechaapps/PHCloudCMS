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
import { adminShell, dashboardBody, postsBody, newPostBody, editBody, loginForm, pluginsBody } from './admin.js';

// Type for the post object (reused in render helpers)
type Post = { title: string; content: string; updated_at: string };
type DbPost = Post & { id: number; slug: string; excerpt?: string; published: number };

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

  await c.env.CACHE.delete('cms:posts:pub');
  return c.json({ id: result.meta.last_row_id });
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

  await c.env.CACHE.delete('cms:posts:pub');
  return c.json({ ok: true });
});

app.delete('/api/admin/posts/:id', async (c) => {
  const auth = await requireAuth(c);
  if (auth instanceof Response) return auth;

  await c.env.DB.prepare("DELETE FROM posts WHERE id = ?").bind(c.req.param('id')).run();
  await c.env.CACHE.delete('cms:posts:pub');
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
    await db.prepare("INSERT OR REPLACE INTO admins (username, password_hash) VALUES (?, ?)")
      .bind(adminUsername, adminPasswordHash).run();

    // Set configured status LAST so partial failures don't lock out re-install
    await db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('status', 'configured')").run();

    await c.env.CACHE.delete('cms:config');
    return c.redirect('/');
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

// ── Public pages (catch-all — must be after all specific routes) ──

app.get('/:slug?', async (c) => {
  const registry = new CMSRegistry();
  const db = c.env.DB;
  const slug = c.req.param('slug') ?? '';

  const siteName = await getCached(c, 'cms:config', 600, async () => {
    const row = await getSetting(db, 'site_name');
    return row ?? 'My Site';
  });

  const plugins = await getCached(c, 'cms:plugins', 300, async () => {
    const rows = await db.prepare("SELECT id, active FROM plugins").all<{ id: string; active: number }>();
    return Object.fromEntries(rows.results.map((p) => [p.id, p.active === 1]));
  });

  initActivePlugins(registry, plugins);

  if (slug) {
    const post = await db.prepare(
      "SELECT title, content, updated_at FROM posts WHERE slug = ? AND published = 1"
    ).bind(slug).first<{ title: string; content: string; updated_at: string }>();
    if (!post) return c.html('<h1>404 — Not found</h1><p><a href="/">Go home</a></p>', 404);
    const headPayload = await registry.executePipeline('render:head', { siteName, title: post.title, description: '', markup: '', meta: { title: post.title, description: '', url: new URL(c.req.url).href } });
    let bodyHtml = renderPost(post);
    const bodyPayload = await registry.executePipeline('render:body', { bodyHtml, post, siteName });
    bodyHtml = (bodyPayload.bodyHtml as string) ?? bodyHtml;
    const fullHtml = shell(siteName, headPayload.markup as string, bodyHtml);
    return c.html(fullHtml);
  }

  const post = await getCached(c, 'cms:homepage', 60, async () => {
    return await db.prepare(
      "SELECT title, content, updated_at FROM posts WHERE published = 1 ORDER BY updated_at DESC LIMIT 1"
    ).first<{ title: string; content: string; updated_at: string }>();
  });

  const title = post?.title ?? siteName;
  const meta = { title, description: '', url: new URL(c.req.url).href };
  const headPayload = await registry.executePipeline('render:head', { siteName, title, description: '', markup: '', meta });
  let bodyHtml = post ? renderPost(post) : renderHomepage(siteName);
  const bodyPayload = await registry.executePipeline('render:body', { bodyHtml, post, siteName });
  bodyHtml = (bodyPayload.bodyHtml as string) ?? bodyHtml;
  const fullHtml = shell(siteName, headPayload.markup as string, bodyHtml);
  return c.html(fullHtml);
});

export default app;

// ══════════════════════════════════════════════════════════════════
//  Render helpers
// ══════════════════════════════════════════════════════════════════

function shell(siteName: string, headMarkup: string, bodyHtml: string): string {
  return '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />' + headMarkup + '</head><body><header style="border-bottom:1px solid #e5e7eb;padding:1.25rem 2rem;"><a href="/" style="font-weight:700;font-size:1.1rem;color:#0f172a;text-decoration:none;">' + esc(siteName) + '</a></header><main style="max-width:720px;margin:2rem auto;padding:0 1.5rem;">' + bodyHtml + '</main><footer style="text-align:center;padding:2rem;color:#94a3b8;font-size:0.8rem;">Powered by PHCloud CMS on Cloudflare Workers</footer></body></html>';
}

function renderPost(post: { title: string; content: string; updated_at: string }): string {
  const date = new Date(post.updated_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  return '<h1>' + esc(post.title) + '</h1><div style="color:#64748b;font-size:0.85rem;margin-bottom:2rem;">Last updated ' + date + '</div><div style="line-height:1.8;">' + markdownToHtml(post.content) + '</div>';
}

function renderHomepage(siteName: string): string {
  return '<h1>' + esc(siteName) + '</h1><p style="color:#64748b;margin-bottom:2rem;">Welcome. Content served from Cloudflare D1.</p><p style="color:#64748b;">Create your first post in the <a href="/admin">admin panel</a>.</p>';
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
