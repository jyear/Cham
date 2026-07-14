import React, { useRef, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import TitleBar from '@/components/TitleBar';
import FooterNav from '@/components/FooterNav';
import AppWindow from '@/components/AppWindow';
import { WindowProvider, useWindows } from '@/contexts/WindowContext';
import { useWindowState } from '@/hooks/useWindowState';
import { useBackground } from '@/hooks/useBackground';
import s from './App.module.css';

function WindowsLayer() {
  const { windows } = useWindows();
  const location = useLocation();
  const hidden = location.pathname !== '/';

  return (
    <div style={{ display: hidden ? 'none' : undefined }}>
      {windows.map((win) => (
        <AppWindow key={win.id} win={win} />
      ))}
    </div>
  );
}

function ToolsOverlay() {
  const location = useLocation();
  const mainRef = useRef<HTMLElement | null>(null);
  const visible = location.pathname === '/tools' || location.pathname === '/store';

  useEffect(() => {
    mainRef.current = document.querySelector('[data-main]');
  }, []);

  const top = mainRef.current?.offsetTop ?? 36;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className={s.toolsOverlay}
          style={{ top }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
        />
      )}
    </AnimatePresence>
  );
}

function AppInner() {
  const { maximized } = useWindowState();
  const { setDesktopBounds } = useWindows();
  const appRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  useBackground();

  useEffect(() => {
    const main = mainRef.current;
    const app = appRef.current;
    if (!main || !app) return;

    const update = () => {
      const mr = main.getBoundingClientRect();
      const ar = app.getBoundingClientRect();
      setDesktopBounds({
        left: mr.left - ar.left,
        top: mr.top - ar.top,
        width: mr.width,
        height: mr.height,
      });
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(main);
    return () => ro.disconnect();
  }, [setDesktopBounds]);

  return (
    <div className={s.app} ref={appRef}>
      <TitleBar maximized={maximized} />
      <main className={s.main} ref={mainRef} data-main>
        <Outlet />
      </main>
      <FooterNav />
      <ToolsOverlay />
      <WindowsLayer />
    </div>
  );
}

export default function App() {
  return (
    <WindowProvider>
      <AppInner />
    </WindowProvider>
  );
}
