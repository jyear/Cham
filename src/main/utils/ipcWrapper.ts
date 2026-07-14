/**
 * IPC handler wrapper — eliminates the repetitive try/catch
 * { success, error } pattern repeated across 30+ handlers.
 *
 * Usage:
 *   ipcMain.handle('my-channel', ipcWrap(async (event, params) => {
 *     const result = await doWork(params);
 *     return result;
 *   }));
 */
export function ipcWrap<T>(fn: (...args: any[]) => Promise<T>) {
  return async (...args: any[]) => {
    try {
      const data = await fn(...args);
      return { success: true, ...(data as any) };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  };
}
