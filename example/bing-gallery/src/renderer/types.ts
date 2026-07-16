// ── Shared types for Bing Gallery plugin ──

export interface BingImage {
  url: string;
  fullUrl: string;
  copyright: string;
  title: string;
  time: string;
  hash: string;
}

export interface FavoriteImage {
  id: number;
  url: string;
  copyright: string;
  title: string;
  createdAt: string;
}

export interface DownloadRecord {
  id: number;
  imageUrl: string;
  fullUrl: string;
  copyright: string;
  title: string;
  hash: string;
  localPath: string;
  fileName: string;
  downloadedAt: string;
}

export type ViewableImage = BingImage | FavoriteImage | DownloadRecord;

export type TabType = 'daily' | 'favorites' | 'downloads';
