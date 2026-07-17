import React, { useState, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWindows, type AppDefinition } from '@/contexts/WindowContext';
import { usePluginRegistry } from '@/plugins/PluginRegistryProvider';
import { useT } from '@/i18n';
import Icon from '@/components/Icon';
import { loadAppDefs } from '@/utils/appDefs';
import s from './index.module.css';

export default function Tools() {
  const { t } = useT();
  const { openApp } = useWindows();
  const navigate = useNavigate();
  const { installed, uninstallPlugin } = usePluginRegistry();
  const [shakeMode, setShakeMode] = useState(false);

  // Store-installed app keys (not builtins)
  const storeAppKeys = useMemo(
    () => new Set(installed.map((b) => b.manifest.id)),
    [installed],
  );

  const appDefs = loadAppDefs();

  const handleOpenApp = (app: AppDefinition) => {
    if (shakeMode) return;
    openApp(app);
    navigate('/');
  };

  const handleBackdrop = () => {
    if (shakeMode) {
      setShakeMode(false);
    } else {
      navigate('/');
    }
  };

  const handleUninstall = useCallback(async (e: React.MouseEvent, appKey: string) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      await uninstallPlugin(appKey);
    } catch {
      // Error already shown
    }
  }, [uninstallPlugin]);

  return (
    <div className={s.container} onClick={handleBackdrop}>
      <div className={s.grid} onClick={(e) => e.stopPropagation()}>
        {appDefs.map((app) => {
          const isStoreApp = storeAppKeys.has(app.key);
          const showDelete = shakeMode && isStoreApp;

          return (
            <AppIcon
              key={app.key}
              app={app}
              shakeMode={shakeMode}
              showDelete={showDelete}
              onOpen={() => handleOpenApp(app)}
              onActivateShake={() => setShakeMode(true)}
              onDelete={(e) => handleUninstall(e, app.key)}
              t={t}
            />
          );
        })}
      </div>
    </div>
  );
}

/* ─── App Icon ─── */

function AppIcon({
  app, shakeMode, showDelete, onOpen, onActivateShake, onDelete, t,
}: {
  app: AppDefinition;
  shakeMode: boolean;
  showDelete: boolean;
  onOpen: () => void;
  onActivateShake: () => void;
  onDelete: (e: React.MouseEvent) => void;
  t: any;
}) {
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const moved = useRef(false);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    moved.current = false;
    if (pressTimer.current) return;
    pressTimer.current = setTimeout(() => {
      if (!moved.current) onActivateShake();
      pressTimer.current = null;
    }, 600);
  };

  const handlePointerMove = () => {
    moved.current = true;
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    e.stopPropagation();
    cancelPress();
  };

  const cancelPress = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (pressTimer.current) clearTimeout(pressTimer.current);
    };
  }, []);

  const handleClick = (e: React.MouseEvent) => {
    if (shakeMode) {
      e.stopPropagation();
      e.preventDefault();
      return;
    }
    onOpen();
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onActivateShake();
  };

  return (
    <div
      className={`${s.card} ${shakeMode ? s.cardShake : ''}`}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
    >
      <span
        className={`${s.iconWrap} ${showDelete ? s.iconShake : ''}`}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerMove={handlePointerMove}
      >
        <span className={s.icon} style={{ background: app.color }}>
          <Icon type={app.icon} size={42} color="#fff" />
        </span>
        {showDelete && (
          <button className={s.deleteBtn} onClick={onDelete} title="Uninstall">
            ×
          </button>
        )}
      </span>
      <span className={s.label}>{(t as any)[app.title] ?? app.title}</span>
    </div>
  );
}
