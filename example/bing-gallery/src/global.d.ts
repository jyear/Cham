/** Type declarations for Cham plugin runtime */

interface ChamPluginApi {
  call(pluginId: string, channel: string, ...args: any[]): Promise<any>;
  subscribe(pluginId: string, channel: string, callback: (data: any) => void): () => void;
  getItem(pluginId: string, key: string): Promise<{ value: string }>;
  setItem(pluginId: string, key: string, value: string): Promise<void>;
  removeItem(pluginId: string, key: string): Promise<void>;
  listItems(pluginId: string): Promise<{ items: Array<{ key: string; value: string }> }>;
  listInstalled(): Promise<{ plugins: Array<{ manifest: any }> }>;
  install(url: string): Promise<{ manifest: any }>;
  uninstall(id: string): Promise<void>;
  isActive(id: string): Promise<boolean>;
  emitHook(name: string, ...args: any[]): Promise<void>;
}

interface ChamWindow {
  selectFiles(): Promise<Array<{ path: string; name: string; size: number; ext: string }>>;
  selectFolder(): Promise<{ folderPath: string; files: Array<{ path: string; name: string; size: number; ext: string }> }>;
  selectOutputDir(): Promise<string | null>;
  getFileHash(path: string): Promise<{ hash: string }>;
  readImage(path: string): Promise<{ dataUrl: string }>;
  loadSettings(): Promise<{ success: boolean; settings: Record<string, string> }>;
  saveSettings(settings: Record<string, string>): Promise<void>;
  clearCache(): Promise<void>;
  watchStart(path: string): Promise<void>;
  watchStop(): Promise<void>;
  deleteFile(path: string): Promise<void>;
  deleteDir(path: string): Promise<void>;
  windowMinimize(): Promise<void>;
  windowMaximize(): Promise<void>;
  windowClose(): Promise<void>;
  registerTitleBarAction(action: { id: string; icon: string; tooltip: string; pluginId?: string }): Promise<{ success: boolean }>;
  removeTitleBarAction(id: string): Promise<{ success: boolean }>;
  getTitleBarActions(): Promise<Array<{ id: string; icon: string; tooltip: string; pluginId?: string }>>;
  triggerTitleBarAction(actionId: string): Promise<{ success: boolean }>;
  onTitleBarAction(callback: (payload: { actionId: string; pluginId?: string }) => void): () => void;
  onTitleBarActionsChanged(callback: (actions: Array<{ id: string; icon: string; tooltip: string; pluginId?: string }>) => void): () => void;
  plugin: ChamPluginApi;
  backgroundSet(input: string): Promise<{ success: boolean; dataUrl?: string; items?: any[]; error?: string }>;
}

declare global {
  interface Window {
    cham?: ChamWindow;
    __chamShared: {
      react: typeof import('react');
      reactDom: typeof import('react-dom');
      framerMotion: any;
    };
  }
}

export {};
