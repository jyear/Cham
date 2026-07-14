import React from 'react';
import { RESIZE_DIRECTIONS, type ResizeDirection, WindowMode } from './types';
import s from './index.module.css';

interface Props {
  mode: WindowMode;
  onPointerDown: (dir: ResizeDirection) => (e: React.PointerEvent) => void;
}

const HANDLE_CLASS: Record<ResizeDirection, string> = {
  n: s.handleN,
  s: s.handleS,
  e: s.handleE,
  w: s.handleW,
  ne: s.handleNE,
  nw: s.handleNW,
  se: s.handleSE,
  sw: s.handleSW,
};

export default function ResizeHandles({ mode, onPointerDown }: Props) {
  if (mode === WindowMode.Maximized) return null;

  return (
    <>
      {RESIZE_DIRECTIONS.map((dir) => (
        <div
          key={dir}
          className={`${s.handle} ${HANDLE_CLASS[dir]}`}
          onPointerDown={onPointerDown(dir)}
        />
      ))}
    </>
  );
}
