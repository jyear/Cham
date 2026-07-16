import { ipcMain, app, type BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { isSafePath } from '../../shared/utils/pathUtils';
import { getMimeType } from '../../shared/utils/mime';

function getFileHash(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('md5');
    const stream = fs.createReadStream(filePath);
    stream.on('error', (err) => reject(err));
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

export function registerFileOpsHandlers(getMainWindow: () => BrowserWindow | null): void {
  // Delete a file (used by watch mode to clean up output)
  ipcMain.handle('delete-file', async (_event, filePath: string) => {
    try {
      const safeRoots = [app.getPath('userData'), app.getPath('temp')];
      if (!isSafePath(filePath, safeRoots)) {
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
      const safeRoots = [app.getPath('userData'), app.getPath('temp')];
      if (!isSafePath(dirPath, safeRoots)) {
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
      // Restrict to safe paths (same as delete-file)
      const safeRoots = [app.getPath('userData'), app.getPath('temp')];
      if (!isSafePath(filePath, safeRoots)) {
        return { success: false, error: 'Path not allowed' };
      }
      const data = fs.readFileSync(filePath);
      const ext = path.extname(filePath);
      const mime = getMimeType(ext);
      return { success: true, dataUrl: `data:${mime};base64,${data.toString('base64')}` };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
}
