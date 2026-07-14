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
import { registerBackgroundHandlers } from './backgrounds';
import { registerDockHandlers } from './dock';
import { registerPluginHandlers } from './plugin';

export { stopWatcher } from './watch';
export { destroyConversionPool } from './conversion';

/**
 * Register all IPC handlers. Call once during app startup.
 * @param getMainWindow — getter that returns the current main BrowserWindow (may be null)
 */
export function registerIpcHandlers(getMainWindow: () => BrowserWindow | null): void {
  registerWindowHandlers(getMainWindow);
  registerFileHandlers(getMainWindow);
  registerConversionHandlers(getMainWindow);
  registerWatchHandlers(getMainWindow);
  registerFileOpsHandlers(getMainWindow);
  registerFormatOptionsHandlers();
  registerCacheHandlers();
  registerSettingsHandlers();
  registerUpdateHandlers(getMainWindow);
  registerBackgroundHandlers(getMainWindow);
  registerDockHandlers();
  registerPluginHandlers(getMainWindow);
}
