import { ipcMain, dialog, app, type BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { watch, type FSWatcher } from 'chokidar';
import { add, getAll, setSelected, remove, getByHash, type BackgroundRecord } from '../db';
import { getMimeType } from '../../shared/utils/mime';
import { downloadFile } from '../utils/http';

// ── Helpers ──

function getBgDir(): string {
  const dir = path.join(app.getPath('userData'), 'backgrounds');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function computeFileHash(filePath: string): string {
  const data = fs.readFileSync(filePath);
  return crypto.createHash('md5').update(data).digest('hex');
}

function fileToDataUrl(filePath: string): string {
  const data = fs.readFileSync(filePath);
  const mime = getMimeType(path.extname(filePath));
  return `data:${mime};base64,${data.toString('base64')}`;
}

function recordToItem(r: BackgroundRecord) {
  return {
    id: r.id,
    filename: r.filename,
    selected: r.selected === 1,
    dataUrl: fileToDataUrl(r.path),
  };
}

// ── Consistency check ──

/** Remove DB records whose backing files have been deleted.
 *  Auto-selects the most recent remaining if the active one was removed.
 *  Returns the count of removed records. */
function syncBackgrounds(win: BrowserWindow | null): number {
  const records = getAll();
  let removed = 0;

  for (const r of records) {
    if (!fs.existsSync(r.path)) {
      remove(r.id);
      removed++;
    }
  }

  if (removed > 0) {
    // If the active background was removed, pick a new one
    const remaining = getAll();
    if (remaining.length > 0 && !remaining.some((r) => r.selected === 1)) {
      setSelected(remaining[0].id);
    }
    // Push update so UI reflects the change
    if (win) {
      const refreshed = getAll();
      const active = refreshed.find((r) => r.selected === 1);
      const dataUrl = active ? fileToDataUrl(active.path) : '';
      const items = refreshed.map(recordToItem);
      win.webContents.send('background-changed', { dataUrl, items });
    }
  }

  return removed;
}

// ── Folder watcher ──

let bgWatcher: FSWatcher | null = null;

function startBgWatcher(getWin: () => BrowserWindow | null): void {
  if (bgWatcher) return;
  const bgDir = getBgDir();
  bgWatcher = watch(bgDir, { ignoreInitial: true });
  bgWatcher.on('unlink', () => {
    const removed = syncBackgrounds(getWin());
    if (removed > 0) {
      console.log(`[background] Watcher: removed ${removed} orphaned record(s)`);
    }
  });
}

function stopBgWatcher(): void {
  if (bgWatcher) {
    bgWatcher.close();
    bgWatcher = null;
  }
}

// ── Notify helper ──

function notifyRenderer(win: BrowserWindow | null) {
  if (!win) return;
  const records = getAll();
  const active = records.find((r) => r.selected === 1);
  const dataUrl = active ? fileToDataUrl(active.path) : '';
  const items = records.map(recordToItem);
  win.webContents.send('background-changed', { dataUrl, items });
}

// ── IPC Handlers ──

export function registerBackgroundHandlers(getMainWindow: () => BrowserWindow | null): void {

  // ── List all backgrounds ──
  ipcMain.handle('background:list', async () => {
    try {
      const records = getAll();
      return { success: true, items: records.map(recordToItem) };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // ── Select and add a new background image (file picker) ──
  ipcMain.handle('background:select', async () => {
    try {
      const win = getMainWindow();
      if (!win) return { success: false, error: 'No window' };

      const result = await dialog.showOpenDialog(win, {
        title: 'Select Background Image',
        filters: [
          { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'] },
        ],
        properties: ['openFile'],
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, error: 'Cancelled' };
      }

      const srcPath = result.filePaths[0];

      // Dedup: compute hash before copying
      const fileHash = computeFileHash(srcPath);
      const existing = getByHash(fileHash);
      if (existing) {
        // Already in library — just select it
        setSelected(existing.id);
        notifyRenderer(win);
        return { success: true, items: getAll().map(recordToItem), duplicate: true };
      }

      // New file — copy and register
      const ext = path.extname(srcPath);
      const uniqueName = `${crypto.randomBytes(8).toString('hex')}${ext}`;
      const destPath = path.join(getBgDir(), uniqueName);
      fs.copyFileSync(srcPath, destPath);

      const filename = path.basename(srcPath);
      const record = add(destPath, filename, fileHash);

      // Auto-select first background if none was selected before
      const all = getAll();
      if (all.filter((r) => r.selected === 1).length === 0) {
        setSelected(record.id);
      }

      const items = getAll().map(recordToItem);
      return { success: true, items };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // ── Set active background ──
  ipcMain.handle('background:set-active', async (_event, id: number) => {
    try {
      setSelected(id);
      const records = getAll();
      const active = records.find((r) => r.selected === 1);
      const dataUrl = active ? fileToDataUrl(active.path) : '';
      return { success: true, dataUrl, items: records.map(recordToItem) };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // ── Delete a background ──
  ipcMain.handle('background:delete', async (_event, id: number) => {
    try {
      const record = remove(id);
      if (record) {
        // Delete the file
        try {
          if (fs.existsSync(record.path)) {
            fs.unlinkSync(record.path);
          }
        } catch { /* file may already be gone */ }

        // If the deleted one was selected, auto-select the most recent remaining
        const remaining = getAll();
        if (record.selected === 1 && remaining.length > 0) {
          setSelected(remaining[0].id);
        }

        const items = getAll().map(recordToItem);
        const active = getAll().find((r) => r.selected === 1);
        const dataUrl = active ? fileToDataUrl(active.path) : '';
        return { success: true, dataUrl, items };
      }
      return { success: false, error: 'Not found' };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // ── Set background from URL (for plugins) ──
  ipcMain.handle('background:setFromUrl', async (_event, url: string) => {
    try {
      const bgDir = getBgDir();
      const ext = path.extname(new URL(url).pathname).toLowerCase() || '.jpg';
      const filename = `bg_${Date.now()}${ext}`;
      const destPath = path.join(bgDir, filename);

      await downloadFile(url, destPath);
      console.log('[background] Downloaded from URL:', url);

      // Dedup: compute hash and check for existing
      const fileHash = computeFileHash(destPath);
      const existing = getByHash(fileHash);
      if (existing) {
        // Duplicate — delete the just-downloaded file, select existing record
        try { fs.unlinkSync(destPath); } catch { /* ignore */ }
        setSelected(existing.id);
        console.log('[background] Duplicate detected, reusing existing record:', existing.id);

        const refreshed = getAll();
        const active = refreshed.find((r) => r.selected === 1);
        const dataUrl = active ? fileToDataUrl(active.path) : '';
        const items = refreshed.map(recordToItem);

        const win = getMainWindow();
        if (win) {
          win.webContents.send('background-changed', { dataUrl, items });
        }

        return { success: true, dataUrl, items, duplicate: true };
      }

      // New image — register in DB and set as active
      const inserted = add(destPath, filename, fileHash);
      setSelected(inserted.id);

      const refreshed = getAll();
      const active = refreshed.find((r) => r.selected === 1);
      const dataUrl = active ? fileToDataUrl(active.path) : '';
      const items = refreshed.map(recordToItem);

      const win = getMainWindow();
      if (win) {
        win.webContents.send('background-changed', { dataUrl, items });
      }

      return { success: true, dataUrl, items };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // ── Manual sync: check DB ↔ folder consistency ──
  ipcMain.handle('background:sync', async () => {
    try {
      const win = getMainWindow();
      const removed = syncBackgrounds(win);
      const items = getAll().map(recordToItem);
      const active = getAll().find((r) => r.selected === 1);
      const dataUrl = active ? fileToDataUrl(active.path) : '';
      return { success: true, removed, dataUrl, items };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
}

/** Run startup consistency check + begin folder watching.
 *  Must be called AFTER initDb(). */
export function initBackgrounds(getMainWindow: () => BrowserWindow | null): void {
  const removed = syncBackgrounds(getMainWindow());
  if (removed > 0) {
    console.log(`[background] Startup sync: removed ${removed} orphaned record(s)`);
  }
  startBgWatcher(getMainWindow);
}

/** Call on app quit to clean up the folder watcher. */
export { stopBgWatcher };
