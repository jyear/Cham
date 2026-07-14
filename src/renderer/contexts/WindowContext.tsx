import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import type { IconType } from '@/components/Icon';
import { WindowMode } from '@/components/AppWindow/types';
import { loadAppDefs } from '@/utils/appDefs';
import { pluginRegistry } from '@/plugins/registry';

export { WindowMode } from '@/components/AppWindow/types';

export interface AppWindowState {
  id: string;
  appKey: string;
  icon: IconType;
  color: string;
  title: string;
  description?: string;
  unresizable?: boolean;
  order: number;
  mode: WindowMode;
  zIndex: number;
  minWidth: number;
  minHeight: number;
  Component: React.ComponentType;
}

export interface AppDefinition {
  key: string;
  icon: IconType;
  color: string;
  title: string;
  description?: string;
  unresizable?: boolean;
  minWidth?: number;
  minHeight?: number;
  Component: React.ComponentType;
}

export interface DesktopBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface FooterRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface WindowContextValue {
  windows: AppWindowState[];
  pinnedApps: AppDefinition[];
  desktopBounds: DesktopBounds | null;
  footerRects: Record<string, FooterRect>;
  setDesktopBounds: (b: DesktopBounds) => void;
  setFooterRect: (appKey: string, rect: FooterRect) => void;
  openApp: (app: AppDefinition) => void;
  closeApp: (id: string) => void;
  minimizeApp: (id: string) => void;
  maximizeApp: (id: string) => void;
  focusApp: (id: string) => void;
  restoreApp: (id: string) => void;
  pinApp: (app: AppDefinition) => void;
  unpinApp: (key: string) => void;
  isPinned: (key: string) => boolean;
}

const WindowContext = createContext<WindowContextValue | null>(null);

let nextZ = 10;
let nextOrder = 0;

function persistDock(apps: AppDefinition[]): void {
  const entries = apps.map((a) => ({
    app_key: a.key,
    icon: a.icon,
    color: a.color,
    title: a.title,
    description: a.description ?? null,
    unresizable: a.unresizable ? 1 : 0,
  }));
  window.cham.saveDock(entries).catch((e) => console.error('Failed to save dock:', e));
}

export function WindowProvider({ children }: { children: React.ReactNode }) {
  const [windows, setWindows] = useState<AppWindowState[]>([]);
  const [pinnedApps, setPinnedApps] = useState<AppDefinition[]>([]);
  const [desktopBounds, setDesktopBounds] = useState<DesktopBounds | null>(null);
  const [footerRects, setFooterRects] = useState<Record<string, FooterRect>>({});
  const loadedRef = useRef(false);

  // Initialize plugin registry, then load pinned apps from SQLite on mount
  useEffect(() => {
    // Ensure registry is initialized (loads store plugins) before reading dock
    pluginRegistry.init().then(() => {
      return window.cham.loadDock();
    }).then((result) => {
      if (!result.success || !result.entries || result.entries.length === 0) return;

      const allDefs = loadAppDefs();
      const defMap = new Map(allDefs.map((d) => [d.key, d]));

      const restored: AppDefinition[] = [];
      for (const entry of result.entries) {
        const def = defMap.get(entry.app_key);
        if (def) {
          // Use the stored metadata, but the Component from the current module
          restored.push({
            key: def.key,
            icon: (entry.icon as IconType) ?? def.icon,
            color: entry.color || def.color,
            title: entry.title || def.title,
            description: entry.description ?? def.description,
            unresizable: entry.unresizable === 1,
            minWidth: def.minWidth,
            minHeight: def.minHeight,
            Component: def.Component,
          });
        }
      }

      if (restored.length > 0) {
        setPinnedApps(restored);
      }
      loadedRef.current = true;
    }).catch((e) => console.error('Failed to load dock:', e));
  }, []);

  // Persist on changes (skip initial load)
  useEffect(() => {
    if (!loadedRef.current) return;
    persistDock(pinnedApps);
  }, [pinnedApps]);

  const setFooterRect = useCallback((appKey: string, rect: FooterRect) => {
    setFooterRects((prev) => {
      const prevRect = prev[appKey];
      if (
        prevRect &&
        prevRect.left === rect.left &&
        prevRect.top === rect.top &&
        prevRect.width === rect.width &&
        prevRect.height === rect.height
      ) {
        return prev;
      }
      return { ...prev, [appKey]: rect };
    });
  }, []);

  const openApp = useCallback((app: AppDefinition) => {
    setWindows((prev) => {
      const existing = prev.find((w) => w.appKey === app.key);
      if (existing) {
        return prev.map((w) =>
          w.appKey === app.key
            ? { ...w, mode: WindowMode.Normal, zIndex: ++nextZ }
            : w,
        );
      }
      return [
        ...prev,
        {
          id: `${app.key}-${Date.now()}`,
          appKey: app.key,
          icon: app.icon,
          color: app.color,
          title: app.title,
          description: app.description,
          unresizable: app.unresizable,
          order: ++nextOrder,
          mode: WindowMode.Normal,
          zIndex: ++nextZ,
          minWidth: app.minWidth ?? 600,
          minHeight: app.minHeight ?? 400,
          Component: app.Component,
        },
      ];
    });
  }, []);

  const closeApp = useCallback((id: string) => {
    setWindows((prev) => prev.filter((w) => w.id !== id));
  }, []);

  const minimizeApp = useCallback((id: string) => {
    setWindows((prev) =>
      prev.map((w) =>
        w.id === id ? { ...w, mode: WindowMode.Minimized } : w,
      ),
    );
  }, []);

  const maximizeApp = useCallback((id: string) => {
    setWindows((prev) =>
      prev.map((w) =>
        w.id === id
          ? { ...w, mode: w.mode === WindowMode.Maximized ? WindowMode.Normal : WindowMode.Maximized }
          : w,
      ),
    );
  }, []);

  const focusApp = useCallback((id: string) => {
    setWindows((prev) =>
      prev.map((w) => (w.id === id ? { ...w, zIndex: ++nextZ } : w)),
    );
  }, []);

  const restoreApp = useCallback((id: string) => {
    setWindows((prev) =>
      prev.map((w) =>
        w.id === id ? { ...w, mode: WindowMode.Normal, zIndex: ++nextZ } : w,
      ),
    );
  }, []);

  const isPinned = useCallback(
    (key: string) => pinnedApps.some((a) => a.key === key),
    [pinnedApps],
  );

  const pinApp = useCallback((app: AppDefinition) => {
    setPinnedApps((prev) => {
      if (prev.some((a) => a.key === app.key)) return prev;
      return [...prev, app];
    });
  }, []);

  const unpinApp = useCallback((key: string) => {
    setPinnedApps((prev) => prev.filter((a) => a.key !== key));
  }, []);

  return (
    <WindowContext.Provider
      value={{
        windows, pinnedApps, desktopBounds, footerRects,
        setDesktopBounds, setFooterRect,
        openApp, closeApp, minimizeApp, maximizeApp, focusApp, restoreApp,
        pinApp, unpinApp, isPinned,
      }}
    >
      {children}
    </WindowContext.Provider>
  );
}

export function useWindows() {
  const ctx = useContext(WindowContext);
  if (!ctx) throw new Error('useWindows must be used within WindowProvider');
  return ctx;
}
