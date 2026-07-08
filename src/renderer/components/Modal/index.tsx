import React, { useEffect, type ReactNode } from 'react';
import Icon from '@/components/Icon';
import s from './index.module.css';

interface Props {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
}

export default function Modal({ open, title, children, onClose }: Props) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className={s.overlay} onClick={onClose}>
      <div className={s.modal} onClick={(e) => e.stopPropagation()}>
        <div className={s.header}>
          <h2 className={s.title}>{title}</h2>
          <button className={s.close} onClick={onClose}>
            <Icon type="close" size={16} />
          </button>
        </div>
        <div className={s.body}>{children}</div>
      </div>
    </div>
  );
}
