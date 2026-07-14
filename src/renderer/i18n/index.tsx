import React, { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react';
import en from './en';
import zh from './zh';

export type Lang = 'en' | 'zh';
export type T = typeof en;

const dictionaries: Record<Lang, T> = { en, zh };

/**
 * Plugin-provided translation overrides.
 * Keyed by language, then by i18n key.
 * Populated at app startup via registerPluginI18n().
 */
const pluginTranslations: Record<string, Record<string, string>> = {};

/**
 * Register translations from a plugin.
 * Called at app startup for each installed plugin that has i18n files.
 *
 * @example
 *   registerPluginI18n({
 *     en: { myPluginName: 'My Plugin', myPluginDesc: 'Does things' },
 *     zh: { myPluginName: '我的插件', myPluginDesc: '做事情' },
 *   });
 */
export function registerPluginI18n(translations: Partial<Record<Lang, Record<string, string>>>): void {
  for (const [lang, keys] of Object.entries(translations)) {
    if (!pluginTranslations[lang]) pluginTranslations[lang] = {};
    Object.assign(pluginTranslations[lang], keys);
  }
}

/**
 * Resolve a translated value from either the app dictionaries or plugin overrides.
 * Works even for keys not known at build time.
 */
export function translate(lang: Lang, key: string): string {
  // Plugin translations take priority
  const plugin = pluginTranslations[lang];
  if (plugin && key in plugin) return plugin[key];
  // Fall back to app dictionary
  const app = dictionaries[lang] as any;
  if (app && key in app) return app[key];
  // Return key as-is
  return key;
}

const I18nContext = createContext<{ t: T; lang: Lang; setLang: (l: Lang) => void }>({
  t: en,
  lang: 'en',
  setLang: () => {},
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(() => {
    const stored = localStorage.getItem('cham-lang');
    if (stored === 'zh' || stored === 'en') return stored;
    if (navigator.language.startsWith('zh')) return 'zh';
    return 'en';
  });

  const handleSetLang = useCallback((l: Lang) => {
    setLang(l);
    localStorage.setItem('cham-lang', l);
  }, []);

  // Merge app dictionary with plugin translations
  const t = useMemo(() => {
    const app = dictionaries[lang];
    const plugins = pluginTranslations[lang];
    if (!plugins) return app;
    return { ...(app as any), ...plugins } as T;
  }, [lang]);

  return (
    <I18nContext.Provider value={{ t, lang, setLang: handleSetLang }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useT() {
  return useContext(I18nContext);
}
