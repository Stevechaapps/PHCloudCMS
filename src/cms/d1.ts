// src/cms/d1.ts — D1 schema, migrations, and settings access.
// Shared runtime types (Env) live in ./env.ts.

// Schema — ordered so tables exist before indexes reference them.
// idempotent; safe to re-run on every new database.
export const SCHEMA_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    content TEXT NOT NULL,
    excerpt TEXT,
    type TEXT NOT NULL DEFAULT 'post',
    published INTEGER DEFAULT 0 NOT NULL,
    publish_at TEXT,
    preview_token TEXT,
    created_at TEXT DEFAULT (datetime('now')) NOT NULL,
    updated_at TEXT DEFAULT (datetime('now')) NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS plugins (
    id TEXT PRIMARY KEY,
    active INTEGER DEFAULT 0 NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT NOT NULL,
    mime TEXT NOT NULL,
    data BLOB NOT NULL,
    size INTEGER NOT NULL,
    created_at TEXT DEFAULT (datetime('now')) NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE DEFAULT 'admin',
    password_hash TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE
  )`,
  `CREATE TABLE IF NOT EXISTS post_tags (
    post_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL,
    PRIMARY KEY (post_id, tag_id)
  )`,
];

// Schema — runs after tables, inside try/catch so partial installs are fine.
export const INDEX_STATEMENTS: string[] = [
  `CREATE INDEX IF NOT EXISTS idx_posts_slug ON posts(slug)`,
  `CREATE INDEX IF NOT EXISTS idx_posts_published ON posts(published)`,
  `CREATE INDEX IF NOT EXISTS idx_posts_type ON posts(type)`,
];

// Columns added to older databases.
// Each is idempotent — "duplicate column" / "already exists" is swallowed.
export const ALTER_POSTS_COLUMNS: { sql: string }[] = [
  { sql: "ALTER TABLE posts ADD COLUMN type TEXT NOT NULL DEFAULT 'post'" },
  { sql: "ALTER TABLE posts ADD COLUMN publish_at TEXT" },
  { sql: "ALTER TABLE posts ADD COLUMN preview_token TEXT" },
  { sql: "ALTER TABLE posts ADD COLUMN excerpt TEXT" },
];

const _MIGRATIONS_TABLE = `CREATE TABLE IF NOT EXISTS _migrations (
  id TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
)`;

async function recordMigration(db: D1Database, id: string): Promise<void> {
  await db
    .prepare("INSERT OR IGNORE INTO _migrations (id) VALUES (?)")
    .bind(id)
    .run();
}

async function applyIfNeeded(
  db: D1Database,
  id: string,
  sql: string
): Promise<boolean> {
  try {
    await db.prepare(sql).run();
  } catch {
    // duplicate column / already exists → already applied, not an error
  }
  await recordMigration(db, id);
  return true;
}

// Called once during install to bring schema up to date.
// Idempotent: every step is safe to re-run; versioning lets us extend
// without touching old databases.
export async function migrate(db: D1Database): Promise<void> {
  // 1 — tracking table
  await db.prepare(_MIGRATIONS_TABLE).run();

  // 2 — base tables (IF NOT EXISTS already covers old installs)
  for (const stmt of SCHEMA_STATEMENTS) {
    await db.prepare(stmt).run();
  }

  // 3 — columns that may not exist on databases created before they were added
  await applyIfNeeded(db, "migrate-type-col",       ALTER_POSTS_COLUMNS[0].sql);
  await applyIfNeeded(db, "migrate-publish-at-col",  ALTER_POSTS_COLUMNS[1].sql);
  await applyIfNeeded(db, "migrate-preview-token-col", ALTER_POSTS_COLUMNS[2].sql);
  await applyIfNeeded(db, "migrate-excerpt-col",     ALTER_POSTS_COLUMNS[3].sql);

  // 4 — indexes (columns are guaranteed to exist at this point)
  for (const stmt of INDEX_STATEMENTS) {
    try {
      await db.prepare(stmt).run();
    } catch {
      // index already exists
    }
  }

  // 5 — defensive data cleanup for databases upgraded mid-life
  await backfillMissingDefaults(db);
}

// Backfill NULLs that would break queries on databases that predate the
// columns added in step 3. Runs after ALTER TABLE so the columns are present.
export async function backfillMissingDefaults(db: D1Database): Promise<void> {
  await db
    .prepare("UPDATE posts SET type='post' WHERE type IS NULL")
    .run();
  await db
    .prepare("UPDATE posts SET published=0 WHERE published IS NULL")
    .run();
  const now = new Date().toISOString();
  await db
    .prepare(
      "UPDATE posts SET created_at=COALESCE(created_at, ?), updated_at=COALESCE(updated_at, ?)"
    )
    .bind(now, now)
    .run();
}

export async function seed(db: D1Database, siteName: string): Promise<void> {
  const now = new Date().toISOString();
  await db.batch([
    db
      .prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('site_name', ?)")
      .bind(siteName),
    db
      .prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('installed_at', ?)")
      .bind(now),
  ]);
}

export async function getSetting(db: D1Database, key: string): Promise<string | null> {
  const row = await db
    .prepare("SELECT value FROM settings WHERE key = ?")
    .bind(key)
    .first<{ value: string }>();
  return row?.value ?? null;
}

export async function getAllSettings(db: D1Database): Promise<Record<string, string>> {
  const rows = await db
    .prepare("SELECT key, value FROM settings")
    .all<{ key: string; value: string }>();
  const result: Record<string, string> = {};
  for (const row of rows.results) result[row.key] = row.value;
  return result;
}

export async function isConfigured(db: D1Database): Promise<boolean> {
  return (await getSetting(db, 'status')) === 'configured';
}
