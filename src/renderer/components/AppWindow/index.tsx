import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useWindows } from '@/contexts/WindowContext';
import { WindowMode } from './types';
import { useWindowInteraction } from './useWindowInteraction';
import PluginErrorBoundary from '@/components/PluginErrorBoundary';
import { useDockAnimation } from './useDockAnimation';
import TrafficLights from './TrafficLights';
import ResizeHandles from './ResizeHandles';
import Icon from '@/components/Icon';
import AppInfo from './AppInfo';
import type { AppWindowState } from '@/contexts/WindowContext';
import s from './index.module.css';

const ANIM_TRANSITION = {
  duration: 0.35,
  ease: [0.25, 0.1, 0.25, 1] as [number, number, number, number],
};

interface Props {
  win: AppWindowState;
}

export default function AppWindow({ win }: Props) {
  const { focusApp, maximizeApp, desktopBounds } = useWindows();
  const { mode, minWidth, minHeight } = win;

  const {
    layout,
    onTitleBarPointerDown,
    onResizeHandlePointerDown,
    onPointerMove,
    onPointerUp,
  } = useWindowInteraction({
    id: win.id,
    mode,
    minWidth,
    minHeight,
    desktopBounds,
  });

  const dockOffset = useDockAnimation(win.appKey, { x: layout.left, y: layout.top }, { w: layout.width, h: layout.height });

  const [showInfo, setShowInfo] = useState(false);

  const isMinimized = mode === WindowMode.Minimized;
  const isMaximized = mode === WindowMode.Maximized;

  return (
    <motion.div
      className={`${s.window} ${isMaximized ? s.maximized : ''}`}
      style={{
        zIndex: win.zIndex,
        left: layout.left,
        top: layout.top,
        width: layout.width,
        height: layout.height,
        pointerEvents: isMinimized ? 'none' : 'auto',
      }}
      animate={
        isMinimized
          ? { x: dockOffset.x, y: dockOffset.y, scale: dockOffset.scale, opacity: 0 }
          : { x: 0, y: 0, scale: 1, opacity: 1 }
      }
      transition={ANIM_TRANSITION}
      onPointerDown={() => focusApp(win.id)}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {/* Title bar */}
      <div
        className={s.titleBar}
        onPointerDown={onTitleBarPointerDown}
        onDoubleClick={() => !win.unresizable && maximizeApp(win.id)}
      >
        <TrafficLights winId={win.id} unresizable={win.unresizable} />
        <span className={s.titleText}>{win.title}</span>
        {win.description && (
          <button className={s.helpBtn} title="About this app" onClick={() => setShowInfo(true)}>
            <Icon type="help" size={14} />
          </button>
        )}
      </div>

      {/* Content */}
      <div className={s.content}>
        <PluginErrorBoundary pluginId={win.appKey} pluginName={win.title}>
          <win.Component />
        </PluginErrorBoundary>
        {win.description && <AppInfo win={win} open={showInfo} onClose={() => setShowInfo(false)} />}
      </div>

      {/* Resize handles (hidden for unresizable windows) */}
      {!win.unresizable && <ResizeHandles mode={mode} onPointerDown={onResizeHandlePointerDown} />}
    </motion.div>
  );
}
