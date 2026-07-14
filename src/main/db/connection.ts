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

  // conversions + format_options tables are now created by the
  // Conversion builtin plugin via PluginManifest.dbTables

  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS backgrounds (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      path       TEXT NOT NULL,
      filename   TEXT NOT NULL,
      selected   INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS dock (
      app_key      TEXT PRIMARY KEY,
      icon         TEXT NOT NULL,
      color        TEXT NOT NULL,
      title        TEXT NOT NULL,
      description  TEXT,
      unresizable  INTEGER NOT NULL DEFAULT 0,
      sort_order   INTEGER NOT NULL DEFAULT 0
    );
  `);

  // ── Plugin system tables ──

  db.exec(`
    CREATE TABLE IF NOT EXISTS plugin_manifests (
      plugin_id    TEXT PRIMARY KEY,
      manifest     TEXT NOT NULL,
      install_path TEXT NOT NULL,
      installed_at TEXT DEFAULT (datetime('now')),
      version      TEXT NOT NULL
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS plugin_store (
      plugin_id  TEXT NOT NULL,
      key        TEXT NOT NULL,
      value      TEXT NOT NULL DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (plugin_id, key)
    );
  `);
}

export function close(): void {
  if (db) {
    db.close();
    db = null;
  }
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
