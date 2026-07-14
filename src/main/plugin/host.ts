import * as fs from 'fs';
import * as path from 'path';
import { ipcMain, app } from 'electron';
import { getDb } from '../db/connection';
import type { PluginManifest, PluginMainApi, PluginMainModule } from '../../shared/plugin/types';

// Dynamic import for sharp (native module)
let _sharp: any = null;
function getSharp() {
  if (!_sharp) {
    try {
      _sharp = require('sharp');
    } catch {
      console.error('[PluginHost] sharp is not available');
    }
  }
  return _sharp;
}

interface ActivePlugin {
  manifest: PluginManifest;
  pluginDir: string;
  cleanup?: () => void;
}

/**
 * PluginHost manages the lifecycle of plugin main modules.
 *
 * - On app startup, loads all installed plugins that have a `main` field.
 * - On plugin install, immediately activates the main module.
 * - On plugin uninstall, deactivates (runs cleanup) before removing files.
 */
class PluginHost {
  private active = new Map<string, ActivePlugin>();
  private registeredChannels = new Map<string, string>(); // channel → pluginId

  /**
   * Start the host: load and activate all installed plugins' main modules.
   * Called once during app startup.
   */
  async start(): Promise<void> {
    const db = getDb();
    const rows = db
      .prepare('SELECT plugin_id, manifest, install_path FROM plugin_manifests')
      .all() as Array<{ plugin_id: string; manifest: string; install_path: string }>;

    for (const row of rows) {
      try {
        const manifest: PluginManifest = JSON.parse(row.manifest);
        if (manifest.main) {
          await this.activate(manifest, row.install_path);
        }
      } catch (err: any) {
        console.error(`[PluginHost] Failed to start plugin "${row.plugin_id}": ${err.message}`);
      }
    }

    console.log(
      `[PluginHost] Started with ${this.active.size} active plugin(s)`,
    );
  }

  /**
   * Activate a plugin's main module. Safe to call multiple times (idempotent).
   */
  async activate(manifest: PluginManifest, installPath: string): Promise<void> {
    if (this.active.has(manifest.id)) {
      console.log(`[PluginHost] Plugin "${manifest.id}" is already active`);
      return;
    }

    if (!manifest.main) {
      console.log(`[PluginHost] Plugin "${manifest.id}" has no main entry, skipping`);
      return;
    }

    const mainPath = path.join(installPath, manifest.main);
    if (!fs.existsSync(mainPath)) {
      console.warn(`[PluginHost] Main entry not found: ${mainPath}`);
      return;
    }

    const api = this.buildApi(manifest, installPath);

    try {
      // Clear require cache so updates work
      delete require.cache[require.resolve(mainPath)];

      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const module: { default?: PluginMainModule } = require(mainPath);
      const mainFn = module.default ?? module;

      if (typeof mainFn !== 'function') {
        throw new Error(`Main entry must export a function, got ${typeof mainFn}`);
      }

      const cleanup = await mainFn(api);

      this.active.set(manifest.id, {
        manifest,
        pluginDir: installPath,
        cleanup: typeof cleanup === 'function' ? cleanup : undefined,
      });

      console.log(`[PluginHost] Activated "${manifest.id}" main module`);
    } catch (err: any) {
      console.error(`[PluginHost] Failed to activate "${manifest.id}": ${err.message}`);
      throw err;
    }
  }

  /**
   * Deactivate a plugin: run its cleanup function and unregister all its IPC handlers.
   */
  deactivate(pluginId: string): void {
    const entry = this.active.get(pluginId);
    if (!entry) {
      console.log(`[PluginHost] Plugin "${pluginId}" is not active`);
      return;
    }

    // Run cleanup
    if (entry.cleanup) {
      try {
        entry.cleanup();
      } catch (err: any) {
        console.error(`[PluginHost] Cleanup error for "${pluginId}": ${err.message}`);
      }
    }

    // Remove all IPC handlers registered by this plugin
    for (const [channel, ownerId] of this.registeredChannels) {
      if (ownerId === pluginId) {
        ipcMain.removeHandler(channel);
        this.registeredChannels.delete(channel);
      }
    }

    this.active.delete(pluginId);
    console.log(`[PluginHost] Deactivated "${pluginId}"`);
  }

  /** Check if a plugin is currently active */
  isActive(pluginId: string): boolean {
    return this.active.has(pluginId);
  }

  /** Get IDs of all active plugins */
  getActiveIds(): string[] {
    return [...this.active.keys()];
  }

  // ── Private: build API for a plugin ──

  private buildApi(manifest: PluginManifest, pluginDir: string): PluginMainApi {
    const { id: pluginId } = manifest;

    // Build the set of allowed table names
    const allowedTables = new Set<string>([
      'plugin_store', // KV store is always allowed
    ]);
    if (manifest.dbTables) {
      for (const t of manifest.dbTables) {
        allowedTables.add(t.tableName);
      }
    }

    return {
      pluginId,
      pluginDir,
      appVersion: app.getVersion(),

      // ── IPC handler registration ──
      registerHandler: (channel, handler) => {
        const fullChannel = `plugin:${pluginId}:${channel}`;
        if (this.registeredChannels.has(fullChannel)) {
          console.warn(`[PluginHost] Overwriting handler for "${fullChannel}"`);
          ipcMain.removeHandler(fullChannel);
        }
        ipcMain.handle(fullChannel, handler);
        this.registeredChannels.set(fullChannel, pluginId);
      },

      // ── sharp (image processing) ──
      get sharp() {
        return getSharp();
      },

      // ── Database (restricted) ──
      db: {
        prepare(sql: string) {
          // Extract table names from SQL to validate
          const tableMatches = sql.match(/\bFROM\s+(\w+)/gi) || [];
          const tableNames = tableMatches.map((m) => m.replace(/FROM\s+/i, '').toLowerCase());

          // Also check INSERT INTO, UPDATE, DELETE FROM
          const insertMatch = sql.match(/INTO\s+(\w+)/i);
          if (insertMatch) tableNames.push(insertMatch[1].toLowerCase());
          const updateMatch = sql.match(/UPDATE\s+(\w+)/i);
          if (updateMatch) tableNames.push(updateMatch[1].toLowerCase());

          for (const name of tableNames) {
            if (!allowedTables.has(name) && !name.startsWith('plugin_')) {
              throw new Error(
                `[PluginHost] Plugin "${pluginId}" attempted to access table "${name}". ` +
                `Allowed tables: ${[...allowedTables].join(', ')}`,
              );
            }
          }

          return getDb().prepare(sql);
        },
        exec(sql: string) {
          // Only allow CREATE for declared tables
          const createMatch = sql.match(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+(\w+)/i);
          if (createMatch) {
            const tableName = createMatch[1].toLowerCase();
            if (!allowedTables.has(tableName)) {
              throw new Error(
                `[PluginHost] Plugin "${pluginId}" cannot create table "${tableName}". ` +
                `Declare it in the manifest's dbTables array.`,
              );
            }
          }
          return getDb().exec(sql);
        },
      },

      // ── File system (sandboxed to plugin dir) ──
      fs: {
        readFile(relativePath: string): string {
          const resolved = PluginHost.resolveSafe(pluginDir, relativePath);
          return fs.readFileSync(resolved, 'utf-8');
        },
        writeFile(relativePath: string, data: string): void {
          const resolved = PluginHost.resolveSafe(pluginDir, relativePath);
          const dir = path.dirname(resolved);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(resolved, data, 'utf-8');
        },
        readBuffer(relativePath: string): Buffer {
          const resolved = PluginHost.resolveSafe(pluginDir, relativePath);
          return fs.readFileSync(resolved);
        },
        exists(relativePath: string): boolean {
          const resolved = PluginHost.resolveSafe(pluginDir, relativePath);
          return fs.existsSync(resolved);
        },
        mkdir(relativePath: string): void {
          const resolved = PluginHost.resolveSafe(pluginDir, relativePath);
          fs.mkdirSync(resolved, { recursive: true });
        },
        listDir(relativePath: string): string[] {
          const resolved = PluginHost.resolveSafe(pluginDir, relativePath);
          if (!fs.existsSync(resolved)) return [];
          return fs.readdirSync(resolved);
        },
        remove(relativePath: string): void {
          const resolved = PluginHost.resolveSafe(pluginDir, relativePath);
          if (fs.existsSync(resolved)) {
            fs.rmSync(resolved, { recursive: true, force: true });
          }
        },
      },

      // ── Logger ──
      log: {
        info(msg: string) {
          console.log(`[${pluginId}] ${msg}`);
        },
        warn(msg: string) {
          console.warn(`[${pluginId}] ${msg}`);
        },
        error(msg: string) {
          console.error(`[${pluginId}] ${msg}`);
        },
      },
    };
  }

  // Ensure a path is within the plugin directory (no traversal)
  private static resolveSafe(baseDir: string, relativePath: string): string {
    if (path.isAbsolute(relativePath)) {
      throw new Error('Absolute paths are not allowed in plugin fs API');
    }
    const resolved = path.resolve(baseDir, relativePath);
    // Must be inside the base directory
    if (!resolved.startsWith(path.resolve(baseDir))) {
      throw new Error(`Path traversal detected: "${relativePath}"`);
    }
    return resolved;
  }
}

/** Singleton instance */
export const pluginHost = new PluginHost();
