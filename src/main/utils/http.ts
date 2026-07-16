/**
 * Shared HTTP helpers — used by update checking and plugin installer.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';

const REDIRECT_CODES = new Set([301, 302, 303, 307, 308]);
const MAX_REDIRECTS = 10;
const TIMEOUT_MS = 30000;

/** Simple HTTPS GET that follows redirects with a limit */
export function httpGet(url: string, redirects = 0): Promise<string> {
  return new Promise((resolve, reject) => {
    if (redirects > MAX_REDIRECTS) {
      return reject(new Error('Too many redirects'));
    }
    const req = https.get(url, { timeout: TIMEOUT_MS }, (res) => {
      if (REDIRECT_CODES.has(res.statusCode || 0) && res.headers.location) {
        httpGet(res.headers.location, redirects + 1).then(resolve, reject);
        return;
      }
      if (res.statusCode !== 200) {
        req.destroy();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve(data));
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
    req.on('error', reject);
  });
}

/** Download a file to disk, with redirect limit, timeout, and progress */
export function downloadFile(url: string, dest: string, onProgress?: (pct: number) => void, redirects = 0): Promise<void> {
  return new Promise((resolve, reject) => {
    if (redirects > MAX_REDIRECTS) {
      return reject(new Error('Too many redirects'));
    }
    const dir = path.dirname(dest);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const req = https.get(url, { timeout: TIMEOUT_MS }, (res) => {
      if (REDIRECT_CODES.has(res.statusCode || 0) && res.headers.location) {
        downloadFile(res.headers.location, dest, onProgress, redirects + 1).then(resolve, reject);
        return;
      }
      const total = parseInt(res.headers['content-length'] || '0', 10);
      let downloaded = 0;
      const file = fs.createWriteStream(dest);
      file.on('error', reject);
      res.on('data', (chunk) => { downloaded += chunk.length; if (total > 0 && onProgress) onProgress(Math.round((downloaded / total) * 100)); });
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
    req.on('error', reject);
  });
}
