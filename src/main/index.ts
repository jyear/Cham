import { app, BrowserWindow, Menu } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { registerIpcHandlers } from './ipc';
import { initBackgrounds, stopBgWatcher } from './ipc/backgrounds';
import { init as initDb, close as closeDb } from './db';
import { checkForUpdates } from './update';
import { pluginHost } from './plugin/host';
import { insertManifest } from './db/plugins';
import type { PluginManifest, PluginMainModule } from '../shared/plugin/types';

// ── GPU crash workaround (Windows, exit_code=-1073741819 / 34) ──
// The GPU process crashes with access violations on some Windows GPU drivers
// when rendering frameless windows with CSS backdrop-filter / transparency.
// Disabling hardware acceleration avoids the GPU entirely — the app will use
// software rendering, which is slightly slower but stable.
if (process.platform === 'win32') {
  app.disableHardwareAcceleration();
}

/** Auto-discover builtin plugins under plugins/builtin/ */
function registerBuiltinPlugins(): void {
  try {
    // webpack require.context — static analysis discovers all index.ts files
    const ctx = (require as any).context('./plugins/builtin', true, /index\.ts$/);
    for (const key of ctx.keys()) {
      const mod = ctx(key) as { default?: PluginMainModule; manifest?: PluginManifest };
      if (mod.manifest && mod.default) {
        pluginHost.registerBuiltin(mod.manifest, mod.default);
        console.log(`[main] Registered builtin: ${mod.manifest.id}`);
      }
    }
  } catch {
    // Fallback for non-webpack environments: manually import known plugins
    console.warn('[main] require.context not available — loading builtins manually');
    try {
      const mod = require('./plugins/builtin/conversion/index');
      if (mod.manifest && mod.default) {
        pluginHost.registerBuiltin(mod.manifest, mod.default);
      }
    } catch (e: any) {
      console.error('[main] Failed to load builtin plugins:', e.message);
    }
  }
}

/**
 * Register a local dev plugin so it appears as "installed" without copying
 * files to userData. Usage: pnpm dev -- --dev-plugin /path/to/my-plugin
 */
function registerDevPlugin(): void {
  const idx = process.argv.indexOf('--dev-plugin');
  if (idx === -1) return;
  const devPath = path.resolve(process.argv[idx + 1] || '');
  if (!devPath || !fs.existsSync(devPath)) {
    console.warn('[main] --dev-plugin path not found:', devPath);
    return;
  }

  const manifestPath = path.join(devPath, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    console.warn('[main] manifest.json not found in dev plugin dir');
    return;
  }

  const manifest: PluginManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  const distDir = path.join(devPath, 'dist');

  // Register in DB so renderer PluginRegistry finds it
  insertManifest(manifest.id, manifest, distDir, manifest.version);
  console.log(`[main] Dev plugin registered: ${manifest.id} → ${distDir}`);
}

const isDev = process.env.NODE_ENV === 'development';
const DEV_SERVER_URL = 'http://localhost:9000';

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  // Remove default menu bar
  Menu.setApplicationMenu(null);

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 1200,
    minHeight: 800,
    frame: false,
    title: 'Cham - Image Converter',
    backgroundColor: '#0f0f14',
    icon: path.join(__dirname, '../../assets/icons/icon.png'),
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

// Register all IPC handlers (must be called before app.whenReady, as handlers register synchronously)
// Pass a getter so handlers always read the current mainWindow at invocation time
registerIpcHandlers(() => mainWindow);

// App lifecycle
app.whenReady().then(async () => {
  initDb();
  initBackgrounds(() => mainWindow);
  createWindow();

  // Give host access to the main window for push events
  pluginHost.setMainWindowGetter(() => mainWindow);

  // Auto-discover and register all builtin plugins
  registerBuiltinPlugins();

  // Register dev plugin from --dev-plugin <path>
  registerDevPlugin();

  // Activate all installed plugins' main modules
  await pluginHost.start();

  // Check for updates silently on startup
  checkForUpdates().then((s) => {
    if (s.updateAvailable && mainWindow) {
      mainWindow.webContents.send('update-available', s);
    }
  });
});

app.on('window-all-closed', () => {
  // Deactivate all plugin main modules (runs their cleanup)
  pluginHost.deactivateAll();
  stopBgWatcher();
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
