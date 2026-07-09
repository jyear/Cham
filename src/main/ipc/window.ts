import { ipcMain, type BrowserWindow } from 'electron';

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
}
