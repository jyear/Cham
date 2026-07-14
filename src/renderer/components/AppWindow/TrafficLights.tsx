import React from 'react';
import { useWindows } from '@/contexts/WindowContext';
import s from './index.module.css';

interface Props {
  winId: string;
  unresizable?: boolean;
}

export default function TrafficLights({ winId, unresizable }: Props) {
  const { closeApp, minimizeApp, maximizeApp } = useWindows();

  return (
    <div className={s.trafficLights} onPointerDown={(e) => e.stopPropagation()}>
      <button className={`${s.light} ${s.close}`} onClick={() => closeApp(winId)}>
        <svg width="8" height="8" viewBox="0 0 8 8" className={s.lightIcon}>
          <line x1="2" y1="2" x2="6" y2="6" stroke="#4a0000" strokeWidth="1" strokeLinecap="round" />
          <line x1="6" y1="2" x2="2" y2="6" stroke="#4a0000" strokeWidth="1" strokeLinecap="round" />
        </svg>
      </button>
      <button className={`${s.light} ${s.minimize}`} onClick={() => minimizeApp(winId)}>
        <svg width="8" height="8" viewBox="0 0 8 8" className={s.lightIcon}>
          <line x1="2" y1="4" x2="6" y2="4" stroke="#7a5d00" strokeWidth="1" strokeLinecap="round" />
        </svg>
      </button>
      {!unresizable && (
        <button className={`${s.light} ${s.maximize}`} onClick={() => maximizeApp(winId)}>
          <svg width="8" height="8" viewBox="0 0 8 8" className={s.lightIcon}>
            <rect x="1.5" y="1.5" width="5" height="5" rx="0.5" fill="none" stroke="#1a4d00" strokeWidth="1" />
          </svg>
        </button>
      )}
    </div>
  );
}
