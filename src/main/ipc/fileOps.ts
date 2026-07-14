import { ipcMain, app, type BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { getFileHash } from '../format';

/**
 * Validate that a path is within an allowed directory.
 * Prevents path traversal attacks (../../../etc/passwd).
 */
function isSafePath(filePath: string): boolean {
  const normalized = path.normalize(filePath);
  const allowedRoots = [app.getPath('userData'), app.getPath('temp')];
  return allowedRoots.some((root) => {
    const rootNorm = path.normalize(root) + path.sep;
    return normalized.startsWith(rootNorm);
  });
}

export function registerFileOpsHandlers(getMainWindow: () => BrowserWindow | null): void {
  // Delete a file (used by watch mode to clean up output)
  ipcMain.handle('delete-file', async (_event, filePath: string) => {
    try {
      if (!isSafePath(filePath)) {
        return { success: false, error: 'Path not allowed' };
      }
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
      if (!isSafePath(dirPath)) {
        return { success: false, error: 'Path not allowed' };
      }
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

  // Get file hash (used for change detection)
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
}
