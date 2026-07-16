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

export type TabType = 'daily' | 'favorites';
