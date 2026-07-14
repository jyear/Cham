const UPDATE_URL = process.env.CHAM_UPDATE_URL || 'https://cham-download.oss-cn-beijing.aliyuncs.com';
const VERSION_URL = `${UPDATE_URL}/version.json`;
const DOWNLOAD_BASE = UPDATE_URL;

export interface VersionFile {
  /** File name, e.g. "Cham-Setup-0.0.2.exe" */
  name: string;
  /** File extension, e.g. "exe" */
  ext: string;
  /** Human-readable label, e.g. "Installer (.exe)" */
  label: string;
}

export interface VersionEntry {
  version: string;
  files: Record<string, string>;
  notes: string;
  timestamp: number;
}

export interface ResolvedVersion {
  version: string;
  notes: string;
  timestamp: number;
  /** Keyed by platform key: "win" | "mac" | "linux" */
  platforms: Record<string, VersionFile[]>;
}

/** Human-readable names for platform keys */
export const PLATFORM_LABELS: Record<string, string> = {
  win: 'Windows',
  mac: 'macOS',
  linux: 'Linux',
};

/** Icons for platform keys */
export const PLATFORM_ICONS: Record<string, string> = {
  win: '⊞',
  mac: '⌘',
  linux: '⟁',
};

/** Derive a human-readable label from a file extension */
function labelForExt(ext: string): string {
  const labels: Record<string, string> = {
    exe: 'Installer (.exe)',
    zip: 'Portable (.zip)',
    dmg: 'Disk Image (.dmg)',
    AppImage: 'AppImage',
    deb: 'Debian (.deb)',
  };
  return labels[ext] || `${ext.toUpperCase()} (.${ext})`;
}

/** Resolve a single VersionEntry into a ResolvedVersion */
export function resolveEntry(entry: VersionEntry): ResolvedVersion {
  const platforms: Record<string, VersionFile[]> = {};

  for (const [key, fileName] of Object.entries(entry.files)) {
    const ext = fileName.includes('.') ? fileName.split('.').pop()! : fileName;
    platforms[key] = [
      {
        name: fileName,
        ext,
        label: labelForExt(ext),
      },
    ];
  }

  return {
    version: entry.version,
    notes: entry.notes,
    timestamp: entry.timestamp,
    platforms,
  };
}

/** Parse version.json — returns the latest entry only */
export function resolveVersion(entries: VersionEntry[]): ResolvedVersion | null {
  if (!entries || entries.length === 0) return null;

  // Use the latest entry (sorted by timestamp desc)
  const sorted = [...entries].sort((a, b) => b.timestamp - a.timestamp);
  return resolveEntry(sorted[0]);
}

/** Parse version.json — returns all entries sorted by timestamp desc */
export function resolveAllVersions(entries: VersionEntry[]): ResolvedVersion[] {
  if (!entries || entries.length === 0) return [];
  return [...entries]
    .sort((a, b) => b.timestamp - a.timestamp)
    .map(resolveEntry);
}

/** Build a full download URL for a given version and file name */
export function downloadUrl(version: string, fileName: string): string {
  return `${DOWNLOAD_BASE}/${version}/${fileName}`;
}

/** Fetch and resolve version data from the remote endpoint */
export async function fetchVersion(): Promise<ResolvedVersion | null> {
  try {
    const res = await fetch(VERSION_URL);
    if (!res.ok) return null;
    const data: VersionEntry[] = await res.json();
    return resolveVersion(data);
  } catch {
    return null;
  }
}

/** Fetch all versions (for the changelog / features page) */
export async function fetchAllVersions(): Promise<ResolvedVersion[]> {
  try {
    const res = await fetch(VERSION_URL);
    if (!res.ok) return [];
    const data: VersionEntry[] = await res.json();
    return resolveAllVersions(data);
  } catch {
    return [];
  }
}
