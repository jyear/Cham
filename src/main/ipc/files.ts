import { ipcMain, dialog, type BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

function getWin(getMainWindow: () => BrowserWindow | null): BrowserWindow {
  const win = getMainWindow();
  if (!win) throw new Error('Main window not available');
  return win;
}

export function registerFileHandlers(getMainWindow: () => BrowserWindow | null): void {
  function collectFilesFromPaths(inputPaths: string[]): { folderPath: string; files: Array<{ path: string; name: string; size: number; ext: string }> } {
    const collected: Array<{ path: string; name: string; size: number; ext: string }> = [];
    let folderPath = '';

    for (const inputPath of inputPaths) {
      try {
        const stats = fs.statSync(inputPath);
        if (stats.isDirectory()) {
          if (inputPaths.length === 1) folderPath = inputPath;

          function walk(dir: string): void {
            let entries: fs.Dirent[];
            try {
              entries = fs.readdirSync(dir, { withFileTypes: true });
            } catch {
              return;
            }

            for (const entry of entries) {
              const fullPath = path.join(dir, entry.name);
              if (entry.isDirectory()) {
                walk(fullPath);
              } else if (entry.isFile()) {
                try {
                  const fileStats = fs.statSync(fullPath);
                  collected.push({
                    path: fullPath,
                    name: path.relative(inputPath, fullPath),
                    size: fileStats.size,
                    ext: path.extname(entry.name).toLowerCase(),
                  });
                } catch {
                  // Ignore files that disappear or become inaccessible while scanning.
                }
              }
            }
          }

          walk(inputPath);
        } else if (stats.isFile()) {
          collected.push({
            path: inputPath,
            name: path.basename(inputPath),
            size: stats.size,
            ext: path.extname(inputPath).toLowerCase(),
          });
        }
      } catch {
        // Ignore dropped paths that are no longer available.
      }
    }

    const uniqueFiles = collected.filter((file, index) =>
      collected.findIndex((candidate) => candidate.path === file.path) === index,
    );

    return {
      folderPath,
      files: uniqueFiles,
    };
  }

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

  // Resolve files and folders supplied by an OS drag-and-drop operation.
  ipcMain.handle('resolve-dropped-paths', async (_event, inputPaths: unknown) => {
    if (!Array.isArray(inputPaths)) return { folderPath: '', files: [] };

    const paths = inputPaths.filter((inputPath): inputPath is string =>
      typeof inputPath === 'string' && inputPath.length > 0,
    );
    return collectFilesFromPaths(paths);
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
