import React from 'react';
import FileRow, { formatSize, type FileItem } from '@/components/FileRow';
import Icon from '@/components/Icon';
import { useT } from '@/i18n';
import s from './index.module.css';

export const CONVERTIBLE_EXTS = ['.png', '.jpg', '.jpeg', '.gif', '.tiff', '.bmp'];

export function isConvertible(ext: string): boolean {
  return CONVERTIBLE_EXTS.includes(ext.toLowerCase());
}

type ConversionStatus = 'idle' | 'converting' | 'done';

export interface ConvertedItem extends FileItem {
  outputPath?: string;
  outputSize?: number;
  converted: boolean;
  cached?: boolean;
  copied?: boolean;
  error?: string;
}

interface Props {
  files: FileItem[];
  status: ConversionStatus;
  convertedItems: ConvertedItem[];
  onRemoveFile: (path: string) => void;
  onClearFiles: () => void;
  onSelectFiles: () => void;
  onSelectFolder: () => void;
}

export default function SourcePanel({
  files, status, convertedItems,
  onRemoveFile, onClearFiles, onSelectFiles, onSelectFolder,
}: Props) {
  const { t } = useT();
  const totalSize = files.reduce((sum, f) => sum + f.size, 0);

  return (
    <div className={s.panel}>
      <div className={s.header}>
        <h3 className={s.title}>{t.source}</h3>
        {files.length > 0 && (
          <span className={s.meta}>{t.filesCount(files.length)} · {formatSize(totalSize)}</span>
        )}
      </div>

      <div className={s.body}>
        {files.length === 0 ? (
          <div className={s.empty}>{t.noFilesSelected}</div>
        ) : (
          <div className={s.list}>
            {files.map((file) => {
              const converted = convertedItems.find((i) => i.path === file.path);
              const showSuccess = status === 'done' && converted?.converted;
              const showError = status === 'done' && converted && !converted.converted;

              return (
                <FileRow
                  key={file.path}
                  file={file}
                  variant={showSuccess ? 'success' : showError ? 'error' : 'none'}
                  badge={
                    <span className={isConvertible(file.ext) ? s.typeConvert : s.typeCopy}>
                      {isConvertible(file.ext) ? file.ext : t.copyBadge}
                    </span>
                  }
                  action={
                    <button className={s.removeBtn} onClick={() => onRemoveFile(file.path)} title="×">×</button>
                  }
                />
              );
            })}
          </div>
        )}
      </div>

      <div className={s.actions}>
        <button className={s.actionBtn} onClick={onSelectFolder}>
          <Icon type="folder" size={14} />
          {t.addFolder}
        </button>
        <button className={s.actionBtn} onClick={onSelectFiles}>
          <Icon type="file" size={14} />
          {t.addFiles}
        </button>
        {files.length > 0 && (
          <button className={`${s.actionBtn} ${s.clearBtn}`} onClick={onClearFiles}>{t.clearAll}</button>
        )}
      </div>
    </div>
  );
}
