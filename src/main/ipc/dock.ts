import { ipcMain } from 'electron';
import { loadDock, saveDock, type DockEntry } from '../db/dock';

export function registerDockHandlers(): void {
  ipcMain.handle('dock:load', async () => {
    try {
      const entries = loadDock();
      return { success: true, entries };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('dock:save', async (_event, entries: DockEntry[]) => {
    try {
      saveDock(entries);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
}
