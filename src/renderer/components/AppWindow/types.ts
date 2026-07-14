// ── Window mode ──
export const WindowMode = {
  Normal: 'normal',
  Minimized: 'minimized',
  Maximized: 'maximized',
} as const;

export type WindowMode = (typeof WindowMode)[keyof typeof WindowMode];

// ── Resize ──
export const RESIZE_DIRECTIONS = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'] as const;
export type ResizeDirection = (typeof RESIZE_DIRECTIONS)[number];

// ── Geometry ──
export interface Point {
  x: number;
  y: number;
}

export interface Size {
  w: number;
  h: number;
}

export interface Rect extends Point, Size {}

// ── Animation ──
export interface AnimationOffset {
  x: number;
  y: number;
  scale: number;
}
