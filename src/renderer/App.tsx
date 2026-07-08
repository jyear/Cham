import React from 'react';
import { Outlet } from 'react-router-dom';
import TitleBar from '@/components/TitleBar';
import { useWindowState } from '@/hooks/useWindowState';
import s from './App.module.css';

export default function App() {
  const { maximized } = useWindowState();

  return (
    <div className={s.app}>
      <TitleBar maximized={maximized} />
      <main className={s.main}>
        <Outlet />
      </main>
    </div>
  );
}
