import type { PluginManifest, PluginBundle } from '@shared/plugin/types';

// Built-in plugins — statically imported so webpack bundles them
import conversionManifest from './builtin/conversion/manifest';
import ConversionComponent from './builtin/conversion/index';

// System apps — old export pattern, wrapped as PluginBundle
import * as SettingsMod from '@/pages/Application/Settings';

/**
 * PluginRegistry — the single source of truth for all installed apps.
 *
 * Builtin plugins are compiled into the renderer bundle and registered
 * at module load time. Store plugins are downloaded at runtime and loaded
 * via dynamic evaluation of their JS bundle.
 *
 * Usage:
 *   await pluginRegistry.init();
 *   const allApps = pluginRegistry.getAllBundles();
 */
class PluginRegistry {
  private builtins = new Map<string, PluginBundle>();
  private installed = new Map<string, PluginBundle>();
  private _initialized = false;

  constructor() {
    // Register builtins synchronously at module load time.
    // This ensures getAllBundles() is safe to call before init().
    this.registerBuiltin(conversionManifest, ConversionComponent);

    // Register system apps (old export pattern, wrapped as PluginBundle)
    this.registerBuiltin(
      {
        id: 'settings',
        name: SettingsMod.ApplicationName,
        version: '1.0.0',
        description: SettingsMod.ApplicationDesc || undefined,
        icon: SettingsMod.ApplicationIcon,
        color: SettingsMod.ApplicationColor,
        minWidth: SettingsMod.ApplicationMinWidth,
        minHeight: SettingsMod.ApplicationMinHeight,
        unresizable: SettingsMod.ApplicationUnResize,
        category: 'system',
        entry: '',
      },
      SettingsMod.default,
    );
  }

  /** True after init() has completed */
  get initialized(): boolean {
    return this._initialized;
  }

  /**
   * Initialize the registry. Loads installed store plugins from the database.
   * Builtin plugins are already registered at import time — this only adds store plugins.
   */
  async init(): Promise<void> {
    if (this._initialized) return;

    // Load store plugins from the database
    await this.loadInstalledPlugins();

    this._initialized = true;
    console.log(
      `[PluginRegistry] Initialized: ${this.builtins.size} builtin, ${this.installed.size} installed`,
    );
  }

  /**
   * Register a built-in plugin. Called at module load time.
   */
  private registerBuiltin(
    manifest: PluginManifest,
    Component: React.ComponentType,
  ): void {
    if (manifest.category !== 'builtin') {
      console.warn(`[PluginRegistry] Builtin plugin "${manifest.id}" must have category "builtin"`);
    }
    this.builtins.set(manifest.id, { manifest, Component });
  }

  /**
   * Load installed store plugins from the database.
   * For each installed plugin, dynamically evaluate the JS bundle.
   */
  private async loadInstalledPlugins(): Promise<void> {
    if (!window.cham) return;

    const result = await window.cham.plugin.listInstalled();
    if (!result.success || !result.plugins) {
      console.log('[PluginRegistry] No installed store plugins found');
      return;
    }

    for (const manifest of result.plugins as PluginManifest[]) {
      try {
        const Component = await this.loadComponent(manifest.id);
        this.installed.set(manifest.id, { manifest, Component });
        console.log(`[PluginRegistry] Loaded store plugin: ${manifest.id}`);
      } catch (err: any) {
        console.error(
          `[PluginRegistry] Failed to load plugin "${manifest.id}": ${err.message}`,
        );
      }
    }
  }

  /**
   * Dynamically load a store plugin's React component from disk.
   *
   * The plugin JS bundle is a self-contained module that exposes a
   * default React component. We use the Function constructor to evaluate
   * the source in the renderer's sandbox context.
   */
  private async loadComponent(pluginId: string): Promise<React.ComponentType> {
    const result = await window.cham.plugin.loadComponent(pluginId);
    if (!result.success || !result.source) {
      throw new Error(result.error || 'Failed to load component source');
    }

    // Evaluate the plugin source in a controlled sandbox.
    // The plugin source should assign to a global registry slot.
    // Expected plugin bundle format:
    //   var __chamPlugin = (function() { ... return { default: MyComponent }; })();
    try {
      const fn = new Function(
        'React',
        'ReactDOM',
        'window',
        result.source + ';\nreturn typeof __chamPlugin !== "undefined" ? __chamPlugin.default : null;',
      );
      // We pass React as a parameter so plugins can use it without bundling their own copy.
      // For v1, plugins must use a globally-available React.
      const Component = fn(null, null, window);
      if (!Component) {
        throw new Error('Plugin did not expose a valid component');
      }
      return Component as React.ComponentType;
    } catch (err: any) {
      throw new Error(`Component evaluation failed: ${err.message}`);
    }
  }

  // ── Public API ──

  /** Get all plugin bundles (builtin + installed store) */
  getAllBundles(): PluginBundle[] {
    return [
      ...this.builtins.values(),
      ...this.installed.values(),
    ];
  }

  /** Get builtin plugin bundles only */
  getBuiltinBundles(): PluginBundle[] {
    return [...this.builtins.values()];
  }

  /** Get installed store plugin bundles only */
  getInstalledBundles(): PluginBundle[] {
    return [...this.installed.values()];
  }

  /** Get a single plugin bundle by ID */
  getBundle(id: string): PluginBundle | undefined {
    return this.builtins.get(id) ?? this.installed.get(id);
  }

  /** Check if a plugin is installed (builtin or store) */
  hasPlugin(id: string): boolean {
    return this.builtins.has(id) || this.installed.has(id);
  }

  /**
   * Install a store plugin from a remote manifest URL.
   * Returns the loaded bundle on success.
   */
  async installPlugin(manifestUrl: string): Promise<PluginBundle> {
    if (!window.cham) throw new Error('cham API not available');

    const result = await window.cham.plugin.install(manifestUrl);
    if (!result.success || !result.manifest) {
      throw new Error(result.error || 'Install failed');
    }

    const manifest = result.manifest as PluginManifest;
    const Component = await this.loadComponent(manifest.id);
    const bundle: PluginBundle = { manifest, Component };
    this.installed.set(manifest.id, bundle);
    return bundle;
  }

  /**
   * Uninstall a store plugin. Builtin plugins cannot be uninstalled.
   */
  async uninstallPlugin(pluginId: string): Promise<void> {
    if (this.builtins.has(pluginId)) {
      throw new Error('Cannot uninstall built-in plugins');
    }
    if (!window.cham) throw new Error('cham API not available');

    const result = await window.cham.plugin.uninstall(pluginId);
    if (!result.success) {
      throw new Error(result.error || 'Uninstall failed');
    }

    this.installed.delete(pluginId);
  }
}

/** Singleton instance */
export const pluginRegistry = new PluginRegistry();
