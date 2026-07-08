import React, { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import en from './en';
import zh from './zh';

export type Lang = 'en' | 'zh';
export type T = typeof en;

const dictionaries: Record<Lang, T> = { en, zh };

const I18nContext = createContext<{ t: T; lang: Lang; setLang: (l: Lang) => void }>({
  t: en,
  lang: 'en',
  setLang: () => {},
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(() => {
    // Try to read persisted language from localStorage (fast, no IPC needed)
    const stored = localStorage.getItem('cham-lang');
    if (stored === 'zh' || stored === 'en') return stored;
    // Fallback to system locale
    if (navigator.language.startsWith('zh')) return 'zh';
    return 'en';
  });

  const handleSetLang = useCallback((l: Lang) => {
    setLang(l);
    localStorage.setItem('cham-lang', l);
  }, []);

  return (
    <I18nContext.Provider value={{ t: dictionaries[lang], lang, setLang: handleSetLang }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useT() {
  return useContext(I18nContext);
}
