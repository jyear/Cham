import * as fs from 'fs';
import * as path from 'path';
import * as vm from 'vm';
import * as crypto from 'crypto';
import * as os from 'os';
import { spawn } from 'child_process';
import { ipcMain, app, BrowserWindow, dialog, shell } from 'electron';
import { getDb } from '../db/connection';
import type { PluginManifest, PluginMainApi, PluginMainModule } from '../../shared/plugin/types';
import { buildTableSQL } from '../../shared/plugin/types';
import { httpGet, downloadFile } from '../utils/http';

// Lazy-load sharp (native module — may not be available in all environments)
let _sharp: any = null;
function getSharp() {
  if (!_sharp) {
    try { _sharp = require('sharp'); } catch { console.error('[PluginHost] sharp is not available'); }
  }
  return _sharp;
}

interface ActivePlugin {
  manifest: PluginManifest;
  pluginDir: string;
  cleanup?: () => void;
  /** mtime of the main entry file when last activated — used to detect changes for hot reload */
  mainMtime?: number;
}

/**
 * PluginHost manages the lifecycle of plugin main modules.
 *
 * - On app startup, loads all installed plugins that have a `main` field.
 * - On plugin install, immediately activates the main module.
 * - On plugin uninstall, deactivates (runs cleanup) before removing files.
 */
/** A hook handler registered by a plugin */
interface HookEntry {
  pluginId: string;
  handler: (...args: any[]) => Promise<void> | void;
  timing: 'startup' | 'install';  // when this hook was registered
}

class PluginHost {
  private active = new Map<string, ActivePlugin>();
  private registeredChannels = new Map<string, string>(); // channel → pluginId
  private builtinModules = new Map<string, { manifest: PluginManifest; module: PluginMainModule }>();
  private hooks = new Map<string, HookEntry[]>();
  private getMainWindow: (() => BrowserWindow | null) | null = null;
  private startupComplete = false;

  /** Set the main window getter (called by main/index.ts after window creation) */
  setMainWindowGetter(getter: () => BrowserWindow | null): void {
    this.getMainWindow = getter;
  }

  /**
   * Register a builtin plugin's main module.
   * Builtins are compiled in (TypeScript — full access to Cham modules),
   * unlike store plugins which are VM-sandboxed.
   */
  registerBuiltin(manifest: PluginManifest, mainModule: PluginMainModule): void {
    this.builtinModules.set(manifest.id, { manifest, module: mainModule });
  }

  /**
   * Start the host: activate all builtin + installed store plugins.
   * Called once during app startup.
   */
  async start(): Promise<void> {
    // 1. Activate builtin plugins (compiled in, with full manifest)
    for (const [, { manifest, module: mainModule }] of this.builtinModules) {
      try {
        // Create plugin-declared tables before activation
        if (manifest.dbTables && manifest.dbTables.length > 0) {
          for (const sql of buildTableSQL(manifest.dbTables)) {
            getDb().exec(sql);
          }
          console.log(`[PluginHost] Created ${manifest.dbTables.length} table(s) for builtin "${manifest.id}"`);
        }
        await this.activateInternal(manifest, '', mainModule);
      } catch (err: any) {
        console.error(`[PluginHost] Failed to start builtin "${manifest.id}": ${err.message}`);
      }
    }

    // 2. Activate store plugins from DB
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

    this.startupComplete = true;
    console.log(
      `[PluginHost] Started: ${this.builtinModules.size} builtin + ${this.active.size} store plugin(s)`,
    );
  }

  /**
   * Activate a plugin's main module (shared by builtin + store).
   */
  private async activateInternal(
    manifest: PluginManifest,
    installPath: string,
    mainModule?: PluginMainModule,
  ): Promise<void> {
    if (!manifest.main && !mainModule) {
      console.log(`[PluginHost] Plugin "${manifest.id}" has no main entry, skipping`);
      return;
    }

    const api = this.buildApi(manifest, installPath);

    if (mainModule) {
      // Builtin — call the compiled-in function directly
      const cleanup = await mainModule(api);
      this.active.set(manifest.id, {
        manifest,
        pluginDir: installPath,
        cleanup: typeof cleanup === 'function' ? cleanup : undefined,
      });
      console.log(`[PluginHost] Activated builtin "${manifest.id}"`);
    } else {
      // Store — load via VM sandbox
      const mainPath = path.join(installPath, manifest.main!);
      if (!fs.existsSync(mainPath)) {
        console.warn(`[PluginHost] Main entry not found: ${mainPath}`);
        return;
      }
      const mainFn = this.loadPluginModule(mainPath);
      if (typeof mainFn !== 'function') {
        throw new Error(`Main entry must export a function, got ${typeof mainFn}`);
      }
      const cleanup = await mainFn(api);
      // Record main file mtime for hot reload detection
      let mainMtime: number | undefined;
      if (manifest.main) {
        try {
          mainMtime = fs.statSync(path.join(installPath, manifest.main)).mtimeMs;
        } catch { /* ignore */ }
      }
      this.active.set(manifest.id, {
        manifest,
        pluginDir: installPath,
        cleanup: typeof cleanup === 'function' ? cleanup : undefined,
        mainMtime,
      });
      console.log(`[PluginHost] Activated "${manifest.id}" main module`);
    }
  }

  /**
   * Activate a plugin's main module.
   *
   * If already active, checks the main entry file's mtime — if the file
   * has changed, deactivates the old version and loads the new one.
   * This enables hot reload during store plugin development.
   */
  async activate(manifest: PluginManifest, installPath: string): Promise<void> {
    const existing = this.active.get(manifest.id);
    if (existing) {
      if (manifest.main) {
        const mainPath = path.join(installPath, manifest.main);
        try {
          const currentMtime = fs.statSync(mainPath).mtimeMs;
          if (existing.mainMtime && currentMtime <= existing.mainMtime) {
            console.log(`[PluginHost] Plugin "${manifest.id}" is already active (unchanged)`);
            return;
          }
        } catch {
          // File missing — keep running the old version
          return;
        }
        console.log(`[PluginHost] Plugin "${manifest.id}" changed — hot reloading…`);
      } else {
        console.log(`[PluginHost] Plugin "${manifest.id}" is already active`);
        return;
      }
      this.deactivate(manifest.id);
    }
    try {
      await this.activateInternal(manifest, installPath);
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

    // Remove all hooks registered by this plugin
    for (const [hookName, entries] of this.hooks) {
      const filtered = entries.filter((e) => e.pluginId !== pluginId);
      if (filtered.length === 0) {
        this.hooks.delete(hookName);
      } else {
        this.hooks.set(hookName, filtered);
      }
    }

    this.active.delete(pluginId);
    console.log(`[PluginHost] Deactivated "${pluginId}"`);
  }

  /** Check if a plugin is currently active */
  isActive(pluginId: string): boolean {
    return this.active.has(pluginId);
  }

  /** Emit a hook — filters handlers by their declared timing vs current phase */
  async emitHook(hookName: string, ...args: any[]): Promise<void> {
    const entries = this.hooks.get(hookName);
    if (!entries || entries.length === 0) {
      console.log(`[PluginHost] Hook "${hookName}" — no handlers`);
      return;
    }

    // Filter: 'install' hooks always fire; 'startup' hooks only fire after startup is complete
    const eligible = entries.filter((e) => {
      if (e.timing === 'install') return true;
      // timing === 'startup': only fire if app has fully started
      return this.startupComplete;
    });

    if (eligible.length === 0) {
      console.log(`[PluginHost] Hook "${hookName}" — ${entries.length} handler(s) pending startup`);
      return;
    }

    console.log(`[PluginHost] Hook "${hookName}" → ${eligible.length} handler(s)`);
    for (const entry of eligible) {
      try {
        await entry.handler(...args);
      } catch (err: any) {
        console.error(`[PluginHost] Hook "${hookName}" [${entry.pluginId}] failed: ${err.message}`);
      }
    }
  }

  /** Deactivate all plugins (for app shutdown) */
  deactivateAll(): void {
    for (const pluginId of this.active.keys()) {
      this.deactivate(pluginId);
    }
  }

  /** Get IDs of all active plugins */
  getActiveIds(): string[] {
    return [...this.active.keys()];
  }

  // ── Private: load plugin main module in VM sandbox ──

  /**
   * Load a plugin's main.js in a VM sandbox so it cannot access
   * Node.js globals (require, process, __dirname) directly.
   * The plugin source is wrapped in a CommonJS IIFE; only
   * `module.exports` escapes the sandbox.
   */
  private loadPluginModule(mainPath: string): PluginMainModule {
    const code = fs.readFileSync(mainPath, 'utf-8');

    // Wrap plugin source in a CommonJS IIFE inside a V8 sandbox context.
    // Blocks access to require, process, __dirname, fs, globalThis, etc.
    const wrapped = `
      return (function() {
        const module = { exports: {} };
        const exports = module.exports;
        ${code}
        return module.exports;
      })()
    `;

    try {
      // Create a sandbox that explicitly removes dangerous globals
      const sandbox = vm.createContext(Object.create(null), {
        name: `plugin:${mainPath}`,
      });

      const fn = vm.compileFunction(wrapped, [], {
        filename: mainPath,
        parsingContext: sandbox,
      });
      const result = fn();
      return (result && result.default) || result;
    } catch (err: any) {
      throw new Error(`Failed to load plugin module "${mainPath}": ${err.message}`);
    }
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
          const upperSQL = sql.trim().toUpperCase();

          // Block dangerous statements
          if (/^(ATTACH|DETACH|DROP|ALTER|PRAGMA|REINDEX|VACUUM|SAVEPOINT|RELEASE|BEGIN|COMMIT|ROLLBACK)/i.test(upperSQL)) {
            throw new Error(
              `[PluginHost] Plugin "${pluginId}": SQL operation "${upperSQL.split(/\s/)[0]}" is not allowed.`,
            );
          }

          return getDb().prepare(sql);
        },
        exec(sql: string) {
          const upperSQL = sql.trim().toUpperCase();

          // Block dangerous statements (same list as prepare)
          if (/^(ATTACH|DETACH|DROP|ALTER|PRAGMA|REINDEX|VACUUM|SAVEPOINT|RELEASE|BEGIN|COMMIT|ROLLBACK)/i.test(upperSQL)) {
            // Exception: DROP IF EXISTS is allowed for plugin's declared tables
            // But only if it was previously allowed — for safety, block all DROP
            if (/^DROP/i.test(upperSQL)) {
              throw new Error(
                `[PluginHost] Plugin "${pluginId}": DROP is not allowed via db.exec(). ` +
                `Tables are dropped automatically on uninstall.`,
              );
            }
            throw new Error(
              `[PluginHost] Plugin "${pluginId}": SQL operation "${upperSQL.split(/\s/)[0]}" is not allowed.`,
            );
          }

          // CREATE TABLE: only allowed for declared tables
          const createMatch = upperSQL.match(/^CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+["'`]?(\w+)["'`]?/i);
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

      // ── Hooks (pub/sub across plugins) ──
      registerHook: (
        hookName: string,
        handler: (...args: any[]) => Promise<void> | void,
        timing: 'startup' | 'install' = 'startup',
      ) => {
        const entries = this.hooks.get(hookName) || [];
        entries.push({ pluginId, handler, timing });
        this.hooks.set(hookName, entries);
        console.log(`[PluginHost] Plugin "${pluginId}" registered hook "${hookName}" (${timing})`);
      },

      emitHook: (hookName: string, ...args: any[]) => this.emitHook(hookName, ...args),

      // ── Push events ──
      sendEvent: (channel: string, data: any) => {
        const fullChannel = `plugin:${pluginId}:${channel}`;
        this.getMainWindow?.()?.webContents.send(fullChannel, data);
      },

      // ── Sandboxed Node.js natives ──
      native: {
        crypto: {
          randomBytes: (size: number) => crypto.randomBytes(size),
          sha256: (data: string | Buffer) => crypto.createHash('sha256').update(data).digest('hex'),
          md5: (data: string | Buffer) => crypto.createHash('md5').update(data).digest('hex'),
        },
        os: {
          platform: () => os.platform(),
          arch: () => os.arch(),
          cpus: () => os.cpus().map((c: any) => ({ model: c.model, speed: c.speed })),
          totalmem: () => os.totalmem(),
          freemem: () => os.freemem(),
          homedir: () => os.homedir(),
          tmpdir: () => os.tmpdir(),
        },
        path: {
          join: (...parts: string[]) => path.join(...parts),
          resolve: (...parts: string[]) => path.resolve(...parts),
          basename: (p: string, ext?: string) => path.basename(p, ext),
          extname: (p: string) => path.extname(p),
          dirname: (p: string) => path.dirname(p),
          normalize: (p: string) => path.normalize(p),
          parse: (p: string) => path.parse(p),
        },
        http: {
          get: async (url: string) => {
            if (!/^https?:\/\//i.test(url)) throw new Error('Only http/https URLs are allowed');
            return httpGet(url);
          },
          download: async (url: string, destRelativePath: string) => {
            if (!/^https?:\/\//i.test(url)) throw new Error('Only http/https URLs are allowed');
            const dest = PluginHost.resolveSafe(pluginDir, destRelativePath);
            await downloadFile(url, dest);
          },
          downloadTo: async (url: string, absolutePath: string) => {
            if (!/^https?:\/\//i.test(url)) throw new Error('Only http/https URLs are allowed');
            if (!path.isAbsolute(absolutePath)) throw new Error('Absolute path required for downloadTo');
            await downloadFile(url, absolutePath);
          },
        },
        dialog: {
          selectFolder: async (): Promise<string> => {
            const win = this.getMainWindow?.();
            if (!win) return '';
            const result = await dialog.showOpenDialog(win, {
              properties: ['openDirectory', 'createDirectory'],
            });
            if (result.canceled || result.filePaths.length === 0) return '';
            return result.filePaths[0];
          },
        },
        shell: {
          showItemInFolder: (filePath: string): void => {
            shell.showItemInFolder(filePath);
          },
        },
        fs: {
          readFile(absolutePath: string): string {
            if (!path.isAbsolute(absolutePath)) throw new Error('Absolute path required');
            return fs.readFileSync(absolutePath, 'utf-8');
          },
          writeFile(absolutePath: string, data: string): void {
            if (!path.isAbsolute(absolutePath)) throw new Error('Absolute path required');
            const dir = path.dirname(absolutePath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(absolutePath, data, 'utf-8');
          },
          readBuffer(absolutePath: string): Buffer {
            if (!path.isAbsolute(absolutePath)) throw new Error('Absolute path required');
            return fs.readFileSync(absolutePath);
          },
          exists(absolutePath: string): boolean {
            if (!path.isAbsolute(absolutePath)) throw new Error('Absolute path required');
            return fs.existsSync(absolutePath);
          },
          mkdir(absolutePath: string): void {
            if (!path.isAbsolute(absolutePath)) throw new Error('Absolute path required');
            fs.mkdirSync(absolutePath, { recursive: true });
          },
          listDir(absolutePath: string): string[] {
            if (!path.isAbsolute(absolutePath)) throw new Error('Absolute path required');
            if (!fs.existsSync(absolutePath)) return [];
            return fs.readdirSync(absolutePath);
          },
          remove(absolutePath: string): void {
            if (!path.isAbsolute(absolutePath)) throw new Error('Absolute path required');
            if (fs.existsSync(absolutePath)) {
              fs.rmSync(absolutePath, { recursive: true, force: true });
            }
          },
        },
        readImage: (absolutePath: string): string => {
          if (!path.isAbsolute(absolutePath)) throw new Error('Absolute path required');
          const data = fs.readFileSync(absolutePath);
          const ext = path.extname(absolutePath).toLowerCase();
          const mimeMap: Record<string, string> = {
            '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
            '.png': 'image/png', '.webp': 'image/webp',
            '.avif': 'image/avif', '.gif': 'image/gif',
            '.bmp': 'image/bmp', '.svg': 'image/svg+xml',
          };
          const mime = mimeMap[ext] || 'image/png';
          return `data:${mime};base64,${data.toString('base64')}`;
        },
        child_process: {
          execFile: (relativeExePath: string, args: string[] = [], options?: { timeout?: number }) =>
            new Promise((resolve, reject) => {
              const exePath = PluginHost.resolveSafe(pluginDir, relativeExePath);
              if (!fs.existsSync(exePath)) {
                return reject(new Error(`Executable not found: ${relativeExePath}`));
              }
              const child = spawn(exePath, args, {
                shell: false,
                stdio: ['ignore', 'pipe', 'pipe'],
                timeout: options?.timeout ?? 60000,
              });
              let stdout = '';
              let stderr = '';
              child.stdout.on('data', (d: Buffer) => (stdout += d.toString()));
              child.stderr.on('data', (d: Buffer) => (stderr += d.toString()));
              child.on('close', (code: number) => resolve({ stdout, stderr, exitCode: code }));
              child.on('error', reject);
            }),
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
    const baseNorm = path.normalize(path.resolve(baseDir)).toLowerCase() + path.sep;
    if (!path.normalize(resolved).toLowerCase().startsWith(baseNorm)) {
      throw new Error(`Path traversal detected: "${relativePath}"`);
    }
    return resolved;
  }
}

/** Singleton instance */
export const pluginHost = new PluginHost();
