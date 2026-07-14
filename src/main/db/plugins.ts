import { getDb } from './connection';
import type { PluginManifest } from '../../shared/plugin/types';

/** Insert or replace a plugin manifest record */
export function insertManifest(
  pluginId: string,
  manifest: PluginManifest,
  installPath: string,
  version: string,
): void {
  getDb()
    .prepare(
      `INSERT OR REPLACE INTO plugin_manifests (plugin_id, manifest, install_path, version)
       VALUES (?, ?, ?, ?)`,
    )
    .run(pluginId, JSON.stringify(manifest), installPath, version);
}

/** Get a single plugin manifest by ID */
export function getManifest(pluginId: string): PluginManifest | null {
  const row = getDb()
    .prepare('SELECT manifest FROM plugin_manifests WHERE plugin_id = ?')
    .get(pluginId) as { manifest: string } | undefined;
  if (!row) return null;
  return JSON.parse(row.manifest) as PluginManifest;
}

/** List all installed plugin manifests */
export function listManifests(): Array<{ pluginId: string; manifest: PluginManifest; installPath: string; version: string }> {
  const rows = getDb()
    .prepare('SELECT plugin_id, manifest, install_path, version FROM plugin_manifests')
    .all() as Array<{ plugin_id: string; manifest: string; install_path: string; version: string }>;
  return rows.map((r) => ({
    pluginId: r.plugin_id,
    manifest: JSON.parse(r.manifest) as PluginManifest,
    installPath: r.install_path,
    version: r.version,
  }));
}

/** Delete a plugin manifest record */
export function deleteManifest(pluginId: string): void {
  getDb().prepare('DELETE FROM plugin_manifests WHERE plugin_id = ?').run(pluginId);
}

// ── Plugin KV Store ──

export function getStoreItem(pluginId: string, key: string): string | null {
  const row = getDb()
    .prepare('SELECT value FROM plugin_store WHERE plugin_id = ? AND key = ?')
    .get(pluginId, key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setStoreItem(pluginId: string, key: string, value: string): void {
  getDb()
    .prepare(
      `INSERT OR REPLACE INTO plugin_store (plugin_id, key, value, updated_at)
       VALUES (?, ?, ?, datetime('now'))`,
    )
    .run(pluginId, key, value);
}

export function removeStoreItem(pluginId: string, key: string): void {
  getDb()
    .prepare('DELETE FROM plugin_store WHERE plugin_id = ? AND key = ?')
    .run(pluginId, key);
}

export function listStoreItems(pluginId: string): Array<{ key: string; value: string }> {
  const rows = getDb()
    .prepare('SELECT key, value FROM plugin_store WHERE plugin_id = ?')
    .all(pluginId) as Array<{ key: string; value: string }>;
  return rows;
}

/** Remove all store items for a plugin (called during uninstall) */
export function clearStoreItems(pluginId: string): void {
  getDb().prepare('DELETE FROM plugin_store WHERE plugin_id = ?').run(pluginId);
}
