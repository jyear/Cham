import React, { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import en from './en';
import zh from './zh';

export type Lang = 'en' | 'zh';
export type T = typeof en;

const dictionaries: Record<Lang, T> = { en, zh };

const LANG_STORAGE_KEY = 'cham-web-lang';

function detectLang(): Lang {
  const stored = localStorage.getItem(LANG_STORAGE_KEY);
  if (stored === 'zh' || stored === 'en') return stored;
  if (navigator.language.startsWith('zh')) return 'zh';
  return 'en';
}

interface I18nContextValue {
  t: T;
  lang: Lang;
  setLang: (l: Lang) => void;
}

const I18nContext = createContext<I18nContextValue>({
  t: en,
  lang: 'en',
  setLang: () => {},
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(detectLang);

  const handleSetLang = useCallback((l: Lang) => {
    setLang(l);
    localStorage.setItem(LANG_STORAGE_KEY, l);
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
