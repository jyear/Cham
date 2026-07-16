import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { getDb } from '../db/connection';
import { insertManifest, deleteManifest, clearStoreItems } from '../db/plugins';
import { deleteDockEntry } from '../db/dock';
import type { PluginManifest, DbTableDeclaration } from '../../shared/plugin/types';
import { buildTableSQL } from '../../shared/plugin/types';
import { pluginHost } from './host';
import { httpGet, downloadFile } from '../utils/http';

/** Return the base directory where store plugins live */
export function getPluginsDir(): string {
  const userData = app.getPath('userData');
  return path.join(userData, 'plugins');
}

/** Resolve the install directory for a specific plugin */
export function getPluginDir(pluginId: string): string {
  return path.join(getPluginsDir(), pluginId);
}

// ── Table management ──

/** Execute CREATE TABLE statements for plugin-declared tables */
export function createPluginTables(pluginId: string, tables: DbTableDeclaration[]): void {
  if (tables.length === 0) return;

  const sqlStatements = buildTableSQL(tables);
  const db = getDb();
  for (const sql of sqlStatements) {
    db.exec(sql);
  }
}

/** Drop all tables declared by a plugin (called during uninstall) */
export function dropPluginTables(tables: DbTableDeclaration[]): void {
  if (tables.length === 0) return;

  const db = getDb();
  for (const t of tables) {
    try {
      db.exec(`DROP TABLE IF EXISTS ${t.tableName}`);
    } catch {
      // Best effort — table may already be gone
    }
  }
}

// ── Manifest validation ──

function validateManifest(m: any): m is PluginManifest {
  if (!m || typeof m !== 'object') return false;
  if (typeof m.id !== 'string' || !m.id) return false;
  if (typeof m.name !== 'string' || !m.name) return false;
  if (typeof m.version !== 'string' || !m.version) return false;
  if (typeof m.icon !== 'string') return false;
  if (typeof m.color !== 'string') return false;
  if (typeof m.entry !== 'string' || !m.entry) return false;
  if (m.category !== 'builtin' && m.category !== 'store') return false;

  // Validate dbTables if present
  if (m.dbTables) {
    if (!Array.isArray(m.dbTables)) return false;
    for (const t of m.dbTables) {
      if (typeof t.tableName !== 'string' || !t.tableName) return false;
      if (!Array.isArray(t.columns)) return false;
    }
  }

  return true;
}

// ── Install / Uninstall ──

/**
 * Fetch a plugin manifest JSON from a URL, validate it, return the object.
 */
export async function fetchManifest(manifestUrl: string): Promise<PluginManifest> {
  const raw = await httpGet(manifestUrl);
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Invalid manifest JSON');
  }
  if (!validateManifest(parsed)) {
    throw new Error('Manifest validation failed');
  }
  return parsed;
}

/**
 * Install a plugin from a remote manifest URL.
 * Steps: fetch manifest → download bundle JS → save to disk → create tables → register in DB
 */
export async function installPlugin(manifestUrl: string): Promise<PluginManifest> {
  const manifest = await fetchManifest(manifestUrl);
  const pluginDir = getPluginDir(manifest.id);

  // Resolve bundle URLs relative to the manifest URL (handles query params correctly)
  const baseUrl = manifestUrl.replace(/\/[^\/]*$/, '/');

  try {
    const bundleUrl = new URL(manifest.entry, baseUrl).href;
    const destPath = path.join(pluginDir, manifest.entry);
    await downloadFile(bundleUrl, destPath);

    if (manifest.main) {
      const mainUrl = new URL(manifest.main, baseUrl).href;
      await downloadFile(mainUrl, path.join(pluginDir, manifest.main));
    }

    // Create tables and register in DB — only after all downloads succeed
    if (manifest.dbTables && manifest.dbTables.length > 0) {
      createPluginTables(manifest.id, manifest.dbTables);
    }

    // Register in the database.
    // NOTE: We do NOT activate the main module here — hooks only become
    // active on next app startup via pluginHost.start().
    insertManifest(manifest.id, manifest, pluginDir, manifest.version);

    if (manifest.main) {
      console.log(`[plugin] ${manifest.id} has a main module — will activate on next restart`);
    }

    console.log(`[plugin] Installed ${manifest.id} v${manifest.version}`);
    return manifest;
  } catch (err) {
    // Clean up on failure: remove partially downloaded files
    try { fs.rmSync(pluginDir, { recursive: true, force: true }); } catch {}
    throw err;
  }
}

/**
 * Uninstall a plugin: drop tables, clear store, remove files, delete DB record.
 */
export async function uninstallPlugin(pluginId: string): Promise<void> {
  // Deactivate the main module first (runs cleanup, removes IPC handlers)
  pluginHost.deactivate(pluginId);

  // Look up the manifest to know which tables to drop
  const record = getDb()
    .prepare('SELECT manifest, install_path FROM plugin_manifests WHERE plugin_id = ?')
    .get(pluginId) as { manifest: string; install_path: string } | undefined;

  if (record) {
    const manifest: PluginManifest = JSON.parse(record.manifest);

    // Drop plugin tables
    if (manifest.dbTables && manifest.dbTables.length > 0) {
      dropPluginTables(manifest.dbTables);
    }

    // Remove plugin files
    if (fs.existsSync(record.install_path)) {
      fs.rmSync(record.install_path, { recursive: true, force: true });
    }
  }

  // Clear plugin KV store
  clearStoreItems(pluginId);

  // Remove from dock (in case user pinned it)
  deleteDockEntry(pluginId);

  // Remove from registry
  deleteManifest(pluginId);
  console.log(`[plugin] Uninstalled ${pluginId}`);
}

/**
 * Load a plugin's JS bundle source code from disk.
 * Called by IPC so the renderer can evaluate it.
 */
export function loadBundleSource(pluginId: string): string {
  const record = getDb()
    .prepare('SELECT manifest, install_path FROM plugin_manifests WHERE plugin_id = ?')
    .get(pluginId) as { manifest: string; install_path: string } | undefined;

  if (!record) {
    throw new Error(`Plugin "${pluginId}" is not installed`);
  }

  const manifest: PluginManifest = JSON.parse(record.manifest);
  const filePath = path.join(record.install_path, manifest.entry);

  if (!fs.existsSync(filePath)) {
    throw new Error(`Bundle file not found: ${filePath}`);
  }

  return fs.readFileSync(filePath, 'utf-8');
}
