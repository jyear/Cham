import { ipcMain } from 'electron';
import { clearConversions } from '../db';

export function registerCacheHandlers(): void {
  ipcMain.handle('clear-cache', async () => {
    try {
      clearConversions();
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
}
