// ── Plugin Type System ──
// Shared between main process and renderer.
// Main uses these for IPC/DB; Renderer uses these for registry + UI.

/** Category discriminates loading strategy */
export type PluginCategory = 'builtin' | 'store' | 'system';

/**
 * Permissions a plugin declares.
 * v1: documentation only — enforcement comes in a future version.
 */
export type PluginPermission =
  | 'storage'       // Plugin-scoped key-value store
  | 'fs'            // selectFiles, selectFolder, getFileHash
  | 'convert'       // convertImage, convertImages
  | 'watch'         // watchStart, watchStop, onWatchChange
  | 'settings';     // loadSettings, saveSettings (global app settings)

/** A single column in a plugin-declared table */
export interface DbColumnDeclaration {
  name: string;
  type: 'TEXT' | 'INTEGER' | 'REAL' | 'BLOB';
  constraints?: string; // e.g. "PRIMARY KEY", "NOT NULL DEFAULT 0"
}

/**
 * A table the plugin wants created in the app's SQLite database.
 * Table name SHOULD start with "plugin_" to avoid collisions with core tables.
 */
export interface DbTableDeclaration {
  tableName: string;
  columns: DbColumnDeclaration[];
}

/**
 * PluginManifest — the canonical metadata format.
 *
 * - Builtin plugins ship this as a .ts file (typed, compile-time checked).
 * - Store plugins ship this as a .json file hosted on OSS.
 */
export interface PluginManifest {
  /* ── Identity ── */
  id: string;            // Unique, kebab-case recommended. e.g. "conversion", "avif-converter"
  name: string;          // i18n key for display name, e.g. "conversionTool"
  version: string;       // semver, e.g. "1.0.0"

  /* ── Description ── */
  description?: string;  // i18n key for description, e.g. "conversionToolDesc"

  /* ── UI ── */
  icon: string;          // IconType name (see components/Icon/index.tsx)
  color: string;         // CSS gradient or solid color for the app icon badge

  /* ── Window ── */
  minWidth?: number;     // Default: 600
  minHeight?: number;    // Default: 400
  unresizable?: boolean; // If true, window cannot be resized

  /* ── Classification ── */
  category: PluginCategory;

  /* ── Capabilities ── */
  permissions?: PluginPermission[];

  /* ── Database ──
     Declaring tables here lets the main process create them safely on install.
     Plugin code never writes raw CREATE TABLE SQL. */
  dbTables?: DbTableDeclaration[];

  /* ── Entry ──
     Relative path to the entry module (for builtin: relative import path;
     for store: filename inside the bundle, e.g. "index.js"). */
  entry: string;

  /* ── Dev Server (optional) ──
     If set and NODE_ENV=development, the plugin is loaded in an iframe
     pointing to this URL instead of being evaluated via new Function().
     Each plugin gets its own HMR via its webpack-dev-server.
     Example: "http://localhost:3001" */
  devServer?: string;

  /* ── Main Process Entry (optional, Phase 2) ──
     If present, the main process will require() this file and call its
     default export as a function, injecting the PluginMainApi.
     Use this when a plugin needs Node.js native capabilities. */
  main?: string;

  /* ── Additional Files (optional) ──
     Relative paths to extra files that should be downloaded during
     store installation (e.g. i18n, binaries, assets). */
  files?: string[];
}

/**
 * PluginBundle — the fully-resolved runtime form.
 * manifest + React Component loaded and ready to render.
 */
export interface PluginBundle {
  manifest: PluginManifest;
  Component: React.ComponentType;
}

/* ── Phase 2: Plugin Main Process API ── */

/**
 * Restricted API surface injected into plugins that have a main entry.
 * Provides controlled access to Node.js capabilities through Cham's process.
 */
export interface PluginMainApi {
  /** The plugin's unique ID */
  readonly pluginId: string;
  /** Absolute path to the plugin's install directory */
  readonly pluginDir: string;
  /** Cham app version */
  readonly appVersion: string;

  /**
   * Register an IPC handler for this plugin.
   * The actual channel becomes `plugin:<pluginId>:<channel>` to prevent collisions.
   *
   * @example
   *   api.registerHandler('apply-filter', async (event, params) => {
   *     // ... do work with api.sharp, api.db, etc.
   *     return { success: true };
   *   });
   */
  registerHandler(
    channel: string,
    handler: (event: Electron.IpcMainInvokeEvent, ...args: any[]) => any,
  ): void;

  /**
   * Access sharp for high-performance image processing.
   * Same instance used by the host app — no extra memory overhead.
   */
  sharp: typeof import('sharp');

  /**
   * Database access — restricted to the plugin's declared tables
   * plus the plugin_store table (KV storage).
   *
   * Tables not declared in the plugin's manifest will be rejected.
   */
  db: {
    prepare(sql: string): {
      run(...params: any[]): { changes: number };
      get(...params: any[]): any;
      all(...params: any[]): any[];
    };
    exec(sql: string): void;
  };


  /**
   * Send a push event to the renderer process.
   * The channel is auto-namespaced: `plugin:<pluginId>:<channel>`.
   */
  sendEvent(channel: string, data: any): void;

  /**
   * Register a hook handler.
   *
   * @param timing  'startup' (default) — handler only fires after app fully starts.
   *                A freshly installed plugin's hooks won't fire until next restart.
   *                'install' — handler fires on ANY emitHook call, even immediately
   *                after the plugin was installed mid-session.
   *
   * Built-in hooks:
   *   'cache:clear' — fired when the user clicks "Clear Cache" in Settings.
   */
  registerHook(
    hookName: string,
    handler: (...args: any[]) => Promise<void> | void,
    timing?: 'startup' | 'install',
  ): void;

  /**
   * Emit a hook — invokes registered handlers, filtered by each handler's
   * declared timing and the app's current runtime phase.
   */
  emitHook(hookName: string, ...args: any[]): Promise<void>;

  /**
   * Sandboxed Node.js native APIs.
   * Only safe, read-only or plugin-scoped operations are exposed.
   * Dangerous modules (child_process, raw fs, process.exit) are NOT available.
   */
  native: {
    crypto: {
      randomBytes(size: number): Buffer;
      sha256(data: string | Buffer): string;
      md5(data: string | Buffer): string;
    };
    os: {
      platform(): NodeJS.Platform;
      arch(): string;
      cpus(): { model: string; speed: number }[];
      totalmem(): number;
      freemem(): number;
      homedir(): string;
      tmpdir(): string;
    };
    path: {
      join(...parts: string[]): string;
      resolve(...parts: string[]): string;
      basename(p: string, ext?: string): string;
      extname(p: string): string;
      dirname(p: string): string;
      normalize(p: string): string;
      parse(p: string): { root: string; dir: string; base: string; ext: string; name: string };
    };
    http: {
      /** Fetch a URL and return the response body as a string */
      get(url: string): Promise<string>;
      /** Download a URL to a file in the plugin directory */
      download(url: string, destRelativePath: string): Promise<void>;
      /** Download a URL to an absolute file path (outside plugin sandbox) */
      downloadTo(url: string, absolutePath: string): Promise<void>;
    };
    dialog: {
      /** Open a folder selection dialog and return the selected path, or empty string if cancelled */
      selectFolder(): Promise<string>;
    };
    shell: {
      /** Show the given file in the system file manager (selects it in its parent folder) */
      showItemInFolder(filePath: string): void;
    };
    /**
     * File system — full read/write access with absolute paths.
     * Plugins can read from and write to any location on disk.
     */
    fs: {
      readFile(absolutePath: string): string;
      writeFile(absolutePath: string, data: string): void;
      readBuffer(absolutePath: string): Buffer;
      exists(absolutePath: string): boolean;
      mkdir(absolutePath: string): void;
      listDir(absolutePath: string): string[];
      remove(absolutePath: string): void;
    };
    /**
     * Read an image file from an absolute path and return a base64 data URL.
     * Supports jpg, png, webp, avif, gif, bmp, svg.
     */
    readImage(absolutePath: string): string;
    /**
     * Execute a bundled executable from the plugin directory.
     *
     * The executable path is resolved relative to the plugin directory.
     * Shell is always disabled. Only executables shipped WITH the plugin
     * can be spawned (no system commands, no PATH resolution).
     */
    child_process: {
      /**
       * Spawn an executable from the plugin directory.
       *
       * @param relativeExePath  path to the executable, relative to plugin dir (e.g. "bin/ffmpeg")
       * @param args             argument array (strings only, no shell interpolation)
       * @param options.timeout  kill the process after N ms (default: 60000)
       * @returns                { stdout: string, stderr: string, exitCode: number }
       */
      execFile(
        relativeExePath: string,
        args?: string[],
        options?: { timeout?: number },
      ): Promise<{ stdout: string; stderr: string; exitCode: number }>;
    };
  };

  /** Logger that prefixes messages with the plugin ID */
  log: {
    info(msg: string): void;
    warn(msg: string): void;
    error(msg: string): void;
  };
}

/**
 * Signature for a plugin's main entry module.
 * The function receives the API and may return a cleanup function.
 *
 * @example
 *   module.exports = function(api: PluginMainApi) {
 *     api.registerHandler('do-something', async (e, p) => { ... });
 *     // Optional cleanup
 *     return () => { console.log('cleanup'); };
 *   };
 */
export type PluginMainModule = (api: PluginMainApi) => void | (() => void) | Promise<void | (() => void)>;

/**
 * Store index entry — what the OSS /store/index.json serves.
 */
export interface StoreIndexEntry {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  version: string;
  author?: string;
  homepage?: string;
  minAppVersion?: string;
  /** ISO date string of the last update for this plugin */
  updatedAt?: string;
  manifestUrl: string;
  downloadUrl: string;
}

export interface StoreIndex {
  plugins: StoreIndexEntry[];
  updatedAt: string;
}

/**
 * Convert a PluginManifest to an SQL CREATE TABLE statement.
 * Only called in main process (NEVER in renderer).
 */
export function buildTableSQL(tables: DbTableDeclaration[]): string[] {
  return tables.map((t) => {
    const cols = t.columns.map((c) => {
      let def = `${c.name} ${c.type}`;
      if (c.constraints) def += ` ${c.constraints}`;
      return def;
    });
    return `CREATE TABLE IF NOT EXISTS ${t.tableName} (\n  ${cols.join(',\n  ')}\n);`;
  });
}
