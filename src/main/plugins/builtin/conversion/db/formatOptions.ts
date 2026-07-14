/**
 * Format options CRUD — takes db from PluginMainApi.
 */

interface PluginDB {
  prepare(sql: string): { get(...params: any[]): any; run(...params: any[]): any };
}

export function save(db: PluginDB, formatType: string, options: Record<string, any>): void {
  db.prepare('INSERT OR REPLACE INTO format_options (format_type, options) VALUES (?, ?)').run(
    formatType, JSON.stringify(options),
  );
}

export function load(db: PluginDB, formatType: string): Record<string, any> | null {
  const row = db.prepare('SELECT options FROM format_options WHERE format_type = ?').get(formatType) as { options: string } | undefined;
  if (!row) return null;
  try { return JSON.parse(row.options); } catch { return null; }
}

