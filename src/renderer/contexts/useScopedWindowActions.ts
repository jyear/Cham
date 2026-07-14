import { useMemo } from 'react';
import { useWindows } from './WindowContext';

/**
 * Returns window control actions scoped to the current window.
 *
 * Unlike `useWindows()` which exposes global window management
 * (close/minimize/focus ANY window), this hook only allows the
 * caller to manipulate its own window.
 *
 * Plugin components should use this hook. System components
 * (AppWindow, FooterNav) use the full `useWindows()`.
 */
export function useScopedWindowActions(winId: string) {
  const { closeApp, minimizeApp, maximizeApp, restoreApp } = useWindows();

  return useMemo(
    () => ({
      close: () => closeApp(winId),
      minimize: () => minimizeApp(winId),
      maximize: () => maximizeApp(winId),
      restore: () => restoreApp(winId),
    }),
    [winId, closeApp, minimizeApp, maximizeApp, restoreApp],
  );
}

/**
 * Hook for plugin components to access their plugin-local storage
 * without needing to pass their pluginId explicitly.
 */
export function usePluginStorage(pluginId: string) {
  return useMemo(
    () => ({
      async getItem(key: string): Promise<string | null> {
        if (!window.cham) return null;
        const result = await window.cham.plugin.getItem(pluginId, key);
        return result.value ?? null;
      },
      async setItem(key: string, value: string): Promise<void> {
        if (!window.cham) return;
        await window.cham.plugin.setItem(pluginId, key, value);
      },
      async removeItem(key: string): Promise<void> {
        if (!window.cham) return;
        await window.cham.plugin.removeItem(pluginId, key);
      },
      async listItems(): Promise<Array<{ key: string; value: string }>> {
        if (!window.cham) return [];
        const result = await window.cham.plugin.listItems(pluginId);
        return result.items ?? [];
      },
    }),
    [pluginId],
  );
}
