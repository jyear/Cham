import { getDb } from './connection';

export interface BackgroundRecord {
  id: number;
  path: string;
  filename: string;
  selected: number;
  created_at: string;
}

export function add(path: string, filename: string): BackgroundRecord {
  const result = getDb()
    .prepare('INSERT INTO backgrounds (path, filename, selected) VALUES (?, ?, 0)')
    .run(path, filename);
  return getDb()
    .prepare('SELECT * FROM backgrounds WHERE id = ?')
    .get(result.lastInsertRowid) as BackgroundRecord;
}

export function getAll(): BackgroundRecord[] {
  return getDb()
    .prepare('SELECT * FROM backgrounds ORDER BY created_at DESC')
    .all() as BackgroundRecord[];
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
