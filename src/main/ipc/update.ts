import { ipcMain, app, type BrowserWindow } from 'electron';
import { checkForUpdates, getUpdateStatus, downloadUpdate, getLastDownloadPath, installUpdate } from '../update';

export function registerUpdateHandlers(getMainWindow: () => BrowserWindow | null): void {
  ipcMain.handle('get-app-version', () => {
    return app.getVersion();
  });

  ipcMain.handle('check-update', async () => {
    const s = await checkForUpdates();
    return s;
  });

  ipcMain.handle('download-update', async () => {
    try {
      const filePath = await downloadUpdate((pct: number) => {
        getMainWindow()?.webContents.send('update-progress', { progress: pct });
      });
      getMainWindow()?.webContents.send('update-progress', { progress: 100, done: true });
      return { success: true, filePath };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('get-update-status', () => {
    return getUpdateStatus();
  });

  ipcMain.handle('get-last-download-path', () => {
    return getLastDownloadPath();
  });

  ipcMain.handle('install-update', async () => {
    try {
      installUpdate();
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  });
}
