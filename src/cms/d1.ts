// src/cms/d1.ts — D1 schema definitions & seeding
// Called during onboarding install to create all tables + seed defaults

export type Env = {
  DB: D1Database;
  CACHE: KVNamespace;
};

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS posts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  title       TEXT    NOT NULL,
  slug        TEXT    NOT NULL UNIQUE,
  content     TEXT    NOT NULL,
  excerpt     TEXT,
  published   INTEGER DEFAULT 0 NOT NULL,
  created_at  TEXT    DEFAULT (datetime('now')) NOT NULL,
  updated_at  TEXT    DEFAULT (datetime('now')) NOT NULL
);

CREATE TABLE IF NOT EXISTS plugins (
  id     TEXT PRIMARY KEY,
  active INTEGER DEFAULT 0 NOT NULL
);

CREATE TABLE IF NOT EXISTS admins (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT    NOT NULL UNIQUE DEFAULT 'admin',
  password_hash TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_posts_slug      ON posts(slug);
CREATE INDEX IF NOT EXISTS idx_posts_published ON posts(published);
` as const;

export async function migrate(db: D1Database): Promise<void> {
  await db.exec(SCHEMA);
}

export async function seed(db: D1Database, siteName: string): Promise<void> {
  const now = new Date().toISOString();
  await db.batch([
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('site_name', ?)").bind(siteName),
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('status', 'configured')"),
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('installed_at', ?)").bind(now),
    // Default plugins — SEO active by default
    db.prepare("INSERT OR REPLACE INTO plugins (id, active) VALUES ('seo', 1)"),
    db.prepare("INSERT OR REPLACE INTO plugins (id, active) VALUES ('sitemap', 1)"),
  ]);
}

export async function getSetting(db: D1Database, key: string): Promise<string | null> {
  const row = await db.prepare("SELECT value FROM settings WHERE key = ?").bind(key).first<string>();
  return row ?? null;
}

export async function isConfigured(db: D1Database): Promise<boolean> {
  const val = await getSetting(db, 'status');
  return val === 'configured';
}
