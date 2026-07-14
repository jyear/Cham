import React, { useRef, useLayoutEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useT } from '@/i18n';
import Icon from '@/components/Icon';
import Tooltip, { type MenuItem } from '@/components/Tooltip';
import { useWindows, WindowMode, type AppDefinition } from '@/contexts/WindowContext';
import s from './index.module.css';

function AppsIcon() {
  return (
    <svg width="36" height="36" viewBox="0 0 28 28" fill="none">
      {/* Outer window frame */}
      <rect x="3" y="4" width="22" height="20" rx="3" fill="#5b9bd5" />
      {/* Title bar */}
      <rect x="3" y="4" width="22" height="5" rx="3" fill="rgba(255,255,255,0.2)" />
      {/* Traffic light dots */}
      <circle cx="7" cy="6.5" r="1.2" fill="rgba(255,255,255,0.5)" />
      <circle cx="10.5" cy="6.5" r="1.2" fill="rgba(255,255,255,0.5)" />
      <circle cx="14" cy="6.5" r="1.2" fill="rgba(255,255,255,0.5)" />
      {/* Content: two side-by-side panels */}
      <rect x="6" y="12" width="7" height="9" rx="1.5" fill="rgba(255,255,255,0.3)" />
      <rect x="15" y="12" width="7" height="9" rx="1.5" fill="rgba(255,255,255,0.3)" />
    </svg>
  );
}

function StoreIcon() {
  return (
    <svg width="36" height="36" viewBox="0 0 28 28" fill="none">
      {/* Storefront roof */}
      <path d="M3 10h22l-2 14H5L3 10z" fill="#f0a058" />
      {/* Roof top accent */}
      <path d="M5 10h18l-1.5-5H6.5L5 10z" fill="rgba(255,255,255,0.25)" />
      {/* Door */}
      <rect x="11" y="16" width="6" height="8" rx="2" fill="rgba(255,255,255,0.3)" />
      {/* Door handle */}
      <circle cx="15.5" cy="20.5" r="0.8" fill="rgba(255,255,255,0.5)" />
      {/* Left window */}
      <rect x="6" y="13" width="3" height="2.5" rx="1" fill="rgba(255,255,255,0.3)" />
      {/* Right window */}
      <rect x="19" y="13" width="3" height="2.5" rx="1" fill="rgba(255,255,255,0.3)" />
    </svg>
  );
}

interface NavItem {
  key: string;
  icon: React.ReactNode;
  label: string;
  route: string;
}

export default function FooterNav() {
  const { t } = useT();
  const location = useLocation();
  const navigate = useNavigate();
  const {
    windows, pinnedApps,
    restoreApp, minimizeApp, focusApp, openApp,
    pinApp, unpinApp, isPinned,
    setFooterRect,
  } = useWindows();

  const items: NavItem[] = [
    { key: 'tools', icon: <AppsIcon />, label: t.tools, route: '/tools' },
    { key: 'store', icon: <StoreIcon />, label: t.store || 'Store', route: '/store' },
  ];

  function isActive(item: NavItem): boolean {
    if (item.route === '/') return location.pathname === '/';
    return location.pathname.startsWith(item.route);
  }

  const sortedApps = [...windows].sort((a, b) => a.order - b.order);
  const openKeys = new Set(windows.map((w) => w.appKey));
  const pinnedClosed = pinnedApps.filter((a) => !openKeys.has(a.key));

  const visible = windows.filter((w) => w.mode !== WindowMode.Minimized);
  const frontmostId = visible.length > 0
    ? visible.reduce((a, b) => (a.zIndex > b.zIndex ? a : b)).id
    : null;

  function handleAppClick(win: typeof windows[number]) {
    if (location.pathname !== '/') {
      navigate('/');
      return;
    }
    if (win.mode === WindowMode.Minimized) {
      restoreApp(win.id);
    } else if (win.id === frontmostId) {
      minimizeApp(win.id);
    } else {
      focusApp(win.id);
    }
  }

  function handlePinnedClick(app: AppDefinition) {
    if (location.pathname !== '/') navigate('/');
    openApp(app);
  }

  // Build pin/unpin menu items for an open app
  function buildMenuItems(appKey: string): MenuItem[] | undefined {
    const pinned = isPinned(appKey);
    return [{
      label: pinned ? t.removeFromDock : t.keepInDock,
      onClick: () => {
        if (pinned) {
          unpinApp(appKey);
        } else {
          const win = windows.find((w) => w.appKey === appKey);
          if (win) {
            pinApp({
              key: win.appKey, icon: win.icon, color: win.color,
              title: win.title, description: win.description,
              unresizable: win.unresizable,
              minWidth: win.minWidth, minHeight: win.minHeight,
              Component: win.Component,
            });
          }
        }
      },
    }];
  }

  // ── Icon measurement ──

  const iconRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const dockRef = useRef<HTMLDivElement>(null);

  const measureIcons = React.useCallback(() => {
    iconRefs.current.forEach((el, appKey) => {
      const rect = el.getBoundingClientRect();
      setFooterRect(appKey, {
        left: rect.left, top: rect.top,
        width: rect.width, height: rect.height,
      });
    });
  }, [setFooterRect]);

  useLayoutEffect(() => { measureIcons(); });
  useLayoutEffect(() => {
    const dock = dockRef.current;
    if (!dock) return;
    const ro = new ResizeObserver(measureIcons);
    ro.observe(dock);
    return () => ro.disconnect();
  }, [measureIcons]);

  const appDivider = (sortedApps.length > 0 || pinnedClosed.length > 0)
    ? <span className={s.divider} />
    : null;

  return (
    <footer className={s.dock} ref={dockRef}>
      <div className={s.dockInner}>
        {items.map((item) => (
          <button
            key={item.key}
            className={`${s.dockItem} ${isActive(item) ? s.active : ''}`}
            onClick={() => navigate(item.route)}
            title={item.label}
          >
            {item.icon}
          </button>
        ))}

        {appDivider}

        {/* Open apps */}
        {sortedApps.map((win) => (
          <Tooltip
            key={win.id}
            menuItems={buildMenuItems(win.appKey)}
          >
            <button
              ref={(el) => {
                if (el) iconRefs.current.set(win.appKey, el);
                else iconRefs.current.delete(win.appKey);
              }}
              className={`${s.dockItem} ${win.mode !== WindowMode.Minimized ? s.active : ''}`}
              onClick={() => handleAppClick(win)}
            >
              <span
                className={s.appIcon}
                style={{ background: win.color, opacity: win.mode === WindowMode.Minimized ? 0.45 : 1 }}
              >
                <Icon type={win.icon} size={22} color="#fff" />
              </span>
            </button>
          </Tooltip>
        ))}

        {/* Pinned but closed */}
        {pinnedClosed.map((app) => (
          <Tooltip
            key={`pinned-${app.key}`}
            menuItems={[{
              label: t.removeFromDock,
              onClick: () => unpinApp(app.key),
            }]}
          >
            <button
              ref={(el) => {
                if (el) iconRefs.current.set(app.key, el);
                else iconRefs.current.delete(app.key);
              }}
              className={s.dockItem}
              onClick={() => handlePinnedClick(app)}
            >
              <span className={s.appIcon} style={{ background: app.color, opacity: 0.45 }}>
                <Icon type={app.icon} size={22} color="#fff" />
              </span>
            </button>
          </Tooltip>
        ))}
      </div>
    </footer>
  );
}
