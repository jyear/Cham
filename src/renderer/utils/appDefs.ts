import type { IconType } from '@/components/Icon';
import type { AppDefinition } from '@/contexts/WindowContext';
import { pluginRegistry } from '@/plugins/registry';

/**
 * Load all available apps from the plugin registry.
 *
 * Builtin plugins are registered at module load time, so this is safe
 * to call synchronously. Store plugins are loaded when the registry
 * initializes (async), and appear here once init() completes.
 */
export function loadAppDefs(): AppDefinition[] {
  return pluginRegistry.getAllBundles().map((bundle) => ({
    key: bundle.manifest.id,
    icon: bundle.manifest.icon as IconType,
    color: bundle.manifest.color,
    title: bundle.manifest.name,
    description: bundle.manifest.description,
    unresizable: bundle.manifest.unresizable,
    minWidth: bundle.manifest.minWidth,
    minHeight: bundle.manifest.minHeight,
    Component: bundle.Component,
  }));
}

/** Look up a full AppDefinition by its key. Returns undefined if not found. */
export function findAppByKey(key: string): AppDefinition | undefined {
  return loadAppDefs().find((a) => a.key === key);
}
