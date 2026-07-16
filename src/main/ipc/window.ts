import { ipcMain, type BrowserWindow } from 'electron';

export interface TitleBarAction {
  id: string;
  icon: string;
  tooltip: string;
  /** If set, this action belongs to a specific plugin window (AppWindow), not the main title bar */
  pluginId?: string;
}

const titleBarActions = new Map<string, TitleBarAction>();

export function registerWindowHandlers(getMainWindow: () => BrowserWindow | null): void {
  ipcMain.handle('window-minimize', () => {
    getMainWindow()?.minimize();
  });

  ipcMain.handle('window-maximize', () => {
    const win = getMainWindow();
    if (win?.isMaximized()) {
      win.unmaximize();
    } else {
      win?.maximize();
    }
  });

  ipcMain.handle('window-close', () => {
    getMainWindow()?.close();
  });

  ipcMain.handle('window-is-maximized', () => {
    return getMainWindow()?.isMaximized() ?? false;
  });

  // Title bar custom actions
  ipcMain.handle('titlebar:register-action', (_event, action: TitleBarAction) => {
    titleBarActions.set(action.id, action);
    getMainWindow()?.webContents.send('titlebar-actions-changed', [...titleBarActions.values()]);
    return { success: true };
  });

  ipcMain.handle('titlebar:remove-action', (_event, id: string) => {
    titleBarActions.delete(id);
    getMainWindow()?.webContents.send('titlebar-actions-changed', [...titleBarActions.values()]);
    return { success: true };
  });

  ipcMain.handle('titlebar:get-actions', () => {
    return [...titleBarActions.values()];
  });

  ipcMain.handle('titlebar:trigger-action', (_event, actionId: string) => {
    const action = titleBarActions.get(actionId);
    getMainWindow()?.webContents.send('titlebar-action-triggered', { actionId, pluginId: action?.pluginId });
    return { success: true };
  });
}
