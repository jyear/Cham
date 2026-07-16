import { useState, useEffect } from 'react';
import en from './en';
import zh from './zh';

const translations: Record<string, Record<string, string>> = { en, zh };

export function useT(): Record<string, string> {
  const [lang, setLang] = useState<'en' | 'zh'>('zh');

  useEffect(() => {
    if (!window.cham) return;
    window.cham.loadSettings().then((result: any) => {
      if (result?.success && result?.settings?.language) {
        setLang(result.settings.language === 'zh' ? 'zh' : 'en');
      }
    });
  }, []);

  return translations[lang] || translations.zh;
}
