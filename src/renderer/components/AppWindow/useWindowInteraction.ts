import { useRef, useState, useCallback } from 'react';
import { useWindows, type DesktopBounds } from '@/contexts/WindowContext';
import { WindowMode, type ResizeDirection, type Point, type Size, type Rect } from './types';

const RESIZE_AXIS: Record<string, { dx: number; dy: number }> = {
  e: { dx: 1, dy: 0 },
  w: { dx: -1, dy: 0 },
  s: { dx: 0, dy: 1 },
  n: { dx: 0, dy: -1 },
  ne: { dx: 1, dy: -1 },
  nw: { dx: -1, dy: -1 },
  se: { dx: 1, dy: 1 },
  sw: { dx: -1, dy: 1 },
};

interface UseWindowInteractionOpts {
  id: string;
  mode: WindowMode;
  minWidth: number;
  minHeight: number;
  desktopBounds: DesktopBounds | null;
}

export function useWindowInteraction(opts: UseWindowInteractionOpts) {
  const { id, mode, minWidth, minHeight, desktopBounds } = opts;
  const { focusApp } = useWindows();

  const [pos, setPos] = useState<Point>({ x: 60, y: 50 });
  const [size, setSize] = useState<Size>({ w: minWidth, h: minHeight });

  // ── Refs (avoid re-renders during pointer move) ──
  const dragging = useRef(false);
  const resizing = useRef<ResizeDirection | null>(null);
  const pointerOffset = useRef<Point>({ x: 0, y: 0 });
  const resizeStart = useRef<Rect>({ x: 0, y: 0, w: 0, h: 0 });
  const sizeRef = useRef(size);
  sizeRef.current = size;
  const desktopRef = useRef(desktopBounds);
  desktopRef.current = desktopBounds;

  // ── Drag (title bar) ──
  const onTitleBarPointerDown = useCallback(
    (e: React.PointerEvent) => {
      focusApp(id);
      dragging.current = true;
      pointerOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [id, pos, focusApp],
  );

  // ── Resize (edge handles) ──
  const onResizeHandlePointerDown = useCallback(
    (dir: ResizeDirection) => (e: React.PointerEvent) => {
      e.stopPropagation();
      focusApp(id);
      resizing.current = dir;
      resizeStart.current = { x: pos.x, y: pos.y, w: size.w, h: size.h };
      pointerOffset.current = { x: e.clientX, y: e.clientY };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [id, pos, size, focusApp],
  );

  // ── Move (shared) ──
  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (dragging.current) {
        if (mode === WindowMode.Maximized) return;
        const db = desktopRef.current;
        if (!db) return;
        const { w, h } = sizeRef.current;
        const nx = e.clientX - pointerOffset.current.x;
        const ny = e.clientY - pointerOffset.current.y;
        setPos({
          x: clamp(nx, db.left, db.left + db.width - w),
          y: clamp(ny, db.top, db.top + db.height - h),
        });
        return;
      }

      if (resizing.current) {
        const dx = e.clientX - pointerOffset.current.x;
        const dy = e.clientY - pointerOffset.current.y;
        const axis = RESIZE_AXIS[resizing.current];
        const rs = resizeStart.current;

        setSize((prev) => {
          let nw = prev.w;
          let nh = prev.h;

          if (axis.dx > 0) nw = Math.max(minWidth, rs.w + dx);
          else if (axis.dx < 0) nw = Math.max(minWidth, rs.w - dx);

          if (axis.dy > 0) nh = Math.max(minHeight, rs.h + dy);
          else if (axis.dy < 0) nh = Math.max(minHeight, rs.h - dy);

          return { w: nw, h: nh };
        });

        // Move origin for W / N edges
        setPos((p) => ({
          x: axis.dx < 0 ? rs.x + dx : p.x,
          y: axis.dy < 0 ? rs.y + dy : p.y,
        }));

        // Clamp position after potential origin shift
        // (done via a microtask-style approach: the next line sets both correctly)
        if (axis.dx < 0 || axis.dy < 0) {
          const db = desktopRef.current;
          if (db) {
            const sw = sizeRef.current;
            setPos((p) => ({
              x: axis.dx < 0 ? clamp(rs.x + dx, db.left, db.left + db.width - sw.w) : p.x,
              y: axis.dy < 0 ? clamp(rs.y + dy, db.top, db.top + db.height - sw.h) : p.y,
            }));
          }
        }
      }
    },
    [mode, minWidth, minHeight],
  );

  // ── Up (shared) ──
  const onPointerUp = useCallback(() => {
    dragging.current = false;
    resizing.current = null;
  }, []);

  // ── Computed layout ──
  const isMaxed = mode === WindowMode.Maximized;
  const layout = {
    left: isMaxed && desktopBounds ? desktopBounds.left : pos.x,
    top: isMaxed && desktopBounds ? desktopBounds.top : pos.y,
    width: isMaxed && desktopBounds ? desktopBounds.width : size.w,
    height: isMaxed && desktopBounds ? desktopBounds.height : size.h,
  };

  return {
    pos,
    size,
    layout,
    onTitleBarPointerDown,
    onResizeHandlePointerDown,
    onPointerMove,
    onPointerUp,
  };
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(v, hi));
}
