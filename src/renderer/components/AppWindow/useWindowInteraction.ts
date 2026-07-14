import { useRef, useState, useCallback, useEffect } from 'react';
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

  // Clamp position when desktop bounds shrink (e.g. main window un-maximized)
  useEffect(() => {
    if (!desktopBounds) return;
    const { w, h } = sizeRef.current;
    setPos((p) => {
      const maxX = desktopBounds.left + desktopBounds.width - w;
      const maxY = desktopBounds.top + desktopBounds.height - h;
      const nx = clamp(p.x, desktopBounds.left, Math.max(desktopBounds.left, maxX));
      const ny = clamp(p.y, desktopBounds.top, Math.max(desktopBounds.top, maxY));
      if (nx !== p.x || ny !== p.y) return { x: nx, y: ny };
      return p;
    });
  }, [desktopBounds]); // eslint-disable-line react-hooks/exhaustive-deps

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
        const db = desktopRef.current;

        setSize((prev) => {
          let nw = prev.w;
          let nh = prev.h;

          if (axis.dx > 0) {
            // Right edge: clamp to desktop bounds
            const maxW = db ? db.left + db.width - rs.x : Infinity;
            nw = Math.max(minWidth, Math.min(rs.w + dx, maxW));
          } else if (axis.dx < 0) {
            // Left edge: shrink from left
            nw = Math.max(minWidth, rs.w - dx);
          }

          if (axis.dy > 0) {
            // Bottom edge: clamp to desktop bounds
            const maxH = db ? db.top + db.height - rs.y : Infinity;
            nh = Math.max(minHeight, Math.min(rs.h + dy, maxH));
          } else if (axis.dy < 0) {
            // Top edge: shrink from top
            nh = Math.max(minHeight, rs.h - dy);
          }

          return { w: nw, h: nh };
        });

        // Move origin for W / N edges, clamped to desktop
        setPos((p) => {
          const nx = axis.dx < 0 ? clamp(rs.x + dx, db?.left ?? -Infinity, db ? db.left + db.width - sizeRef.current.w : Infinity) : p.x;
          const ny = axis.dy < 0 ? clamp(rs.y + dy, db?.top ?? -Infinity, db ? db.top + db.height - sizeRef.current.h : Infinity) : p.y;
          return { x: nx, y: ny };
        });
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
