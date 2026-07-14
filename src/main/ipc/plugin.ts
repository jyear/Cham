import { ipcMain, type BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import {
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
