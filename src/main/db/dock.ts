import { getDb } from './connection';

export interface DockEntry {
  app_key: string;
  icon: string;
  color: string;
  title: string;
  description: string | null;
  unresizable: number;
}

export function loadDock(): DockEntry[] {
  const rows = getDb()
    .prepare('SELECT app_key, icon, color, title, description, unresizable FROM dock ORDER BY sort_order')
    .all() as DockEntry[];
  return rows;
}

export function deleteDockEntry(appKey: string): void {
  getDb().prepare('DELETE FROM dock WHERE app_key = ?').run(appKey);
}

export function saveDock(entries: DockEntry[]): void {
  const db = getDb();

  const insert = db.prepare(`
    INSERT OR REPLACE INTO dock (app_key, icon, color, title, description, unresizable, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  db.transaction(() => {
    // Clear existing
    db.exec('DELETE FROM dock');
    // Insert all
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      insert.run(e.app_key, e.icon, e.color, e.title, e.description ?? null, e.unresizable, i);
    }
  })();
}
