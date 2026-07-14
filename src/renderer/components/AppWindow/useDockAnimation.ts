import { useMemo } from 'react';
import { useWindows, type FooterRect } from '@/contexts/WindowContext';
import type { Point, Size, AnimationOffset } from './types';

export function useDockAnimation(appKey: string, pos: Point, size: Size): AnimationOffset {
  const { footerRects } = useWindows();
  const footerRect: FooterRect | undefined = footerRects[appKey];

  return useMemo(() => {
    if (!footerRect) {
      return { x: 0, y: 0, scale: 0.3 };
    }

    const windowCenterX = pos.x + size.w / 2;
    const windowCenterY = pos.y + size.h / 2;
    const iconCenterX = footerRect.left + footerRect.width / 2;
    const iconCenterY = footerRect.top + footerRect.height / 2;

    const dx = iconCenterX - windowCenterX;
    const dy = iconCenterY - windowCenterY;

    const scaleX = (footerRect.width * 0.9) / size.w;
    const scaleY = (footerRect.height * 0.9) / size.h;
    const scale = Math.max(0.08, Math.min(scaleX, scaleY, 0.4));

    return { x: dx, y: dy, scale };
  }, [footerRect, pos.x, pos.y, size.w, size.h]);
}
