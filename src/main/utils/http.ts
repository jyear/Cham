/**
 * Shared HTTP helpers — used by update checking and plugin installer.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';

/** Simple HTTPS GET that follows redirects */
export function httpGet(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        httpGet(res.headers.location!).then(resolve, reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

/** Download a file to disk, with optional progress callback */
export function downloadFile(url: string, dest: string, onProgress?: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const dir = path.dirname(dest);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    https.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        downloadFile(res.headers.location!, dest, onProgress).then(resolve, reject);
        return;
      }
      const total = parseInt(res.headers['content-length'] || '0', 10);
      let downloaded = 0;
      const file = fs.createWriteStream(dest);
      res.on('data', (chunk) => { downloaded += chunk.length; file.write(chunk); if (total > 0 && onProgress) onProgress(Math.round((downloaded / total) * 100)); });
      res.on('end', () => { file.end(); resolve(); });
      res.on('error', reject);
    }).on('error', reject);
  });
}
