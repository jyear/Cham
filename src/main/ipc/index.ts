import { type BrowserWindow } from 'electron';
import { registerWindowHandlers } from './window';
import { registerFileHandlers } from './files';
import { registerConversionHandlers } from './conversion';
import { registerWatchHandlers } from './watch';
import { registerFileOpsHandlers } from './fileOps';
import { registerFormatOptionsHandlers } from './formatOptions';
import { registerCacheHandlers } from './cache';
import { registerSettingsHandlers } from './settings';
import { registerUpdateHandlers } from './update';

export { stopWatcher } from './watch';

/**
 * Register all IPC handlers. Call once during app startup.
 * @param getMainWindow — getter that returns the current main BrowserWindow (may be null)
 */
export function registerIpcHandlers(getMainWindow: () => BrowserWindow | null): void {
  registerWindowHandlers(getMainWindow);
  registerFileHandlers(getMainWindow);
  registerConversionHandlers(getMainWindow);
  registerWatchHandlers(getMainWindow);
  registerFileOpsHandlers();
  registerFormatOptionsHandlers();
  registerCacheHandlers();
  registerSettingsHandlers();
  registerUpdateHandlers(getMainWindow);
}
