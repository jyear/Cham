import { useState, useEffect } from 'react';

/** Subscribe to window maximize/restore state from Electron */
export function useWindowState() {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    if (!window.cham) return;

    window.cham.windowIsMaximized().then(setMaximized);

    const unsubscribe = window.cham.onWindowStateChanged((state) => {
      setMaximized(state.maximized);
    });

    return unsubscribe;
  }, []);

  return { maximized };
}
