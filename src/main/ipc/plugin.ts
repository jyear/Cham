import { ipcMain, type BrowserWindow } from 'electron';
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

  // ── Plugin status (Phase 2) ──

  ipcMain.handle('plugin:isActive', async (_event, pluginId: string) => {
    try {
      return { success: true, active: pluginHost.isActive(pluginId) };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
}
