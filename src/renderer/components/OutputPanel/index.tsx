import React from 'react';
import FileRow, { formatSize } from '@/components/FileRow';
import type { ConvertedItem } from '@/components/SourcePanel';
import { useT } from '@/i18n';
import s from './index.module.css';

type ConversionStatus = 'idle' | 'converting' | 'done';

interface Props {
  status: ConversionStatus;
  convertedItems: ConvertedItem[];
  totalCount?: number;
  processedCount?: number;
}

export default function OutputPanel({ status, convertedItems, totalCount, processedCount }: Props) {
  const { t } = useT();
  const successCount = convertedItems.filter((i) => i.converted).length;
  const failCount = convertedItems.filter((i) => !i.converted).length;

  return (
    <div className={s.panel}>
      <div className={s.header}>
        <h3 className={s.title}>{t.output}</h3>
        {status === 'done' && (
          <span className={s.meta}>{t.okCount(successCount, failCount)}</span>
        )}
        {status === 'converting' && totalCount !== undefined && processedCount !== undefined && (
          <span className={`${s.meta} ${s.metaActive}`}>{t.convertingProgress(processedCount, totalCount)}</span>
        )}
        {status === 'converting' && (totalCount === undefined || processedCount === undefined) && (
          <span className={`${s.meta} ${s.metaActive}`}>{t.converting}</span>
        )}
      </div>

      <div className={s.body}>
        {status === 'idle' ? (
          <div className={s.empty}>{t.readyToConvert}</div>
        ) : status === 'done' && convertedItems.length === 0 ? (
          <div className={s.empty}>{t.allUpToDate}</div>
        ) : convertedItems.length === 0 ? (
          <div className={s.empty}>{t.processing}</div>
        ) : (
          <div className={s.list}>
            {convertedItems.map((item) => {
              const thumbPath = item.converted && item.outputPath ? item.outputPath : item.path;
              const displayPath = item.converted && item.outputPath ? item.outputPath : item.path;
              const displayName = item.converted && item.outputPath
                ? item.outputPath.split(/[\\/]/).pop()!
                : item.name;

              const sizeText = item.converted && item.outputSize
                ? `${formatSize(item.size)} → ${formatSize(item.outputSize)}`
                : undefined;

              return (
                <FileRow
                  key={item.path}
                  file={{ ...item, name: displayName }}
                  thumbPath={thumbPath}
                  displayPath={displayPath}
                  sizeText={sizeText}
                  variant={item.converted ? 'success' : 'error'}
                  badge={
                    item.copied ? (
                      <span className={s.statusCached}>{t.copied}</span>
                    ) : item.cached ? (
                      <span className={s.statusCached}>{t.cached}</span>
                    ) : item.converted ? (
                      <span className={s.statusSuccess}>{t.ok}</span>
                    ) : (
                      <span className={s.statusError} title={item.error}>{t.failed}</span>
                    )
                  }
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
