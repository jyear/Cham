import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useT } from '@/i18n';
import Icon from '@/components/Icon';
import { usePluginRegistry } from '@/plugins/PluginRegistryProvider';
import { useWindows, type AppDefinition } from '@/contexts/WindowContext';
import type { StoreIndex, StoreIndexEntry } from '@shared/plugin/types';
import s from './index.module.css';

const STORE_INDEX_URL = `${process.env.CHAM_STORE_URL || 'https://cham-download.oss-cn-beijing.aliyuncs.com/store'}/index.json`;

type TabKey = 'installed' | 'discover';

const isDev = process.env.FOR_DEVELOPMENT === 'true';

export default function Store() {
  const { t } = useT();
  const navigate = useNavigate();
  const { openApp } = useWindows();
  const { bundles, builtins, installed, loading, error, installPlugin, installLocalPlugin, uninstallPlugin } = usePluginRegistry();
  const [tab, setTab] = useState<TabKey>('installed');
  const [storeIndex, setStoreIndex] = useState<StoreIndex | null>(null);
  const [storeLoading, setStoreLoading] = useState(false);
  const [storeError, setStoreError] = useState<string | null>(null);
  const [installingIds, setInstallingIds] = useState<Set<string>>(new Set());

  // Fetch store index on mount
  useEffect(() => {
    setStoreLoading(true);
    setStoreError(null);
    fetch(STORE_INDEX_URL)
      .then((r) => r.json())
      .then((data) => setStoreIndex(data as StoreIndex))
      .catch((err) => {
        setStoreError(err.message || 'Failed to load store');
        // Store may not exist yet (no published plugins) — that's fine
      })
      .finally(() => setStoreLoading(false));
  }, []);

  const handleBackdrop = useCallback(() => navigate('/'), [navigate]);

  const handleInstall = useCallback(async (entry: StoreIndexEntry) => {
    setInstallingIds((prev) => new Set(prev).add(entry.id));
    try {
      await installPlugin(entry.manifestUrl);
    } catch {
      // Error already shown via PluginRegistryProvider
    } finally {
      setInstallingIds((prev) => {
        const next = new Set(prev);
        next.delete(entry.id);
        return next;
      });
    }
  }, [installPlugin]);

  const handleAddLocal = useCallback(async () => {
    if (!window.cham) return;
    const folder = await window.cham.selectOutputDir();
    if (!folder) return;
    try {
      await installLocalPlugin(folder);
    } catch (err: any) {
      console.error('[Store] installLocalPlugin failed:', err);
    }
  }, [installLocalPlugin]);

  const handleUninstall = useCallback(async (pluginId: string) => {
    try {
      await uninstallPlugin(pluginId);
    } catch {
      // Error already shown
    }
  }, [uninstallPlugin]);

  const handleOpenApp = useCallback(async (bundle: typeof bundles[number]) => {
    // Store plugins always use the iframe Component from the registry.
    // No need to reload from disk — PluginIframe handles everything.
    const app: AppDefinition = {
      key: bundle.manifest.id,
      icon: bundle.manifest.icon as any,
      color: bundle.manifest.color,
      title: bundle.manifest.name,
      description: bundle.manifest.description,
      unresizable: bundle.manifest.unresizable,
      minWidth: bundle.manifest.minWidth,
      minHeight: bundle.manifest.minHeight,
      Component: bundle.Component,
    };
    openApp(app);
    navigate('/');
  }, [openApp, navigate]);

  const installedIds = new Set(bundles.map((b) => b.manifest.id));

  return (
    <div className={s.container} onClick={handleBackdrop}>
      <div className={s.panel} onClick={(e) => e.stopPropagation()}>
        {/* Tabs */}
        <div className={s.tabs}>
          <button
            className={`${s.tab} ${tab === 'installed' ? s.tabActive : ''}`}
            onClick={() => setTab('installed')}
          >
            {t.storeInstalled || 'Installed'}
          </button>
          <button
            className={`${s.tab} ${tab === 'discover' ? s.tabActive : ''}`}
            onClick={() => setTab('discover')}
          >
            {t.storeDiscover || 'Discover'}
          </button>
          {isDev && (
            <button className={s.addLocalBtn} onClick={handleAddLocal}>
              + {t.addLocalApp || 'Add Local App'}
            </button>
          )}
        </div>

        {/* Error */}
        {error && <div className={s.error}>{error}</div>}

        {/* Content */}
        <div className={s.content}>
          {tab === 'installed' && (
            <InstalledTab
              bundles={bundles}
              builtins={builtins}
              installed={installed}
              loading={loading}
              onOpen={handleOpenApp}
              onUninstall={handleUninstall}
              installingIds={installingIds}
              t={t}
            />
          )}
          {tab === 'discover' && (
            <DiscoverTab
              storeIndex={storeIndex}
              loading={storeLoading}
              error={storeError}
              installedIds={installedIds}
              installingIds={installingIds}
              onInstall={handleInstall}
              t={t}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Installed Tab ─── */

function InstalledTab({
  bundles, builtins, installed, loading, onOpen, onUninstall, installingIds, t,
}: {
  bundles: ReturnType<typeof usePluginRegistry>['bundles'];
  builtins: ReturnType<typeof usePluginRegistry>['builtins'];
  installed: ReturnType<typeof usePluginRegistry>['installed'];
  loading: boolean;
  onOpen: (b: typeof bundles[number]) => void;
  onUninstall: (id: string) => void;
  installingIds: Set<string>;
  t: any;
}) {
  if (loading) {
    return <div className={s.loading}>Loading...</div>;
  }

  if (bundles.length === 0) {
    return (
      <div className={s.empty}>
        <div className={s.emptyTitle}>{t.storeNoPlugins || 'No plugins installed yet'}</div>
        <div className={s.emptyHint}>{t.storeBrowseHint || 'Switch to the Discover tab to find plugins'}</div>
      </div>
    );
  }

  const builtinIds = new Set(builtins.map((b) => b.manifest.id));

  return (
    <>
      {bundles.map((bundle) => {
        const isBuiltin = builtinIds.has(bundle.manifest.id);
        const isUninstalling = installingIds.has(bundle.manifest.id);

        return (
          <div key={bundle.manifest.id} className={s.card}>
            <div className={s.cardIcon} style={{ background: bundle.manifest.color }}>
              <Icon type={bundle.manifest.icon as any} size={22} color="#fff" />
            </div>
            <div className={s.cardInfo}>
              <div className={s.cardName}>
                {(t as any)[bundle.manifest.name] ?? bundle.manifest.name}
              </div>
              {bundle.manifest.description && (
                <div className={s.cardDesc}>
                  {(t as any)[bundle.manifest.description] ?? bundle.manifest.description}
                </div>
              )}
              <div className={s.cardMeta}>
                <span className={`${s.cardBadge} ${isBuiltin ? s.badgeBuiltin : s.badgeStore}`}>
                  {isBuiltin ? (t.storeBuiltinBadge || 'Built-in') : (t.storeStoreBadge || 'Store')}
                </span>
                {(t.storeVersion as any)?.(bundle.manifest.version) ?? `v${bundle.manifest.version}`}
              </div>
            </div>
            <div className={s.cardActions}>
              <button className={`${s.btn} ${s.btnPrimary}`} onClick={() => onOpen(bundle)}>
                Open
              </button>
              {!isBuiltin && (
                <button
                  className={`${s.btn} ${s.btnDanger}`}
                  onClick={() => onUninstall(bundle.manifest.id)}
                  disabled={isUninstalling}
                >
                  {isUninstalling ? (t.storeUpdating || '...') : (t.storeUninstall || 'Uninstall')}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </>
  );
}

/* ─── Discover Tab ─── */

function DiscoverTab({
  storeIndex, loading, error, installedIds, installingIds, onInstall, t,
}: {
  storeIndex: StoreIndex | null;
  loading: boolean;
  error: string | null;
  installedIds: Set<string>;
  installingIds: Set<string>;
  onInstall: (entry: StoreIndexEntry) => void;
  t: any;
}) {
  if (loading) {
    return <div className={s.loading}>Loading...</div>;
  }

  if (error) {
    return (
      <div className={s.empty}>
        <div className={s.emptyTitle}>{t.storeNoStorePlugins || 'No plugins available'}</div>
        <div className={s.emptyHint}>{error}</div>
      </div>
    );
  }

  if (!storeIndex || storeIndex.plugins.length === 0) {
    return (
      <div className={s.empty}>
        <div className={s.emptyTitle}>{t.storeNoStorePlugins || 'No plugins available'}</div>
        <div className={s.emptyHint}>{t.storeBrowseHint || 'Check back later for new plugins'}</div>
      </div>
    );
  }

  return (
    <>
      {storeIndex.plugins.map((entry) => {
        const isInstalled = installedIds.has(entry.id);
        const isInstalling = installingIds.has(entry.id);

        return (
          <div key={entry.id} className={s.card}>
            <div className={s.cardIcon} style={{ background: entry.color }}>
              <Icon type={entry.icon as any} size={22} color="#fff" />
            </div>
            <div className={s.cardInfo}>
              <div className={s.cardName}>
                {(t as any)[entry.name] ?? entry.name}
              </div>
              <div className={s.cardDesc}>
                {(t as any)[entry.description] ?? entry.description}
              </div>
              <div className={s.cardMeta}>
                {(t.storeVersion as any)?.(entry.version) ?? `v${entry.version}`}
                {entry.author && (
                  <> · {(t.storeAuthor as any)?.(entry.author) ?? `By ${entry.author}`}</>
                )}
              </div>
            </div>
            <div className={s.cardActions}>
              {isInstalled ? (
                <span className={s.cardBadge + ' ' + s.badgeBuiltin}>Installed</span>
              ) : (
                <button
                  className={`${s.btn} ${s.btnPrimary}`}
                  onClick={() => onInstall(entry)}
                  disabled={isInstalling}
                >
                  {isInstalling
                    ? (t.storeInstalling || 'Installing...')
                    : (t.storeInstall || 'Install')}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </>
  );
}
