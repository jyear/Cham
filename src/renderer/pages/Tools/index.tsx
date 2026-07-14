import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useWindows, type AppDefinition } from '@/contexts/WindowContext';
import { useT } from '@/i18n';
import Icon from '@/components/Icon';
import { loadAppDefs } from '@/utils/appDefs';
import s from './index.module.css';

export default function Tools() {
  const { t } = useT();
  const { openApp } = useWindows();
  const navigate = useNavigate();

  // Load app defs at render time (registry is sync for builtins after module load)
  const appDefs = loadAppDefs();

  const handleOpenApp = (app: AppDefinition) => {
    openApp({
      ...app,
      title: (t as any)[app.title] ?? app.title,
      description: app.description ? ((t as any)[app.description] ?? app.description) : undefined,
    });
    navigate('/');
  };

  const handleBackdrop = () => {
    navigate('/');
  };

  return (
    <div className={s.container} onClick={handleBackdrop}>
      <div className={s.grid} onClick={(e) => e.stopPropagation()}>
        {appDefs.map((app) => (
          <button
            key={app.key}
            className={s.card}
            onClick={() => handleOpenApp(app)}
          >
            <span className={s.icon} style={{ background: app.color }}>
              <Icon type={app.icon} size={42} color="#fff" />
            </span>
            <span className={s.label}>{(t as any)[app.title] ?? app.title}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
