import { useState, useEffect, useCallback } from 'react';

const ATTR = 'data-has-background';
const STORAGE_ENABLED = 'cham-bg-enabled';
const root = document.documentElement;

function applyBackground(dataUrl: string) {
  if (dataUrl) {
    root.style.backgroundImage = `url(${dataUrl})`;
    root.style.backgroundSize = 'cover';
    root.style.backgroundPosition = 'center';
    root.style.backgroundRepeat = 'no-repeat';
    root.style.backgroundAttachment = 'fixed';
    root.setAttribute(ATTR, '');
  } else {
    root.style.backgroundImage = '';
    root.style.backgroundSize = '';
    root.style.backgroundPosition = '';
    root.style.backgroundRepeat = '';
    root.style.backgroundAttachment = '';
    root.removeAttribute(ATTR);
  }
}

function getEnabled(): boolean {
  return localStorage.getItem(STORAGE_ENABLED) !== 'false';
}

export function useBackground() {
  const [items, setItems] = useState<BackgroundItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [enabled, setEnabledState] = useState<boolean>(getEnabled);

  // Load backgrounds from DB on mount
  useEffect(() => {
    if (!window.cham) return;
    window.cham.backgroundList().then((result) => {
      if (result.success && result.items) {
        setItems(result.items);
        const active = result.items.find((it) => it.selected);
        if (active && getEnabled()) {
          applyBackground(active.dataUrl);
        }
      }
      setLoaded(true);
    });

    // Listen for background changes pushed from main process
    // (e.g. when a plugin calls backgroundSetFromUrl)
    const unsub = window.cham.onBackgroundChanged((data) => {
      if (data.items) setItems(data.items);
      if (data.dataUrl && getEnabled()) {
        applyBackground(data.dataUrl);
      }
    });
    return unsub;
  }, []);

  // Toggle enabled
  const setEnabled = useCallback((v: boolean) => {
    setEnabledState(v);
    localStorage.setItem(STORAGE_ENABLED, String(v));
    if (v) {
      // Re-apply the active background
      const active = items.find((it) => it.selected);
      if (active) {
        applyBackground(active.dataUrl);
      }
    } else {
      applyBackground('');
    }
  }, [items]);

  // Select a new background image from disk
  const selectBackground = useCallback(async () => {
    if (!window.cham) return;
    const result = await window.cham.backgroundSelect();
    if (result.success && result.items) {
      setItems(result.items);
      const active = result.items.find((it) => it.selected);
      if (active && enabled) {
        applyBackground(active.dataUrl);
      }
    }
  }, [enabled]);

  // Set a background as active
  const setActiveBackground = useCallback(async (id: number) => {
    if (!window.cham) return;
    const result = await window.cham.backgroundSetActive(id);
    if (result.success) {
      if (result.items) setItems(result.items);
      if (result.dataUrl && enabled) applyBackground(result.dataUrl);
    }
  }, [enabled]);

  // Delete a background
  const deleteBackground = useCallback(async (id: number) => {
    if (!window.cham) return;
    const result = await window.cham.backgroundDelete(id);
    if (result.success) {
      if (result.items) setItems(result.items);
      if (result.dataUrl && enabled) {
        applyBackground(result.dataUrl);
      } else if (!result.dataUrl) {
        applyBackground('');
      }
    }
  }, [enabled]);

  const activeItem = items.find((it) => it.selected);
  const background = activeItem?.dataUrl || '';

  return {
    items,
    loaded,
    background,
    activeItem,
    enabled,
    setEnabled,
    selectBackground,
    setActiveBackground,
    deleteBackground,
  } as const;
}
