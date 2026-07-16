import { ipcMain, type BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import {
  insertManifest,
  listManifests,
  getStoreItem,
  setStoreItem,
  removeStoreItem,
  listStoreItems,
} from '../db/plugins';
import {
  installPlugin,
  uninstallPlugin,
  loadBundleSource,
  fetchManifest,
  createPluginTables,
} from '../plugin/installer';
import { pluginHost } from '../plugin/host';

/**
 * Register all plugin-related IPC handlers.
 */
export function registerPluginHandlers(_getMainWindow: () => BrowserWindow | null): void {
  // ── Lifecycle ──

  ipcMain.handle('plugin:listInstalled', async () => {
    try {
      const plugins = listManifests();
      return {
        success: true,
        plugins: plugins.map((p) => p.manifest),
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('plugin:install', async (_event, manifestUrl: string) => {
    try {
      const manifest = await installPlugin(manifestUrl);
      return { success: true, manifest };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // ── Install local plugin (dev mode) ──
  // Takes a local folder path containing manifest.json + dist/ subdirectory.
  // The manifest's entry/main paths are relative to the dist/ folder
  // (i.e. the plugin is built with webpack into dist/).
  // This mirrors what --dev-plugin does in main/index.ts.
  ipcMain.handle('plugin:installLocal', async (_event, folderPath: string) => {
    try {
      const manifestPath = path.join(folderPath, 'manifest.json');
      if (!fs.existsSync(manifestPath)) {
        return { success: false, error: `manifest.json not found in ${folderPath}` };
      }

      const raw = fs.readFileSync(manifestPath, 'utf-8');
      let manifest: any;
      try { manifest = JSON.parse(raw); } catch {
        return { success: false, error: 'Invalid manifest.json' };
      }

      // Validate required fields
      if (!manifest.id || !manifest.name || !manifest.entry) {
        return { success: false, error: 'manifest.json missing required fields (id, name, entry)' };
      }
      if (manifest.category !== 'store') {
        return { success: false, error: 'Local plugins must have category "store"' };
      }

      // The install path is the dist/ subdirectory (if it exists).
      // In dev/iframe mode, plugins may not have a built dist/ yet —
      // the renderer loads them from their dev server instead.
      let distPath = path.join(folderPath, 'dist');
      if (!fs.existsSync(distPath)) {
        // Use folderPath directly as install path (no dist/ subdir)
        distPath = folderPath;
      }

      // Check entry file (non-fatal: renderer may load via iframe dev server)
      const entryPath = path.join(distPath, manifest.entry);
      if (!fs.existsSync(entryPath)) {
        console.log(`[plugin] Entry file not found (may load via dev server): dist/${manifest.entry}`);
      }

      // Check main file if declared (non-fatal for same reason)
      if (manifest.main) {
        const mainPath = path.join(distPath, manifest.main);
        if (!fs.existsSync(mainPath)) {
          console.log(`[plugin] Main file not found (may load via dev server): dist/${manifest.main}`);
        }
      }

      // Create plugin tables if declared
      if (manifest.dbTables && manifest.dbTables.length > 0) {
        createPluginTables(manifest.id, manifest.dbTables);
      }

      // Register in DB — installPath points to dist/
      insertManifest(manifest.id, manifest, distPath, manifest.version);

      // Activate main module (activate() auto-detects changed files and hot-reloads)
      if (manifest.main) {
        try {
          await pluginHost.activate(manifest, distPath);
        } catch (err: any) {
          console.warn(`[plugin] Failed to activate main module for "${manifest.id}": ${err.message}`);
        }
      }

      console.log(`[plugin] Installed local plugin "${manifest.id}" from ${distPath}`);
      return { success: true, manifest };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('plugin:uninstall', async (_event, pluginId: string) => {
    try {
      await uninstallPlugin(pluginId);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('plugin:fetchManifest', async (_event, manifestUrl: string) => {
    try {
      const manifest = await fetchManifest(manifestUrl);
      return { success: true, manifest };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('plugin:loadComponent', async (_event, pluginId: string) => {
    try {
      const source = loadBundleSource(pluginId);
      return { success: true, source };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // ── KV Store ──

  ipcMain.handle(
    'plugin:getItem',
    async (_event, pluginId: string, key: string) => {
      try {
        const value = getStoreItem(pluginId, key);
        return { success: true, value };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },
  );

  ipcMain.handle(
    'plugin:setItem',
    async (_event, pluginId: string, key: string, value: string) => {
      try {
        setStoreItem(pluginId, key, value);
        return { success: true };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },
  );

  ipcMain.handle(
    'plugin:removeItem',
    async (_event, pluginId: string, key: string) => {
      try {
        removeStoreItem(pluginId, key);
        return { success: true };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },
  );

  ipcMain.handle(
    'plugin:listItems',
    async (_event, pluginId: string) => {
      try {
        const items = listStoreItems(pluginId);
        return { success: true, items };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },
  );

  // ── Hooks (Phase 2) ──

  ipcMain.handle(
    'plugin:emitHook',
    async (_event, hookName: string, ...args: any[]) => {
      try {
        await pluginHost.emitHook(hookName, ...args);
        return { success: true };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },
  );

  // ── Plugin status (Phase 2) ──

  ipcMain.handle('plugin:isActive', async (_event, pluginId: string) => {
    try {
      return { success: true, active: pluginHost.isActive(pluginId) };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Load plugin i18n files
  ipcMain.handle('plugin:loadI18n', async (_event, pluginId: string) => {
    try {
      const record = (listManifests() as any[]).find(
        (p: any) => (p.manifest as any).id === pluginId,
      );
      if (!record) return { success: false, error: 'Plugin not found' };

      const i18nDir = path.join(record.installPath, 'i18n');
      const translations: Record<string, Record<string, string>> = {};

      // Try loading en.json and zh.json from the plugin's i18n directory
      for (const lang of ['en', 'zh']) {
        const filePath = path.join(i18nDir, `${lang}.json`);
        if (fs.existsSync(filePath)) {
          try {
            translations[lang] = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
          } catch {
            console.warn(`[plugin] Failed to parse i18n: ${filePath}`);
          }
        }
      }

      return { success: true, translations };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
}
