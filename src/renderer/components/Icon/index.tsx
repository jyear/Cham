import React from 'react';

export type IconType =
  | 'wrench'
  | 'chevron-down'
  | 'check'
  | 'arrow-left'
  | 'close'
  | 'folder'
  | 'file'
  | 'settings'
  | 'info'
  | 'bell'
  | 'loading'
  | 'minimize'
  | 'maximize'
  | 'restore';

interface Props {
  type: IconType;
  size?: number;
  color?: string;
  className?: string;
}

const paths: Record<IconType, { viewBox: string; path: React.ReactNode }> = {
  wrench: {
    viewBox: '0 0 24 24',
    path: (
      <path
        d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"
        stroke="currentColor"
        fill="none"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },

  'chevron-down': {
    viewBox: '0 0 10 6',
    path: (
      <path d="M0 0l5 6 5-6z" fill="currentColor" />
    ),
  },

  check: {
    viewBox: '0 0 24 24',
    path: (
      <polyline points="20 6 9 17 4 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    ),
  },

  'arrow-left': {
    viewBox: '0 0 24 24',
    path: (
      <polyline points="15 18 9 12 15 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    ),
  },

  close: {
    viewBox: '0 0 24 24',
    path: (
      <>
        <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </>
    ),
  },

  folder: {
    viewBox: '0 0 24 24',
    path: (
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    ),
  },

  file: {
    viewBox: '0 0 24 24',
    path: (
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <polyline points="14 2 14 8 20 8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  },

  info: {
    viewBox: '0 0 24 24',
    path: (
      <>
        <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
        <line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <circle cx="12" cy="16" r="1" fill="currentColor" />
      </>
    ),
  },

  bell: {
    viewBox: '0 0 24 24',
    path: (
      <>
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  },

  loading: {
    viewBox: '0 0 24 24',
    path: (
      <path d="M21 12a9 9 0 1 1-6.219-8.56" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    ),
  },

  settings: {
    viewBox: '0 0 24 24',
    path: (
      <>
        <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="2" />
        <path
          d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </>
    ),
  },

  minimize: {
    viewBox: '0 0 12 12',
    path: <rect x="1.5" y="5.5" width="9" height="1" fill="currentColor" />,
  },

  maximize: {
    viewBox: '0 0 12 12',
    path: <rect x="1.5" y="1.5" width="9" height="9" rx="0.5" fill="none" stroke="currentColor" strokeWidth="1" />,
  },

  restore: {
    viewBox: '0 0 12 12',
    path: (
      <>
        <rect x="2.5" y="1" width="8" height="8" rx="0.5" fill="none" stroke="currentColor" strokeWidth="1" />
        <rect x="1" y="2.5" width="8" height="8" rx="0.5" fill="none" stroke="currentColor" strokeWidth="1" />
      </>
    ),
  },
};

export default function Icon({ type, size = 16, color, className }: Props) {
  const { viewBox, path } = paths[type];
  const style = color ? { color } : undefined;

  return (
    <svg
      width={size}
      height={size}
      viewBox={viewBox}
      className={className}
      style={style}
    >
      {path}
    </svg>
  );
}
