import { type BrowserWindow } from 'electron';
import { registerWindowHandlers } from './window';
import { registerFileHandlers } from './files';
import { registerFileOpsHandlers } from './fileOps';
import { registerSettingsHandlers } from './settings';
import { registerUpdateHandlers } from './update';
import { registerBackgroundHandlers } from './backgrounds';
import { registerDockHandlers } from './dock';
import { registerPluginHandlers } from './plugin';

/**
 * Register global IPC handlers (not owned by a plugin).
 *
 * Conversion-related handlers (convert-image, watch-start, etc.) are
 * now registered by the Conversion builtin plugin via PluginMainApi.
 *
 * @param getMainWindow — getter that returns the current main BrowserWindow (may be null)
 */
export function registerIpcHandlers(getMainWindow: () => BrowserWindow | null): void {
  registerWindowHandlers(getMainWindow);
  registerFileHandlers(getMainWindow);
  registerFileOpsHandlers(getMainWindow);
  registerSettingsHandlers();
  registerUpdateHandlers(getMainWindow);
  registerBackgroundHandlers(getMainWindow);
  registerDockHandlers();
  registerPluginHandlers(getMainWindow);
}
