import { contextBridge, ipcRenderer } from 'electron';

/**
 * Type definitions for the API exposed to the renderer.
 */
export interface FileInfo {
  path: string;
  name: string;
  size: number;
  ext: string;
}

export interface FolderResult {
  folderPath: string;
  files: FileInfo[];
}

export interface WatchChangeEvent {
  event: 'add' | 'change' | 'unlink' | 'unlinkDir';
  file?: FileInfo;
  path?: string;
}

export interface ConvertResult {
  inputPath: string;
  outputPath?: string;
  outputSize?: number;
  success: boolean;
  cached?: boolean;
  copied?: boolean;
  error?: string;
}

export interface ChamAPI {
  // File / Conversion
  selectFiles: () => Promise<FileInfo[]>;
  selectFolder: () => Promise<FolderResult>;
  selectOutputDir: () => Promise<string | null>;
  convertImage: (params: {
    inputPath: string;
    outputDir: string;
    quality?: number;
    keepName?: boolean;
    copyNonConvertible?: boolean;
    format?: string;
    options?: Record<string, number | boolean | string>;
  }) => Promise<ConvertResult>;
  convertImages: (params: {
    files: FileInfo[];
    outputDir: string;
    quality?: number;
    keepName?: boolean;
    copyNonConvertible?: boolean;
    format?: string;
    options?: Record<string, number | boolean | string>;
  }) => Promise<ConvertResult[]>;
  getFileHash: (filePath: string) => Promise<{ success: boolean; hash?: string; error?: string }>;
  readImage: (filePath: string) => Promise<{ success: boolean; dataUrl?: string; error?: string }>;
  checkCached: (inputPath: string) => Promise<{ cached: boolean; outputPath?: string; error?: string }>;
  loadSettings: () => Promise<{ success: boolean; settings?: Record<string, string>; error?: string }>;
  saveSettings: (settings: Record<string, string>) => Promise<{ success: boolean; error?: string }>;
  saveFormatOptions: (formatType: string, options: Record<string, any>) => Promise<{ success: boolean; error?: string }>;
  loadFormatOptions: (formatType: string) => Promise<{ success: boolean; options?: Record<string, any> | null; error?: string }>;
  clearCache: () => Promise<{ success: boolean; error?: string }>;
  checkUpdate: () => Promise<any>;
  getAppVersion: () => Promise<string>;
  downloadUpdate: () => Promise<{ success: boolean; filePath?: string; error?: string }>;
  getUpdateStatus: () => Promise<any>;
  getLastDownloadPath: () => Promise<string | null>;
  installUpdate: () => Promise<{ success: boolean; error?: string }>;
  onUpdateAvailable: (cb: (status: any) => void) => () => void;
  onUpdateProgress: (cb: (data: { progress: number; done?: boolean }) => void) => () => void;

  // Watch mode
  watchStart: (folderPath: string) => Promise<{ success: boolean; error?: string }>;
  watchStop: () => Promise<{ success: boolean }>;
  onWatchChange: (callback: (ev: WatchChangeEvent) => void) => () => void;
  deleteFile: (filePath: string) => Promise<{ success: boolean; error?: string }>;
  deleteDir: (dirPath: string) => Promise<{ success: boolean; error?: string }>;
  onConvertProgress: (cb: (result: ConvertResult) => void) => () => void;

  // Window controls
  windowMinimize: () => Promise<void>;
  windowMaximize: () => Promise<void>;
  windowClose: () => Promise<void>;
  windowIsMaximized: () => Promise<boolean>;
  onWindowStateChanged: (callback: (state: { maximized: boolean }) => void) => () => void;
}

// Expose protected methods via contextBridge
contextBridge.exposeInMainWorld('cham', {
  // File / Conversion
  selectFiles: () => ipcRenderer.invoke('select-files'),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  selectOutputDir: () => ipcRenderer.invoke('select-output-dir'),
  convertImage: (params: {
    inputPath: string;
    outputDir: string;
    quality?: number;
    keepName?: boolean;
    copyNonConvertible?: boolean;
    format?: string;
  }) => ipcRenderer.invoke('convert-image', params),
  convertImages: (params: {
    files: FileInfo[];
    outputDir: string;
    quality?: number;
    keepName?: boolean;
    copyNonConvertible?: boolean;
    format?: string;
  }) => ipcRenderer.invoke('convert-images', params),
  getFileHash: (filePath: string) => ipcRenderer.invoke('get-file-hash', filePath),
  readImage: (filePath: string) => ipcRenderer.invoke('read-image', filePath),
  checkCached: (inputPath: string) => ipcRenderer.invoke('check-cached', inputPath),
  loadSettings: () => ipcRenderer.invoke('load-settings'),
  saveSettings: (settings: Record<string, string>) => ipcRenderer.invoke('save-settings', settings),
  saveFormatOptions: (formatType: string, options: Record<string, any>) =>
    ipcRenderer.invoke('save-format-options', formatType, options),
  loadFormatOptions: (formatType: string) => ipcRenderer.invoke('load-format-options', formatType),
  clearCache: () => ipcRenderer.invoke('clear-cache'),
  checkUpdate: () => ipcRenderer.invoke('check-update'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  getUpdateStatus: () => ipcRenderer.invoke('get-update-status'),
  getLastDownloadPath: () => ipcRenderer.invoke('get-last-download-path'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  onUpdateAvailable: (cb: (status: any) => void) => {
    const handler = (_e: any, s: any) => cb(s);
    ipcRenderer.on('update-available', handler);
    return () => ipcRenderer.removeListener('update-available', handler);
  },
  onUpdateProgress: (cb: (data: { progress: number; done?: boolean }) => void) => {
    const handler = (_e: any, data: { progress: number; done?: boolean }) => cb(data);
    ipcRenderer.on('update-progress', handler);
    return () => ipcRenderer.removeListener('update-progress', handler);
  },

  // Watch mode
  watchStart: (folderPath: string) => ipcRenderer.invoke('watch-start', folderPath),
  watchStop: () => ipcRenderer.invoke('watch-stop'),
  onWatchChange: (callback: (ev: WatchChangeEvent) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, ev: WatchChangeEvent) => callback(ev);
    ipcRenderer.on('watch-change', handler);
    return () => ipcRenderer.removeListener('watch-change', handler);
  },
  deleteFile: (filePath: string) => ipcRenderer.invoke('delete-file', filePath),
  deleteDir: (dirPath: string) => ipcRenderer.invoke('delete-dir', dirPath),
  onConvertProgress: (cb: (result: ConvertResult) => void) => {
    const handler = (_e: any, r: ConvertResult) => cb(r);
    ipcRenderer.on('convert-progress', handler);
    return () => ipcRenderer.removeListener('convert-progress', handler);
  },

  // Window controls
  windowMinimize: () => ipcRenderer.invoke('window-minimize'),
  windowMaximize: () => ipcRenderer.invoke('window-maximize'),
  windowClose: () => ipcRenderer.invoke('window-close'),
  windowIsMaximized: () => ipcRenderer.invoke('window-is-maximized'),
  onWindowStateChanged: (callback: (state: { maximized: boolean }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, state: { maximized: boolean }) =>
      callback(state);
    ipcRenderer.on('window-state-changed', handler);
    // Return unsubscribe function
    return () => ipcRenderer.removeListener('window-state-changed', handler);
  },
} satisfies ChamAPI);
