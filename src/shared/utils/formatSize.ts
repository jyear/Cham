/**
 * Format a byte count into a human-readable string.
 * Shared between main process and renderer.
 */
export function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${parseFloat((bytes / Math.pow(1024, i)).toFixed(2))} ${units[i]}`;
}
