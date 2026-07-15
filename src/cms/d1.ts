export type Env = {
  DB: D1Database;
  CACHE: KVNamespace;
};

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
    type        TEXT    NOT NULL DEFAULT 'post',
    published   INTEGER DEFAULT 0 NOT NULL,
    created_at  TEXT    DEFAULT (datetime('now')) NOT NULL,
    updated_at  TEXT    DEFAULT (datetime('now')) NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS plugins (
    id     TEXT PRIMARY KEY,
    active INTEGER DEFAULT 0 NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS images (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    filename   TEXT NOT NULL,
    mime       TEXT NOT NULL,
    data       BLOB NOT NULL,
    size       INTEGER NOT NULL,
    created_at TEXT DEFAULT (datetime('now')) NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS admins (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT    NOT NULL UNIQUE DEFAULT 'admin',
    password_hash TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS tags (
    id    INTEGER PRIMARY KEY AUTOINCREMENT,
    name  TEXT NOT NULL,
    slug  TEXT NOT NULL UNIQUE
  )`,
  `CREATE TABLE IF NOT EXISTS post_tags (
    post_id INTEGER NOT NULL,
    tag_id  INTEGER NOT NULL,
    PRIMARY KEY (post_id, tag_id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_posts_slug      ON posts(slug)`,
  `CREATE INDEX IF NOT EXISTS idx_posts_published ON posts(published)`,
  `CREATE INDEX IF NOT EXISTS idx_posts_type      ON posts(type)`,
];

export async function migrate(db: D1Database): Promise<void> {
  // Create tables (IF NOT EXISTS = safe to re-run)
  for (const stmt of SCHEMA_STATEMENTS) {
    // Skip indexes that may reference columns added later
    if (stmt.startsWith('CREATE INDEX')) continue;
    await db.prepare(stmt).run();
  }
  // Add columns that may not exist on older databases
  try { await db.prepare("ALTER TABLE posts ADD COLUMN type TEXT NOT NULL DEFAULT 'post'").run(); } catch {}
  try { await db.prepare("ALTER TABLE posts ADD COLUMN publish_at TEXT").run(); } catch {}
  try { await db.prepare("ALTER TABLE posts ADD COLUMN preview_token TEXT").run(); } catch {}
  // Now create indexes safely (column exists)
  for (const stmt of SCHEMA_STATEMENTS) {
    if (stmt.startsWith('CREATE INDEX')) {
      try { await db.prepare(stmt).run(); } catch {}
    }
  }
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

export async function getAllSettings(db: D1Database): Promise<Record<string, string>> {
  const rows = await db.prepare("SELECT key, value FROM settings").all<{ key: string; value: string }>();
  const result: Record<string, string> = {};
  for (const row of rows.results) result[row.key] = row.value;
  return result;
}

export async function isConfigured(db: D1Database): Promise<boolean> {
  const val = await getSetting(db, 'status');
  return val === 'configured';
}
