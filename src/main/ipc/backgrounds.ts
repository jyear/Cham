import { ipcMain, dialog, app, type BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { add, getAll, setSelected, remove, type BackgroundRecord } from '../db';
import { getMimeType } from '../../shared/utils/mime';
import { downloadFile } from '../utils/http';

function getBgDir(): string {
  const dir = path.join(app.getPath('userData'), 'backgrounds');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
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

export function registerBackgroundHandlers(getMainWindow: () => BrowserWindow | null): void {
  // List all backgrounds
  ipcMain.handle('background:list', async () => {
    try {
      const records = getAll();
      return { success: true, items: records.map(recordToItem) };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Select and add a new background image
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
      const ext = path.extname(srcPath);
      const uniqueName = `${crypto.randomBytes(8).toString('hex')}${ext}`;
      const destPath = path.join(getBgDir(), uniqueName);

      fs.copyFileSync(srcPath, destPath);

      const filename = path.basename(srcPath);
      const record = add(destPath, filename);

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

  // Set active background
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

  // Delete a background
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

  // Set background from URL (for plugins)
  ipcMain.handle('background:setFromUrl', async (_event, url: string) => {
    try {
      // Download to backgrounds directory
      const bgDir = getBgDir();
      const ext = path.extname(new URL(url).pathname).toLowerCase() || '.jpg';
      const filename = `bg_${Date.now()}${ext}`;
      const destPath = path.join(bgDir, filename);

      await downloadFile(url, destPath);
      console.log('[background] Downloaded from URL:', url);

      // Register in DB
      add(destPath, filename);

      // Set as active
      const records = getAll();
      const inserted = records[records.length - 1];
      if (inserted) {
        setSelected(inserted.id);
      }

      const active = records.find((r) => r.selected === 1);
      const dataUrl = active ? fileToDataUrl(active.path) : '';

      return { success: true, dataUrl, items: records.map(recordToItem) };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
}
