import { useEffect } from 'react';

/**
 * Calls `onEscape` when the Escape key is pressed.
 * Cleaned up automatically on unmount or when `enabled` becomes false.
 */
export function useEscapeKey(
  onEscape: () => void,
  enabled: boolean = true,
): void {
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onEscape();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onEscape, enabled]);
}
