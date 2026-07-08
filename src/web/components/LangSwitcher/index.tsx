import React, { useState, useRef, useEffect } from 'react';
import { useT, type Lang } from '../../i18n';
import './index.css';

const LANG_OPTIONS: { key: Lang; label: string }[] = [
  { key: 'zh', label: '中文' },
  { key: 'en', label: 'English' },
];

export default function LangSwitcher() {
  const { lang, setLang } = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const currentLabel = LANG_OPTIONS.find((o) => o.key === lang)?.label || 'English';

  return (
    <div className="lang-switcher" ref={ref}>
      <button className="lang-switcher-btn" onClick={() => setOpen(!open)}>
        {currentLabel}
        <span className={`lang-arrow ${open ? 'open' : ''}`}>▾</span>
      </button>
      {open && (
        <ul className="lang-dropdown">
          {LANG_OPTIONS.map((o) => (
            <li key={o.key}>
              <button
                className={`lang-option ${o.key === lang ? 'active' : ''}`}
                onClick={() => {
                  setLang(o.key);
                  setOpen(false);
                }}
              >
                {o.label}
                {o.key === lang && <span className="lang-check">✓</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
