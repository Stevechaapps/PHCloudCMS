// src/cms/d1.ts — D1 schema definitions & seeding
// Called during onboarding install to create all tables + seed defaults

export type Env = {
  DB: D1Database;
  CACHE: KVNamespace;
};

// Schema split into individual statements and run via db.batch() rather than
// db.exec(). db.exec() chokes on multi-statement strings in the local D1
// runtime (and is flaky in prod) with "incomplete input" errors; batch() runs
// each prepared statement reliably in both local & production D1.
export const SCHEMA_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS posts (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT    NOT NULL,
    slug        TEXT    NOT NULL UNIQUE,
    content     TEXT    NOT NULL,
    excerpt     TEXT,
    published   INTEGER DEFAULT 0 NOT NULL,
    created_at  TEXT    DEFAULT (datetime('now')) NOT NULL,
    updated_at  TEXT    DEFAULT (datetime('now')) NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS plugins (
    id     TEXT PRIMARY KEY,
    active INTEGER DEFAULT 0 NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS admins (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT    NOT NULL UNIQUE DEFAULT 'admin',
    password_hash TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_posts_slug      ON posts(slug)`,
  `CREATE INDEX IF NOT EXISTS idx_posts_published ON posts(published)`,
];

export async function migrate(db: D1Database): Promise<void> {
  await db.batch(SCHEMA_STATEMENTS.map((stmt) => db.prepare(stmt)));
}

export async function seed(db: D1Database, siteName: string): Promise<void> {
  const now = new Date().toISOString();
  await db.batch([
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('site_name', ?)").bind(siteName),
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('installed_at', ?)").bind(now),
  ]);
}

export async function getSetting(db: D1Database, key: string): Promise<string | null> {
  const row = await db.prepare("SELECT value FROM settings WHERE key = ?").bind(key).first<{ value: string }>();
  return row?.value ?? null;
}

export async function isConfigured(db: D1Database): Promise<boolean> {
  const val = await getSetting(db, 'status');
  return val === 'configured';
}
