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

  interface ConvertResult {
    inputPath: string;
    outputPath?: string;
    outputSize?: number;
    success: boolean;
    cached?: boolean;
    copied?: boolean;
    error?: string;
  }

  interface ChamAPI {
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
    watchStart: (folderPath: string) => Promise<{ success: boolean; error?: string }>;
    watchStop: () => Promise<{ success: boolean }>;
    onWatchChange: (callback: (ev: WatchChangeEvent) => void) => () => void;
    deleteFile: (filePath: string) => Promise<{ success: boolean; error?: string }>;
    deleteDir: (dirPath: string) => Promise<{ success: boolean; error?: string }>;
    onConvertProgress: (cb: (result: ConvertResult) => void) => () => void;
    windowMinimize: () => Promise<void>;
    windowMaximize: () => Promise<void>;
    windowClose: () => Promise<void>;
    windowIsMaximized: () => Promise<boolean>;
    onWindowStateChanged: (callback: (state: { maximized: boolean }) => void) => () => void;
  }

  interface Window {
    cham: ChamAPI;
  }
}
