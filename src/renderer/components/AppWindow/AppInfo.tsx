import React from 'react';
import Modal from '@/components/Modal';
import Icon from '@/components/Icon';
import { useT } from '@/i18n';
import type { AppWindowState } from '@/contexts/WindowContext';
import s from './index.module.css';

interface Props {
  win: AppWindowState;
  open: boolean;
  onClose: () => void;
}

export default function AppInfo({ win, open, onClose }: Props) {
  const { t } = useT();
  const displayTitle = (t as any)[win.title] ?? win.title;
  const displayDesc = win.description ? ((t as any)[win.description] ?? win.description) : undefined;

  return (
    <Modal open={open} title="" onClose={onClose} width={380}>
      <div className={s.appInfo}>
        <span className={s.appInfoIcon} style={{ background: win.color }}>
          <Icon type={win.icon} size={36} color="#fff" />
        </span>
        <h3 className={s.appInfoTitle}>{displayTitle}</h3>
        {displayDesc && <p className={s.appInfoDesc}>{displayDesc}</p>}
      </div>
    </Modal>
  );
}
