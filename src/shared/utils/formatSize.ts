/**
 * Format a byte count into a human-readable string.
 * Shared between main process and renderer.
 */
export function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = bytes / Math.pow(1024, i);
  const val = parseFloat((bytes / Math.pow(1024, i)).toFixed(2));
  return `${val} ${units[i]}`;
}
