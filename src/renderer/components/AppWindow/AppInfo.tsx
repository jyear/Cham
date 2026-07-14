import React from 'react';
import Modal from '@/components/Modal';
import Icon from '@/components/Icon';
import type { AppWindowState } from '@/contexts/WindowContext';
import s from './index.module.css';

interface Props {
  win: AppWindowState;
  open: boolean;
  onClose: () => void;
}

export default function AppInfo({ win, open, onClose }: Props) {
  return (
    <Modal open={open} title="" onClose={onClose} width={380}>
      <div className={s.appInfo}>
        <span className={s.appInfoIcon} style={{ background: win.color }}>
          <Icon type={win.icon} size={36} color="#fff" />
        </span>
        <h3 className={s.appInfoTitle}>{win.title}</h3>
        {win.description && <p className={s.appInfoDesc}>{win.description}</p>}
      </div>
    </Modal>
  );
}
