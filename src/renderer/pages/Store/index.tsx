import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useT } from '@/i18n';
import Icon from '@/components/Icon';
import { usePluginRegistry } from '@/plugins/PluginRegistryProvider';
import type { StoreIndex, StoreIndexEntry } from '@shared/plugin/types';
import s from './index.module.css';

const STORE_INDEX_URL = `${process.env.CHAM_STORE_URL || 'https://cham-download.oss-cn-beijing.aliyuncs.com/store'}/index.json`;

const isDev = process.env.FOR_DEVELOPMENT === 'true';

/* ── Helpers ── */

function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const va = pa[i] || 0;
    const vb = pb[i] || 0;
    if (va > vb) return 1;
    if (va < vb) return -1;
  }
  return 0;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  } catch {
    return iso;
  }
}

type TabKey = 'discover' | 'updates';

export default function Store() {
  const { t } = useT();
  const navigate = useNavigate();
  const { bundles, loading, error, installPlugin, installLocalPlugin } = usePluginRegistry();
  const [storeIndex, setStoreIndex] = useState<StoreIndex | null>(null);
  const [storeLoading, setStoreLoading] = useState(false);
  const [storeError, setStoreError] = useState<string | null>(null);
  const [installingIds, setInstallingIds] = useState<Set<string>>(new Set());
  const [installProgress, setInstallProgress] = useState<Record<string, number>>({});
  const [tab, setTab] = useState<TabKey>('discover');

  // Subscribe to install progress events
  useEffect(() => {
    if (!window.cham) return;
    const unsub = window.cham.plugin.onInstallProgress((data) => {
      setInstallProgress((prev) => ({ ...prev, [data.pluginId]: data.progress }));
    });
    return unsub;
  }, []);

  useEffect(() => {
    setStoreLoading(true);
    setStoreError(null);
    fetch(STORE_INDEX_URL)
      .then((r) => r.json())
      .then((data) => setStoreIndex(data as StoreIndex))
      .catch((err) => {
        setStoreError(err.message || 'Failed to load store');
      })
      .finally(() => setStoreLoading(false));
  }, []);

  const handleBackdrop = useCallback(() => navigate('/'), [navigate]);

  const handleInstall = useCallback(async (entry: StoreIndexEntry) => {
    setInstallingIds((prev) => new Set(prev).add(entry.id));
    setInstallProgress((prev) => ({ ...prev, [entry.id]: 0 }));
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
      setInstallProgress((prev) => {
        const next = { ...prev };
        delete next[entry.id];
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

  const installedVersionMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const b of bundles) {
      map.set(b.manifest.id, b.manifest.version);
    }
    return map;
  }, [bundles]);

  const installedIds = useMemo(() => new Set(bundles.map((b) => b.manifest.id)), [bundles]);

  const updateAvailable = useMemo(() => {
    if (!storeIndex) return [];
    return storeIndex.plugins.filter((entry) => {
      const inst = installedVersionMap.get(entry.id);
      if (!inst) return false;
      return compareVersions(entry.version, inst) > 0;
    });
  }, [storeIndex, installedVersionMap]);

  const displayedPlugins = useMemo(() => {
    if (!storeIndex) return [];
    if (tab === 'updates') return updateAvailable;
    return storeIndex.plugins;
  }, [storeIndex, tab, updateAvailable]);

  return (
    <div className={s.wrapper} onClick={handleBackdrop}>
      {/* Top Tab Bar */}
      <div className={s.tabBar} onClick={(e) => e.stopPropagation()}>
        <div className={s.tabs}>
          <button
            className={`${s.tab} ${tab === 'discover' ? s.tabActive : ''}`}
            onClick={() => setTab('discover')}
          >
            {t.storeDiscover || 'Discover'}
          </button>
          <button
            className={`${s.tab} ${tab === 'updates' ? s.tabActive : ''}`}
            onClick={() => setTab('updates')}
          >
            {t.storeUpdate || 'Updates'}
            {updateAvailable.length > 0 && (
              <span className={s.badge}>{updateAvailable.length}</span>
            )}
          </button>
        </div>
        {isDev && (
          <button className={s.addLocalBtn} onClick={handleAddLocal}>
            + {t.addLocalApp || 'Add Local App'}
          </button>
        )}
      </div>

      {/* Content */}
      <div className={s.content}>
        {(error || storeError) && (
          <div className={s.error}>{error || storeError}</div>
        )}

        {storeLoading || loading ? (
          <div className={s.loading}>Loading...</div>
        ) : tab === 'updates' && updateAvailable.length === 0 ? (
          <div className={s.emptyState}>
            <Icon type="check" size={40} />
            <p className={s.emptyTitle}>{t.storeUpToDate || 'All apps are up to date'}</p>
          </div>
        ) : !storeIndex || storeIndex.plugins.length === 0 ? (
          <div className={s.emptyState}>
            <p className={s.emptyTitle}>{t.storeNoStorePlugins || 'No plugins available'}</p>
            <p className={s.emptyHint}>{t.storeBrowseHint || 'Check back later for new plugins'}</p>
          </div>
        ) : (
          <div className={s.cardGrid} onClick={(e) => e.stopPropagation()}>
            {displayedPlugins.map((entry) => (
              <AppCard
                key={entry.id}
                entry={entry}
                isInstalled={installedIds.has(entry.id)}
                installedVersion={installedVersionMap.get(entry.id)}
                isInstalling={installingIds.has(entry.id)}
                progress={installProgress[entry.id] ?? 0}
                onInstall={handleInstall}
                t={t}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── App Card ─── */

function AppCard({
  entry, isInstalled, installedVersion, isInstalling, progress, onInstall, t,
}: {
  entry: StoreIndexEntry;
  isInstalled: boolean;
  installedVersion: string | undefined;
  isInstalling: boolean;
  progress: number;
  onInstall: (entry: StoreIndexEntry) => void;
  t: any;
}) {
  let buttonState: 'install' | 'installed' | 'update' = 'install';
  if (isInstalled && installedVersion) {
    if (compareVersions(entry.version, installedVersion) > 0) {
      buttonState = 'update';
    } else {
      buttonState = 'installed';
    }
  }

  const displayDesc = (t as any)[entry.description] ?? entry.description;

  // Circular progress ring geometry
  const ringSize = 28;
  const ringCenter = ringSize / 2;
  const ringRadius = 10;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset = ringCircumference * (1 - progress / 100);

  return (
    <div className={s.card}>
      {/* Top-right: progress ring (installing) or small action button */}
      <div className={s.topRight}>
        {isInstalling ? (
          <svg width={ringSize} height={ringSize} viewBox={`0 0 ${ringSize} ${ringSize}`}>
            <circle
              className={s.ringTrack}
              cx={ringCenter} cy={ringCenter} r={ringRadius}
              fill="none"
              strokeWidth="2"
            />
            <circle
              className={s.ringFill}
              cx={ringCenter} cy={ringCenter} r={ringRadius}
              fill="none"
              strokeWidth="2"
              strokeDasharray={ringCircumference}
              strokeDashoffset={ringOffset}
              strokeLinecap="round"
              transform={`rotate(-90 ${ringCenter} ${ringCenter})`}
            />
          </svg>
        ) : buttonState === 'installed' ? (
          <span className={s.badgeInstalled}>
            {t.storeInstalledLatest || 'Installed'}
          </span>
        ) : buttonState === 'update' ? (
          <button
            className={s.btnMiniUpdate}
            onClick={() => onInstall(entry)}
          >
            {t.storeUpdate || 'Update'}
          </button>
        ) : (
          <button
            className={s.btnMiniGet}
            onClick={() => onInstall(entry)}
          >
            {t.storeInstall || 'Install'}
          </button>
        )}
      </div>

      {/* Icon */}
      <div className={s.cardIconCol}>
        <div className={s.cardIconWrap} style={{ background: entry.color }}>
          <Icon type={entry.icon as any} size={36} color="#fff" />
        </div>
      </div>

      {/* Info */}
      <div className={s.cardBody}>
        <div className={s.cardName}>
          {(t as any)[entry.name] ?? entry.name}
        </div>
        {displayDesc && (
          <div className={s.cardDesc} title={displayDesc}>
            {displayDesc}
          </div>
        )}
        <div className={s.cardMeta}>
          {entry.author && (
            <span>{entry.author}</span>
          )}
          <span>v{entry.version}</span>
          {entry.updatedAt && (
            <span>{formatDate(entry.updatedAt)}</span>
          )}
        </div>
      </div>
    </div>
  );
}
