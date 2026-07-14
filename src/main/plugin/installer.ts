import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import { app } from 'electron';
import { getDb } from '../db/connection';
import { insertManifest, deleteManifest, clearStoreItems } from '../db/plugins';
import type { PluginManifest, DbTableDeclaration } from '../../shared/plugin/types';
import { buildTableSQL } from '../../shared/plugin/types';
import { pluginHost } from './host';

/** Return the base directory where store plugins live */
export function getPluginsDir(): string {
  const userData = app.getPath('userData');
  return path.join(userData, 'plugins');
}

/** Resolve the install directory for a specific plugin */
export function getPluginDir(pluginId: string): string {
  return path.join(getPluginsDir(), pluginId);
}

// ── Helpers ──

function httpGet(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          httpGet(res.headers.location!).then(resolve, reject);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => resolve(data));
      })
      .on('error', reject);
  });
}

function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const dir = path.dirname(dest);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    https
      .get(url, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          downloadFile(res.headers.location!, dest).then(resolve, reject);
          return;
        }
        const file = fs.createWriteStream(dest);
        res.pipe(file);
        file.on('finish', () => { file.close(); resolve(); });
        file.on('error', reject);
      })
      .on('error', reject);
  });
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
      if (typeof t.tableName !== 'string' || !t.tableName.startsWith('plugin_')) return false;
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

  // Download the renderer bundle (manifest.entry)
  const bundleUrl = manifestUrl.replace(/manifest\.json$/, manifest.entry);
  const destPath = path.join(pluginDir, manifest.entry);

  await downloadFile(bundleUrl, destPath);
  console.log(`[plugin] Downloaded renderer: ${bundleUrl}`);

  // Download the main process bundle if declared
  if (manifest.main) {
    const mainUrl = manifestUrl.replace(/manifest\.json$/, manifest.main);
    const mainDest = path.join(pluginDir, manifest.main);
    await downloadFile(mainUrl, mainDest);
    console.log(`[plugin] Downloaded main module: ${mainUrl}`);
  }

  // Create declared database tables
  if (manifest.dbTables && manifest.dbTables.length > 0) {
    createPluginTables(manifest.id, manifest.dbTables);
    console.log(`[plugin] Created ${manifest.dbTables.length} table(s) for ${manifest.id}`);
  }

  // Register in the database
  insertManifest(manifest.id, manifest, pluginDir, manifest.version);

  // Activate the main module if present
  if (manifest.main) {
    await pluginHost.activate(manifest, pluginDir);
  }

  console.log(`[plugin] Registered ${manifest.id} v${manifest.version}`);

  return manifest;
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
