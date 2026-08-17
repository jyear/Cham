export {};

declare global {
  interface FileInfo {
    path: string;
    name: string;
    size: number;
    ext: string;
  }

  interface FolderResult {
    folderPath: string;
    files: FileInfo[];
  }

  interface WatchChangeEvent {
    event: 'add' | 'change' | 'unlink' | 'unlinkDir';
    file?: FileInfo;
    path?: string;
  }

  interface DockEntry {
    app_key: string;
    icon: string;
    color: string;
    title: string;
    description: string | null;
    unresizable: number;
  }

  interface ConvertResult {
    inputPath: string;
    outputPath?: string;
    outputSize?: number;
    success: boolean;
    cached?: boolean;
    copied?: boolean;
    error?: string;
  }

  interface BackgroundItem {
    id: number;
    filename: string;
    selected: boolean;
    dataUrl: string;
  }

  interface ChamAPI {
    selectFiles: () => Promise<FileInfo[]>;
    selectFolder: () => Promise<FolderResult>;
    resolveDroppedPaths: (paths: string[]) => Promise<FolderResult>;
    selectOutputDir: () => Promise<string | null>;
    getFileHash: (filePath: string) => Promise<{ success: boolean; hash?: string; error?: string }>;
    readImage: (filePath: string) => Promise<{ success: boolean; dataUrl?: string; error?: string }>;
    backgroundList: () => Promise<{ success: boolean; items?: BackgroundItem[]; error?: string }>;
    backgroundSelect: () => Promise<{ success: boolean; items?: BackgroundItem[]; error?: string }>;
    backgroundSetActive: (id: number) => Promise<{ success: boolean; dataUrl?: string; items?: BackgroundItem[]; error?: string }>;
    backgroundDelete: (id: number) => Promise<{ success: boolean; dataUrl?: string; items?: BackgroundItem[]; error?: string }>;
    backgroundSetFromUrl: (url: string) => Promise<{ success: boolean; dataUrl?: string; items?: BackgroundItem[]; error?: string }>;
    backgroundSync: () => Promise<{ success: boolean; removed?: number; dataUrl?: string; items?: BackgroundItem[]; error?: string }>;
    loadSettings: () => Promise<{ success: boolean; settings?: Record<string, string>; error?: string }>;
    saveSettings: (settings: Record<string, string>) => Promise<{ success: boolean; error?: string }>;
    clearCache: () => Promise<{ success: boolean; error?: string }>;
    checkUpdate: () => Promise<any>;
    getAppVersion: () => Promise<string>;
    downloadUpdate: () => Promise<{ success: boolean; filePath?: string; error?: string }>;
    getUpdateStatus: () => Promise<any>;
    getLastDownloadPath: () => Promise<string | null>;
    installUpdate: () => Promise<{ success: boolean; error?: string }>;
    onBackgroundChanged: (cb: (data: { dataUrl: string; items: BackgroundItem[] }) => void) => () => void;
    onUpdateAvailable: (cb: (status: any) => void) => () => void;
    onUpdateProgress: (cb: (data: { progress: number; done?: boolean }) => void) => () => void;
    watchStart: (folderPath: string) => Promise<{ success: boolean; error?: string }>;
    watchStop: () => Promise<{ success: boolean }>;
    deleteFile: (filePath: string) => Promise<{ success: boolean; error?: string }>;
    deleteDir: (dirPath: string) => Promise<{ success: boolean; error?: string }>;
    loadDock: () => Promise<{ success: boolean; entries?: DockEntry[]; error?: string }>;
    saveDock: (entries: DockEntry[]) => Promise<{ success: boolean; error?: string }>;
    windowMinimize: () => Promise<void>;
    windowMaximize: () => Promise<void>;
    windowClose: () => Promise<void>;
    windowIsMaximized: () => Promise<boolean>;
    onWindowStateChanged: (callback: (state: { maximized: boolean }) => void) => () => void;

    registerTitleBarAction: (action: { id: string; icon: string; tooltip: string; pluginId?: string }) => Promise<{ success: boolean }>;
    removeTitleBarAction: (id: string) => Promise<{ success: boolean }>;
    getTitleBarActions: () => Promise<Array<{ id: string; icon: string; tooltip: string; pluginId?: string }>>;
    triggerTitleBarAction: (actionId: string) => Promise<{ success: boolean }>;
    onTitleBarAction: (callback: (payload: { actionId: string; pluginId?: string }) => void) => () => void;
    onTitleBarActionsChanged: (callback: (actions: Array<{ id: string; icon: string; tooltip: string; pluginId?: string }>) => void) => () => void;

    plugin: {
      listInstalled: () => Promise<{ success: boolean; plugins?: any[]; error?: string }>;
      install: (manifestUrl: string) => Promise<{ success: boolean; manifest?: any; error?: string }>;
      installLocal: (folderPath: string) => Promise<{ success: boolean; manifest?: any; error?: string }>;
      uninstall: (pluginId: string) => Promise<{ success: boolean; error?: string }>;
      fetchManifest: (manifestUrl: string) => Promise<{ success: boolean; manifest?: any; error?: string }>;
      loadComponent: (pluginId: string) => Promise<{ success: boolean; source?: string; error?: string }>;
      getItem: (pluginId: string, key: string) => Promise<{ success: boolean; value?: string | null; error?: string }>;
      setItem: (pluginId: string, key: string, value: string) => Promise<{ success: boolean; error?: string }>;
      removeItem: (pluginId: string, key: string) => Promise<{ success: boolean; error?: string }>;
      listItems: (pluginId: string) => Promise<{ success: boolean; items?: Array<{ key: string; value: string }>; error?: string }>;
      call: (pluginId: string, channel: string, ...args: any[]) => Promise<any>;
      isActive: (pluginId: string) => Promise<{ success: boolean; active: boolean; error?: string }>;
      emitHook: (hookName: string, ...args: any[]) => Promise<{ success: boolean; error?: string }>;
      loadI18n: (pluginId: string) => Promise<{
        success: boolean;
        translations?: Record<string, Record<string, string>>;
        error?: string;
      }>;
      subscribe: (pluginId: string, channel: string, cb: (...args: any[]) => void) => () => void;
      onInstallProgress: (cb: (data: { pluginId: string; progress: number; manifestUrl: string }) => void) => () => void;
    };
  }

  interface Window {
    cham: ChamAPI;
  }
}
