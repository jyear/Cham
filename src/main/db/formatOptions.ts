import { getDb } from './connection';

export function save(formatType: string, options: Record<string, any>): void {
  getDb()
    .prepare('INSERT OR REPLACE INTO format_options (format_type, options) VALUES (?, ?)')
    .run(formatType, JSON.stringify(options));
}

export function load(formatType: string): Record<string, any> | null {
  const row = getDb()
    .prepare('SELECT options FROM format_options WHERE format_type = ?')
    .get(formatType) as { options: string } | undefined;

  if (!row) return null;
  try {
    return JSON.parse(row.options);
  } catch {
    return null;
  }
}
