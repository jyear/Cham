import { ipcMain } from 'electron';
import { saveFormatOptions, loadFormatOptions } from '../db';

export function registerFormatOptionsHandlers(): void {
  ipcMain.handle('save-format-options', async (_event, formatType: string, options: Record<string, any>) => {
    try {
      saveFormatOptions(formatType, options);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('load-format-options', async (_event, formatType: string) => {
    try {
      const options = loadFormatOptions(formatType);
      return { success: true, options };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
}
