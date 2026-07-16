import { ipcMain, dialog, type BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

function getWin(getMainWindow: () => BrowserWindow | null): BrowserWindow {
  const win = getMainWindow();
  if (!win) throw new Error('Main window not available');
  return win;
}

export function registerFileHandlers(getMainWindow: () => BrowserWindow | null): void {
  // Select files (any type)
  ipcMain.handle('select-files', async () => {
    const result = await dialog.showOpenDialog(getWin(getMainWindow), {
      title: 'Select files',
      filters: [
        { name: 'All Files', extensions: ['*'] },
        { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'tiff', 'bmp'] },
      ],
      properties: ['openFile', 'multiSelections'],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return [];
    }

    return result.filePaths.map((filePath) => {
      const stats = fs.statSync(filePath);
      return {
        path: filePath,
        name: path.basename(filePath),
        size: stats.size,
        ext: path.extname(filePath).toLowerCase(),
      };
    });
  });

  // Select folder and return files + folder path
  ipcMain.handle('select-folder', async () => {
    const result = await dialog.showOpenDialog(getWin(getMainWindow), {
      title: 'Select folder',
      properties: ['openDirectory'],
    });
    if (result.canceled || result.filePaths.length === 0) return { folderPath: '', files: [] };

    const folderPath = result.filePaths[0];
    const collected: Array<{ path: string; name: string; size: number; ext: string }> = [];

    function walk(dir: string): void {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(fullPath);
        } else if (entry.isFile()) {
          const stats = fs.statSync(fullPath);
          collected.push({
            path: fullPath,
            name: path.relative(folderPath, fullPath),
            size: stats.size,
            ext: path.extname(entry.name).toLowerCase(),
          });
        }
      }
    }
    walk(folderPath);
    return { folderPath, files: collected };
  });

  // Select output directory
  ipcMain.handle('select-output-dir', async () => {
    const result = await dialog.showOpenDialog(getWin(getMainWindow), {
      title: 'Select output directory',
      properties: ['openDirectory', 'createDirectory'],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0];
  });
}
