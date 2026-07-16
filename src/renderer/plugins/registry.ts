import React from 'react';
import type { PluginManifest, PluginBundle } from '@shared/plugin/types';
import { registerPluginI18n } from '@/i18n';

// Built-in plugins — statically imported so webpack bundles them
import conversionManifestJson from '@shared/plugins/manifests/conversion.json';

const conversionManifest = conversionManifestJson as PluginManifest;
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
 * In dev mode, plugins with a `devServer` config are loaded in iframes
 * pointing to their own webpack-dev-server for independent HMR.
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

    // Load i18n translations for all store plugins
    await this.loadPluginI18n();

    this._initialized = true;
    console.log(
      `[PluginRegistry] Initialized: ${this.builtins.size} builtin, ${this.installed.size} installed`,
    );
  }

  /**
   * Load i18n translations from all installed store plugins and
   * register them with the i18n system so names/descriptions display
   * in the current language.
   */
  private async loadPluginI18n(): Promise<void> {
    if (!window.cham) return;

    for (const [pluginId] of this.installed) {
      try {
        const result = await window.cham.plugin.loadI18n(pluginId);
        if (result.success && result.translations) {
          registerPluginI18n(result.translations);
          console.log(`[PluginRegistry] Loaded i18n for "${pluginId}"`);
        }
      } catch (err: any) {
        console.warn(`[PluginRegistry] Failed to load i18n for "${pluginId}": ${err.message}`);
      }
    }
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
   *
   * Store plugins are ALWAYS loaded in a sandboxed iframe:
   * - Dev:  iframe loads bundle from plugin's dev server (HMR)
   * - Prod: iframe inlines the bundle source from disk
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
        const Component = await this.loadStorePlugin(manifest);
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
   * Load a single store plugin's Component.
   *
   * Dev mode (manifest.devServer set): iframe loads from dev server URL.
   * Prod mode: reads JS bundle from disk, inlines it into iframe srcdoc.
   */
  private async loadStorePlugin(manifest: PluginManifest): Promise<React.ComponentType> {
    const { default: PluginIframe } = await import('./iframe/PluginIframe');
    const devUrl = (manifest as any).devServer as string | undefined;

    if (devUrl) {
      // Dev mode: iframe loads from dev server with HMR
      const IframeWrapper: React.ComponentType = () =>
        React.createElement(PluginIframe, { pluginId: manifest.id, url: devUrl });
      return IframeWrapper;
    }

    // Prod mode: read bundle from disk, inline into iframe
    const result = await window.cham.plugin.loadComponent(manifest.id);
    if (!result.success || !result.source) {
      throw new Error(result.error || 'Failed to load bundle');
    }

    const IframeWrapper: React.ComponentType = () =>
      React.createElement(PluginIframe, { pluginId: manifest.id, source: result.source });
    return IframeWrapper;
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
    const Component = await this.loadStorePlugin(manifest);
    const bundle: PluginBundle = { manifest, Component };
    this.installed.set(manifest.id, bundle);
    return bundle;
  }

  /**
   * Install a local plugin from a folder path (dev mode).
   * The folder must contain manifest.json and the compiled entry files.
   */
  async installLocalPlugin(folderPath: string): Promise<PluginBundle> {
    if (!window.cham) throw new Error('cham API not available');

    const result = await window.cham.plugin.installLocal(folderPath);
    if (!result.success || !result.manifest) {
      throw new Error(result.error || 'Local install failed');
    }

    const manifest = result.manifest as PluginManifest;
    const Component = await this.loadStorePlugin(manifest);
    const bundle: PluginBundle = { manifest, Component };
    this.installed.set(manifest.id, bundle);

    // Load i18n for the newly installed plugin
    try {
      const i18nResult = await window.cham!.plugin.loadI18n(manifest.id);
      if (i18nResult.success && i18nResult.translations) {
        registerPluginI18n(i18nResult.translations);
      }
    } catch {
      // i18n is optional
    }

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
