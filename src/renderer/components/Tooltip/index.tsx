import React, { useState, useRef, useEffect, useCallback, type ReactNode } from 'react';
import s from './index.module.css';

export interface MenuItem {
  label: string;
  onClick: () => void;
}

interface Props {
  text?: string;
  children: ReactNode;
  className?: string;
  menuItems?: MenuItem[];
}

export default function Tooltip({ text, children, className, menuItems }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeMenu();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen, closeMenu]);

  // Close on Escape
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMenu();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [menuOpen, closeMenu]);

  function onContextMenu(e: React.MouseEvent) {
    if (!menuItems || menuItems.length === 0) return;
    e.preventDefault();
    setMenuOpen(true);
  }

  function onItemClick(item: MenuItem) {
    item.onClick();
    closeMenu();
  }

  return (
    <div
      ref={wrapperRef}
      className={`${s.wrapper} ${className ?? ''} ${menuOpen ? s.menuActive : ''}`}
      onContextMenu={onContextMenu}
    >
      {children}

      {/* Tooltip label — only shown when text is provided */}
      {text && !menuOpen && <span className={s.tip}>{text}</span>}

      {/* Context menu — shown on right-click */}
      {menuOpen && menuItems && (
        <div ref={menuRef} className={s.menu}>
          {menuItems.map((item, i) => (
            <button key={i} className={s.menuItem} onClick={() => onItemClick(item)}>
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
