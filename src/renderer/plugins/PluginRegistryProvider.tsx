import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { PluginBundle } from '@shared/plugin/types';
import { pluginRegistry } from './registry';

interface PluginRegistryContextValue {
  /** All available plugin bundles (builtin + installed store) */
  bundles: PluginBundle[];
  /** Builtin bundles only */
  builtins: PluginBundle[];
  /** Installed store bundles only */
  installed: PluginBundle[];
  /** True while initializing */
  loading: boolean;
  /** Error message if init failed */
  error: string | null;
  /** Re-run initialization (e.g. after install/uninstall) */
  refresh: () => Promise<void>;
  /** Install a store plugin */
  installPlugin: (manifestUrl: string) => Promise<void>;
  /** Uninstall a store plugin */
  uninstallPlugin: (pluginId: string) => Promise<void>;
}

const PluginRegistryContext = createContext<PluginRegistryContextValue | null>(null);

export function PluginRegistryProvider({ children }: { children: React.ReactNode }) {
  const [bundles, setBundles] = useState<PluginBundle[]>([]);
  const [builtins, setBuiltins] = useState<PluginBundle[]>([]);
  const [installed, setInstalled] = useState<PluginBundle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await pluginRegistry.init();
      setBundles(pluginRegistry.getAllBundles());
      setBuiltins(pluginRegistry.getBuiltinBundles());
      setInstalled(pluginRegistry.getInstalledBundles());
    } catch (err: any) {
      setError(err.message);
      console.error('[PluginRegistryProvider] Init failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInstall = useCallback(async (manifestUrl: string) => {
    setError(null);
    try {
      await pluginRegistry.installPlugin(manifestUrl);
      await refresh();
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  }, [refresh]);

  const handleUninstall = useCallback(async (pluginId: string) => {
    setError(null);
    try {
      await pluginRegistry.uninstallPlugin(pluginId);
      await refresh();
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  }, [refresh]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <PluginRegistryContext.Provider
      value={{
        bundles,
        builtins,
        installed,
        loading,
        error,
        refresh,
        installPlugin: handleInstall,
        uninstallPlugin: handleUninstall,
      }}
    >
      {children}
    </PluginRegistryContext.Provider>
  );
}

export function usePluginRegistry(): PluginRegistryContextValue {
  const ctx = useContext(PluginRegistryContext);
  if (!ctx) {
    throw new Error('usePluginRegistry must be used within PluginRegistryProvider');
  }
  return ctx;
}
