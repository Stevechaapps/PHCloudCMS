export async function saveImage(
  db: D1Database,
  filename: string,
  data: Uint8Array,
  mime: string,
): Promise<number> {
  const result = await db
    .prepare("INSERT INTO images (filename, mime, data, size) VALUES (?, ?, ?, ?)")
    .bind(filename, mime, data, data.byteLength)
    .run();
  return result.meta.last_row_id as number;
}

export async function getImage(
  db: D1Database,
  id: number,
): Promise<{ data: ArrayBuffer; mime: string; filename: string } | null> {
  const row = await db
    .prepare("SELECT data, mime, filename FROM images WHERE id = ?")
    .bind(id)
    .first<{ data: ArrayBuffer; mime: string; filename: string }>();
  return row ?? null;
}

export async function deleteImage(
  db: D1Database,
  id: number,
  kv?: KVNamespace,
): Promise<void> {
  await db.prepare("DELETE FROM images WHERE id = ?").bind(id).run();
  if (kv) {
    await kv.delete(`img:${id}:data`);
    await kv.delete(`img:${id}:meta`);
  }
}
