import { ipcMain } from 'electron';
import { loadAllSettings, saveSettings } from '../db';

export function registerSettingsHandlers(): void {
  // Load all settings from the database
  ipcMain.handle('load-settings', async () => {
    try {
      const settings = loadAllSettings();
      return { success: true, settings };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Save settings to the database
  ipcMain.handle('save-settings', async (_event, settings: Record<string, string>) => {
    try {
      saveSettings(settings);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
}
