import { getDb } from './connection';

export interface BackgroundRecord {
  id: number;
  path: string;
  filename: string;
  hash: string;
  selected: number;
  created_at: string;
}

export function add(path: string, filename: string, hash: string): BackgroundRecord {
  const result = getDb()
    .prepare('INSERT INTO backgrounds (path, filename, hash, selected) VALUES (?, ?, ?, 0)')
    .run(path, filename, hash);
  return getDb()
    .prepare('SELECT * FROM backgrounds WHERE id = ?')
    .get(result.lastInsertRowid) as BackgroundRecord;
}

export function getAll(): BackgroundRecord[] {
  return getDb()
    .prepare('SELECT * FROM backgrounds ORDER BY created_at DESC')
    .all() as BackgroundRecord[];
}

export function getByHash(hash: string): BackgroundRecord | null {
  if (!hash) return null;
  return (getDb()
    .prepare('SELECT * FROM backgrounds WHERE hash = ? LIMIT 1')
    .get(hash) || null) as BackgroundRecord | null;
}

/** Delete records whose backing files no longer exist on disk.
 *  Returns the count of removed records. */
export function removeOrphans(): number {
  const all = getAll();
  let removed = 0;
  for (const r of all) {
    // Use a sync fs check — caller should `require('fs')` and pass a helper,
    // but for now we do an inline require so the DB layer stays pure-ish.
    try {
      const fs = require('fs');
      if (!fs.existsSync(r.path)) {
        getDb().prepare('DELETE FROM backgrounds WHERE id = ?').run(r.id);
        removed++;
      }
    } catch {
      // If fs isn't available, skip
    }
  }
  return removed;
}

export function setSelected(id: number): void {
  const db = getDb();
  db.transaction(() => {
    db.prepare('UPDATE backgrounds SET selected = 0').run();
    db.prepare('UPDATE backgrounds SET selected = 1 WHERE id = ?').run(id);
  })();
}

export function remove(id: number): BackgroundRecord | null {
  const row = getDb()
    .prepare('SELECT * FROM backgrounds WHERE id = ?')
    .get(id) as BackgroundRecord | undefined;
  if (!row) return null;
  getDb().prepare('DELETE FROM backgrounds WHERE id = ?').run(id);
  return row;
}
