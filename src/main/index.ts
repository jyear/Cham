import { app, BrowserWindow, ipcMain, dialog, Menu } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { watch, type FSWatcher } from 'chokidar';
import { convertImage, getFileHash, type OutputFormat } from './format';
import { makeSourceId, init as initDb, close as closeDb } from './db';
import {
  findBySourceId,
  upsertConversion,
  clearConversions,
  loadAllSettings,
  saveSettings,
  saveFormatOptions,
  loadFormatOptions,
} from './db';
import { checkForUpdates, getUpdateStatus, downloadUpdate, getLastDownloadPath, installUpdate } from './update';

const isDev = process.env.NODE_ENV === 'development';
const DEV_SERVER_URL = 'http://localhost:9000';

let mainWindow: BrowserWindow | null = null;
let watcher: FSWatcher | null = null;

function createWindow(): void {
  // Remove default menu bar
  Menu.setApplicationMenu(null);

  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 860,
    minHeight: 560,
    frame: false,
    title: 'Cham - Image Converter',
    backgroundColor: '#0f0f14',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Dev: load from webpack-dev-server | Prod: load file from dist
  if (isDev) {
    mainWindow.loadURL(DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  // Notify renderer when maximize state changes
  mainWindow.on('maximize', () => {
    mainWindow?.webContents.send('window-state-changed', { maximized: true });
  });
  mainWindow.on('unmaximize', () => {
    mainWindow?.webContents.send('window-state-changed', { maximized: false });
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// --- Window Control IPC Handlers ---

ipcMain.handle('window-minimize', () => {
  mainWindow?.minimize();
});

ipcMain.handle('window-maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});

ipcMain.handle('window-close', () => {
  mainWindow?.close();
});

ipcMain.handle('window-is-maximized', () => {
  return mainWindow?.isMaximized() ?? false;
});

// --- File/Conversion IPC Handlers ---

// Select files (any type)
ipcMain.handle('select-files', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
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
  const result = await dialog.showOpenDialog(mainWindow!, {
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
  const result = await dialog.showOpenDialog(mainWindow!, {
    title: 'Select output directory',
    properties: ['openDirectory', 'createDirectory'],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return result.filePaths[0];
});

// Convert a single image to WebP (with SQLite caching)
ipcMain.handle(
  'convert-image',
  async (
    _event,
    params: {
      inputPath: string;
      outputDir: string;
      quality?: number;
      keepName?: boolean;
      copyNonConvertible?: boolean;
      format?: OutputFormat;
    }
  ) => {
    try {
      const fmt: OutputFormat = params.format ?? 'webp';
      const ext = path.extname(params.inputPath).toLowerCase();
      const isConvertible = ['.png', '.jpg', '.jpeg', '.gif', '.tiff', '.bmp'].includes(ext);

      const outputName = params.keepName
        ? path.basename(params.inputPath)
        : path.basename(params.inputPath).replace(/\.[^.]+$/, `.${fmt}`);

      const outputPath = path.join(params.outputDir, outputName);

      // Non-convertible files: copy instead of convert
      if (!isConvertible) {
        if (params.copyNonConvertible) {
          const dirname = path.dirname(outputPath);
          if (!fs.existsSync(dirname)) {
            fs.mkdirSync(dirname, { recursive: true });
          }
          fs.copyFileSync(params.inputPath, outputPath);
          return { success: true, outputPath, cached: false, copied: true };
        }
        return { success: false, error: 'File type not convertible and copy is disabled' };
      }

      // 1. Calculate input file hash → source_id
      const inputHash = await getFileHash(params.inputPath);
      const sourceId = makeSourceId(params.inputPath, inputHash);

      const quality = params.quality ?? 100;

      // 2. Look up cache record by source_id (unique)
      const record = findBySourceId(sourceId);

      // 3. Compare stored settings with current settings
      if (
        record &&
        record.format === fmt &&
        record.quality === quality &&
        record.output_path === outputPath
      ) {
        // 3a. Settings match — verify output file integrity
        if (fs.existsSync(record.output_path)) {
          const existingOutputHash = await getFileHash(record.output_path);
          if (existingOutputHash === record.output_hash) {
            // Output file exists and hash matches — genuine cache hit
            console.log('[convert] SKIP (cached):', params.inputPath);
            return { success: true, outputPath: record.output_path, cached: true };
          }
        }
        // Output file missing or hash mismatch
        console.log('[convert] RE-CONVERT (stale output):', params.inputPath);
      } else if (record) {
        // Settings changed — re-convert with new settings
        console.log(
          '[convert] RE-CONVERT (params changed):',
          params.inputPath,
          `fmt:${record.format}→${fmt} q:${record.quality}→${quality}`,
        );
      }

      // 4. Convert the image
      await convertImage(params.inputPath, outputPath, {
        quality,
        format: fmt,
        extraOptions: (params as any).options ?? {},
      });

      // 5. Calculate output hash and upsert database
      const outputHash = await getFileHash(outputPath);
      const outputSize = fs.statSync(outputPath).size;
      upsertConversion(sourceId, fmt, quality, outputPath, outputHash);

      return { success: true, outputPath, outputSize, cached: false };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
);

// Convert multiple images (with SQLite caching)
ipcMain.handle(
  'convert-images',
  async (
    _event,
    params: {
      files: Array<{ path: string; name: string }>;
      outputDir: string;
      quality?: number;
      keepName?: boolean;
      copyNonConvertible?: boolean;
      format?: OutputFormat;
    }
  ) => {
    const results: Array<{
      inputPath: string;
      outputPath?: string;
      outputSize?: number;
      success: boolean;
      cached?: boolean;
      copied?: boolean;
      error?: string;
    }> = [];
    const fmt: OutputFormat = params.format ?? 'webp';

    for (const file of params.files) {
      try {
        const ext = path.extname(file.name).toLowerCase();
        const isConvertible = ['.png', '.jpg', '.jpeg', '.gif', '.tiff', '.bmp'].includes(ext);

        const outputName = params.keepName
          ? file.name
          : file.name.replace(/\.[^.]+$/, `.${fmt}`);

        const outputPath = path.join(params.outputDir, outputName);

        // Non-convertible files: copy instead of convert
        if (!isConvertible) {
          if (params.copyNonConvertible) {
            const dirname = path.dirname(outputPath);
            if (!fs.existsSync(dirname)) {
              fs.mkdirSync(dirname, { recursive: true });
            }
            fs.copyFileSync(file.path, outputPath);
            const copySize = fs.statSync(outputPath).size;
            const result = { inputPath: file.path, outputPath, outputSize: copySize, success: true, cached: false, copied: true };
            results.push(result);
            if (mainWindow) mainWindow.webContents.send('convert-progress', result);
            continue;
          }
          const result = {
            inputPath: file.path,
            success: false,
            error: 'File type not convertible and copy is disabled',
          };
          results.push(result);
          if (mainWindow) mainWindow.webContents.send('convert-progress', result);
          continue;
        }

        const quality = params.quality ?? 100;

        // 1. Calculate input file hash → source_id
        const inputHash = await getFileHash(file.path);
        const sourceId = makeSourceId(file.path, inputHash);

        // 2. Look up cache record by source_id (unique)
        const record = findBySourceId(sourceId);

        // 3. Compare stored settings with current settings
        if (
          record &&
          record.format === fmt &&
          record.quality === quality &&
          record.output_path === outputPath
        ) {
          // 3a. Settings match — verify output file integrity
          if (fs.existsSync(record.output_path)) {
            const existingOutputHash = await getFileHash(record.output_path);
            if (existingOutputHash === record.output_hash) {
              // Output file exists and hash matches — genuine cache hit
              console.log('[convert] SKIP (cached):', file.path);
              const cachedSize = fs.statSync(record.output_path).size;
              const cachedResult = {
                inputPath: file.path,
                outputPath: record.output_path,
                outputSize: cachedSize,
                success: true,
                cached: true,
              };
              results.push(cachedResult);
              if (mainWindow) mainWindow.webContents.send('convert-progress', cachedResult);
              continue;
            }
          }
          // Output file missing or hash mismatch
          console.log('[convert] RE-CONVERT (stale output):', file.path);
        } else if (record) {
          // Settings changed — re-convert with new settings
          console.log(
            '[convert] RE-CONVERT (params changed):',
            file.path,
            `fmt:${record.format}→${fmt} q:${record.quality}→${quality}`,
          );
        }

        // 4. Convert the image
        console.log('[convert]', file.path, '→', outputPath);
        await convertImage(file.path, outputPath, {
          quality,
          format: fmt,
          extraOptions: (params as any).options ?? {},
        });

        // 5. Calculate output hash and upsert database
        const outputHash = await getFileHash(outputPath);
        const outputSize = fs.statSync(outputPath).size;
        upsertConversion(sourceId, fmt, quality, outputPath, outputHash);

        const okResult = { inputPath: file.path, outputPath, outputSize, success: true, cached: false };
        results.push(okResult);
        if (mainWindow) mainWindow.webContents.send('convert-progress', okResult);
      } catch (error: any) {
        console.error('[convert] FAILED', file.path, error.message, error.stack);
        const failResult = { inputPath: file.path, success: false, error: error.message };
        results.push(failResult);
        if (mainWindow) mainWindow.webContents.send('convert-progress', failResult);
      }
    }

    return results;
  }
);

// --- Watch Mode IPC Handlers ---

function stopWatcher(): void {
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
      if (mainWindow) {
        try {
          const info = getFileInfo(filePath, folderPath);
          mainWindow.webContents.send('watch-change', { event: 'add', file: info });
        } catch (e: any) {
          console.error('[watch] error reading added file:', e.message);
        }
      }
    });

    watcher.on('change', (filePath: string) => {
      console.log('[watch] change:', filePath);
      if (mainWindow) {
        try {
          const info = getFileInfo(filePath, folderPath);
          mainWindow.webContents.send('watch-change', { event: 'change', file: info });
        } catch (e: any) {
          console.error('[watch] error reading changed file:', e.message);
        }
      }
    });

    watcher.on('unlink', (filePath: string) => {
      console.log('[watch] unlink:', filePath);
      if (mainWindow) {
        mainWindow.webContents.send('watch-change', { event: 'unlink', path: filePath });
      }
    });

    watcher.on('unlinkDir', (dirPath: string) => {
      console.log('[watch] unlinkDir:', dirPath);
      if (mainWindow) {
        mainWindow.webContents.send('watch-change', { event: 'unlinkDir', path: dirPath });
      }
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

// Delete a file (used by watch mode to clean up output)
ipcMain.handle('delete-file', async (_event, filePath: string) => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log('[delete] file:', filePath);
    }
    return { success: true };
  } catch (error: any) {
    console.error('[delete] file error:', error.message);
    return { success: false, error: error.message };
  }
});

// Delete a directory recursively (used by watch mode to clean up output)
ipcMain.handle('delete-dir', async (_event, dirPath: string) => {
  try {
    if (fs.existsSync(dirPath)) {
      fs.rmSync(dirPath, { recursive: true, force: true });
      console.log('[delete] dir:', dirPath);
    }
    return { success: true };
  } catch (error: any) {
    console.error('[delete] dir error:', error.message);
    return { success: false, error: error.message };
  }
});

// Get file hash (used for change detection, from cham-cli)
ipcMain.handle('get-file-hash', async (_event, filePath: string) => {
  try {
    const hash = await getFileHash(filePath);
    return { success: true, hash };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// Read image file and return base64 data URL for thumbnail display
ipcMain.handle('read-image', async (_event, filePath: string) => {
  try {
    const data = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const mimeMap: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.bmp': 'image/bmp',
      '.tiff': 'image/tiff',
    };
    const mime = mimeMap[ext] || 'image/png';
    return { success: true, dataUrl: `data:${mime};base64,${data.toString('base64')}` };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// --- Format Options IPC Handlers ---

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

// --- Cache IPC Handlers ---

ipcMain.handle('clear-cache', async () => {
  try {
    clearConversions();
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// --- Settings IPC Handlers ---

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

// --- Update IPC Handlers ---

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
      if (mainWindow) {
        mainWindow.webContents.send('update-progress', { progress: pct });
      }
    });
    if (mainWindow) {
      mainWindow.webContents.send('update-progress', { progress: 100, done: true });
    }
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

// Check if a conversion is already cached (quick lookup without converting)
ipcMain.handle('check-cached', async (_event, inputPath: string, format: string, quality: number) => {
  try {
    const q = quality ?? 100;
    const fmt = format || 'webp';
    const inputHash = await getFileHash(inputPath);
    const sourceId = makeSourceId(inputPath, inputHash);

    // Look up by source_id, then compare params in app layer
    const record = findBySourceId(sourceId);

    if (record && record.format === fmt && record.quality === q) {
      if (fs.existsSync(record.output_path)) {
        const outputHash = await getFileHash(record.output_path);
        if (outputHash === record.output_hash) {
          return { cached: true, outputPath: record.output_path };
        }
      }
    }
    return { cached: false };
  } catch (error: any) {
    return { cached: false, error: error.message };
  }
});

// App lifecycle
app.whenReady().then(() => {
  initDb();
  createWindow();
  // Check for updates silently on startup
  checkForUpdates().then((s) => {
    if (s.updateAvailable && mainWindow) {
      mainWindow.webContents.send('update-available', s);
    }
  });
});

app.on('window-all-closed', () => {
  stopWatcher();
  closeDb();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
