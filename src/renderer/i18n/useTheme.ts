import { useState, useEffect, useCallback } from 'react';

export type Theme = 'dark' | 'light';

function getInitial(): Theme {
  const stored = localStorage.getItem('cham-theme');
  if (stored === 'dark' || stored === 'light') return stored;
  return 'dark';
}

// Apply immediately to avoid flash
document.documentElement.setAttribute('data-theme', getInitial());

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(getInitial);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    localStorage.setItem('cham-theme', t);
    document.documentElement.setAttribute('data-theme', t);
    window.cham?.saveSettings({ theme: t });
  }, []);

  return { theme, setTheme } as const;
}
