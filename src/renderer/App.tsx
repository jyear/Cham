import React from 'react';
import { Outlet } from 'react-router-dom';
import TitleBar from '@/components/TitleBar';
import { useWindowState } from '@/hooks/useWindowState';
import { useBackground } from '@/hooks/useBackground';
import s from './App.module.css';

export default function App() {
  const { maximized } = useWindowState();
  useBackground(); // Initialize background image from localStorage

  return (
    <div className={s.app}>
      <TitleBar maximized={maximized} />
      <main className={s.main}>
        <Outlet />
      </main>
    </div>
  );
}
