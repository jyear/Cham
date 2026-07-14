import { app, shell } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { httpGet, downloadFile } from '../utils/http';

const UPDATE_URL = process.env.CHAM_UPDATE_URL || 'https://cham-download.oss-cn-beijing.aliyuncs.com';
const VERSION_URL = `${UPDATE_URL}/version.json`;
const DOWNLOAD_BASE = UPDATE_URL;

interface VersionEntry {
  version: string;
  files: Record<string, string>;
  notes: string;
  timestamp?: number;
}

interface ChangelogEntry {
  version: string;
  notes: string;
  timestamp?: number;
}

interface UpdateStatus {
  checking: boolean;
  updateAvailable: boolean;
  currentVersion: string;
  latestVersion?: string;
  latestNotes?: string;
  downloadUrl?: string;
  changelog: ChangelogEntry[];
  downloading: boolean;
  progress: number;
  error?: string;
}

let status: UpdateStatus = {
  checking: false,
  updateAvailable: false,
  currentVersion: app.getVersion(),
  changelog: [],
  downloading: false,
  progress: 0,
};

let lastDownloadPath: string | null = null;

function getPlatformKey(): string {
  const p = process.platform;
  if (p === 'win32') return 'win';
  if (p === 'darwin') return 'mac';
  return 'linux';
}

export function getUpdateStatus(): UpdateStatus {
  return { ...status };
}

export function getLastDownloadPath(): string | null {
  return lastDownloadPath;
}

export function installUpdate(filePath?: string): void {
  const installerPath = filePath || lastDownloadPath;
  if (!installerPath || !fs.existsSync(installerPath)) {
    throw new Error('Installer file not found');
  }
  shell.openPath(installerPath);
  // Give the installer a moment to launch, then quit
  setImmediate(() => {
    app.quit();
  });
}

export async function checkForUpdates(): Promise<UpdateStatus> {
  status = { ...status, checking: true, error: undefined };
  try {
    const raw = await httpGet(VERSION_URL);
    const versions: VersionEntry[] = JSON.parse(raw);
    if (!Array.isArray(versions) || versions.length === 0) {
      throw new Error('Invalid version data');
    }

    const latest = versions[0];
    const current = app.getVersion();

    if (latest.version !== current) {
      // Collect changelog: all versions newer than current
      const changelog: ChangelogEntry[] = [];
      for (const v of versions) {
        if (v.version === current) break;
        changelog.push({ version: v.version, notes: v.notes, timestamp: v.timestamp });
      }

      const platformKey = getPlatformKey();
      const fileName = latest.files[platformKey];
      const downloadUrl = fileName
        ? `${DOWNLOAD_BASE}/${latest.version}/${fileName}`
        : undefined;

      status = {
        ...status,
        checking: false,
        updateAvailable: true,
        latestVersion: latest.version,
        latestNotes: latest.notes,
        downloadUrl,
        changelog,
      };
    } else {
      status = { ...status, checking: false, updateAvailable: false, changelog: [] };
    }
  } catch (e: any) {
    status = { ...status, checking: false, error: e.message };
  }
  return { ...status };
}

export async function downloadUpdate(onProgress?: (pct: number) => void): Promise<string> {
  status = { ...status, downloading: true, progress: 0, error: undefined };

  try {
    const raw = await httpGet(VERSION_URL);
    const versions: VersionEntry[] = JSON.parse(raw);
    const latest = versions[0];
    const platformKey = getPlatformKey();
    const fileName = latest.files[platformKey];
    if (!fileName) throw new Error(`No file for platform: ${platformKey}`);

    const tmpDir = path.join(os.tmpdir(), 'cham-update');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

    const url = `${DOWNLOAD_BASE}/${latest.version}/${fileName}`;
    const dest = path.join(tmpDir, fileName);

    await downloadFile(url, dest, (pct) => {
      status = { ...status, progress: pct };
      if (onProgress) onProgress(pct);
    });

    status = { ...status, downloading: false, progress: 100 };
    lastDownloadPath = dest;
    return dest;
  } catch (e: any) {
    status = { ...status, downloading: false, error: e.message };
    throw e;
  }
}
