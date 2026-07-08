import React from 'react';
import Thumbnail from '@/components/Thumbnail';
import s from './index.module.css';

export interface FileItem {
  path: string;
  name: string;
  size: number;
  ext: string;
}

interface Props {
  file: FileItem;
  /** Override thumbnail path (e.g. output path for converted files) */
  thumbPath?: string;
  /** Override display path */
  displayPath?: string;
  /** Left border highlight */
  variant?: 'none' | 'success' | 'error';
  /** Right-side badge element */
  badge?: React.ReactNode;
  /** Extra action button */
  action?: React.ReactNode;
  /** Override size display text */
  sizeText?: string;
}

export function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default function FileRow({ file, thumbPath, displayPath, variant, badge, action, sizeText }: Props) {
  return (
    <div className={`${s.row} ${variant === 'success' ? s.success : variant === 'error' ? s.error : ''}`}>
      <Thumbnail filePath={thumbPath ?? file.path} />
      <div className={s.info}>
        <span className={s.name}>{file.name}</span>
        <span className={s.path} title={displayPath ?? file.path}>
          {displayPath ?? file.path}
        </span>
      </div>
      <span className={s.size}>{sizeText ?? formatSize(file.size)}</span>
      {badge}
      {action}
    </div>
  );
}
