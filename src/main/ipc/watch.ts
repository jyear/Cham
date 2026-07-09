import { ipcMain, type BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { watch, type FSWatcher } from 'chokidar';

let watcher: FSWatcher | null = null;

export function stopWatcher(): void {
  if (watcher) {
    watcher.close();
    watcher = null;
    console.log('[watch] stopped');
  }
}

function getFileInfo(filePath: string, folderPath: string) {
  const stats = fs.statSync(filePath);
  return {
    path: filePath,
    name: path.relative(folderPath, filePath),
    size: stats.size,
    ext: path.extname(filePath).toLowerCase(),
  };
}

export function registerWatchHandlers(getMainWindow: () => BrowserWindow | null): void {
  ipcMain.handle('watch-start', async (_event, folderPath: string) => {
    try {
      stopWatcher();

      watcher = watch(folderPath, {
        ignored: /(^|[\/\\])\../, // ignore dotfiles
        persistent: true,
        ignoreInitial: true,
        depth: 99, // deep watching
        awaitWriteFinish: {
          stabilityThreshold: 400,
          pollInterval: 100,
        },
      });

      watcher.on('add', (filePath: string) => {
        console.log('[watch] add:', filePath);
        const win = getMainWindow();
        if (win) {
          try {
            const info = getFileInfo(filePath, folderPath);
            win.webContents.send('watch-change', { event: 'add', file: info });
          } catch (e: any) {
            console.error('[watch] error reading added file:', e.message);
          }
        }
      });

      watcher.on('change', (filePath: string) => {
        console.log('[watch] change:', filePath);
        const win = getMainWindow();
        if (win) {
          try {
            const info = getFileInfo(filePath, folderPath);
            win.webContents.send('watch-change', { event: 'change', file: info });
          } catch (e: any) {
            console.error('[watch] error reading changed file:', e.message);
          }
        }
      });

      watcher.on('unlink', (filePath: string) => {
        console.log('[watch] unlink:', filePath);
        getMainWindow()?.webContents.send('watch-change', { event: 'unlink', path: filePath });
      });

      watcher.on('unlinkDir', (dirPath: string) => {
        console.log('[watch] unlinkDir:', dirPath);
        getMainWindow()?.webContents.send('watch-change', { event: 'unlinkDir', path: dirPath });
      });

      watcher.on('error', (error: any) => {
        console.error('[watch] error:', error);
      });

      console.log('[watch] started on:', folderPath);
      return { success: true };
    } catch (error: any) {
      console.error('[watch] failed to start:', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('watch-stop', async () => {
    stopWatcher();
    return { success: true };
  });
}
