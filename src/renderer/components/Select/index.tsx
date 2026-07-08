import React, { useState, useRef, useEffect, useCallback } from 'react';
import Icon from '@/components/Icon';
import s from './index.module.css';

export interface SelectOption<T extends string = string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  options: SelectOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

export default function Select<T extends string>({ options, value, onChange }: Props<T>) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
      setOpen(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open, handleClickOutside]);

  const handleToggle = () => {
    if (!open && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setMenuStyle({
        position: 'fixed',
        top: rect.bottom + 4,
        right: window.innerWidth - rect.right,
        minWidth: rect.width,
      });
    }
    setOpen((v) => !v);
  };

  const handleSelect = (opt: SelectOption<T>) => {
    onChange(opt.value);
    setOpen(false);
  };

  return (
    <div className={s.container} ref={containerRef}>
      <button
        type="button"
        className={`${s.trigger} ${open ? s.triggerOpen : ''}`}
        onClick={handleToggle}
      >
        <span>{selected?.label ?? value}</span>
        <Icon type="chevron-down" size={10} className={`${s.arrow} ${open ? s.arrowUp : ''}`} />
      </button>

      {open && (
        <div className={s.menu} style={menuStyle}>
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`${s.option} ${opt.value === value ? s.optionActive : ''}`}
              onClick={() => handleSelect(opt)}
            >
              <span>{opt.label}</span>
              <span className={s.check}>
                {opt.value === value && <Icon type="check" size={12} />}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
