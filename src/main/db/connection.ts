import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) throw new Error('Database not initialized. Call init() first.');
  return db;
}

export function init(dbPath?: string): void {
  if (db) return;

  const resolved = dbPath ?? defaultPath();
  const dir = path.dirname(resolved);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  db = new Database(resolved);
  db.pragma('journal_mode = WAL');

  // ── Schema ──

  db.exec(`
    CREATE TABLE IF NOT EXISTS conversions (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      source_id   TEXT NOT NULL,
      format      TEXT NOT NULL DEFAULT 'webp',
      quality     INTEGER NOT NULL DEFAULT 100,
      output_path TEXT NOT NULL,
      output_hash TEXT NOT NULL,
      created_at  TEXT DEFAULT (datetime('now')),
      updated_at  TEXT DEFAULT (datetime('now'))
    );
  `);

  migrateConversions();

  db.exec(`DROP INDEX IF EXISTS idx_conversions_lookup`);
  db.exec(`DROP INDEX IF EXISTS idx_conversions_input`);
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_conversions_source_id
      ON conversions (source_id);
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS format_options (
      format_type TEXT PRIMARY KEY,
      options     TEXT NOT NULL
    );
  `);
}

export function close(): void {
  if (db) {
    db.close();
    db = null;
  }
}

// ── Migrations ──

function migrateConversions(): void {
  if (!db) return;

  try { db.exec(`ALTER TABLE conversions ADD COLUMN quality INTEGER NOT NULL DEFAULT 100`); } catch { /* ok */ }
  try { db.exec(`ALTER TABLE conversions ADD COLUMN source_id TEXT NOT NULL DEFAULT ''`); } catch { /* ok */ }

  try {
    db.exec(`
      UPDATE conversions
      SET source_id = input_path || '|' || input_hash
      WHERE source_id = '' AND input_path IS NOT NULL AND input_hash IS NOT NULL
    `);
  } catch { /* ok */ }

  try {
    db.exec(`
      DELETE FROM conversions
      WHERE id NOT IN (
        SELECT MAX(id) FROM conversions WHERE source_id != '' GROUP BY source_id
      )
      AND source_id != ''
    `);
  } catch { /* ok */ }
}

function defaultPath(): string {
  const { app } = require('electron');
  let userData: string;
  try {
    userData = app.getPath('userData');
  } catch {
    userData = path.join(
      process.env.APPDATA ?? path.join(process.env.HOME ?? '', '.config'),
      'cham'
    );
  }
  return path.join(userData, 'cham.db');
}
