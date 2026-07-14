import { app, BrowserWindow, Menu } from 'electron';
import * as path from 'path';
import { registerIpcHandlers, stopWatcher, destroyConversionPool } from './ipc';
import { init as initDb, close as closeDb } from './db';
import { checkForUpdates } from './update';
import { pluginHost } from './plugin/host';

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
  createWindow();

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
  stopWatcher();
  destroyConversionPool();
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
