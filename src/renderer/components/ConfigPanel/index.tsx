import React, { useState } from 'react';
import { useT } from '@/i18n';
import Switch from '@/components/Switch';
import Select from '@/components/Select';
import Tooltip from '@/components/Tooltip';
import Icon from '@/components/Icon';
import FormatSettingsModal from '@/components/FormatSettingsModal';
import { getFormatOptions } from '@shared/formatConfig';
import s from './index.module.css';

type ConversionStatus = 'idle' | 'converting' | 'done';

const FORMAT_OPTIONS = [
  { value: 'webp' as const, label: '.webp' },
];

interface Props {
  quality: number;
  format: string;
  formatOptions: Record<string, number | boolean | string>;
  keepName: boolean;
  copyNonConvertible: boolean;
  watchMode: boolean;
  canWatch: boolean;
  outputDir: string;
  canConvert: boolean;
  status: ConversionStatus;
  onQualityChange: (v: number) => void;
  onFormatChange: (v: string) => void;
  onFormatOptionChange: (key: string, value: number | boolean | string) => void;
  onKeepNameChange: (v: boolean) => void;
  onCopyNonConvertibleChange: (v: boolean) => void;
  onWatchModeChange: (v: boolean) => void;
  onSelectOutputDir: () => void;
  onConvert: () => void;
}

export default function ConfigPanel({
  quality, format, formatOptions, keepName, copyNonConvertible,
  watchMode, canWatch,
  outputDir, canConvert, status,
  onQualityChange, onFormatChange, onFormatOptionChange,
  onKeepNameChange, onCopyNonConvertibleChange,
  onWatchModeChange,
  onSelectOutputDir, onConvert,
}: Props) {
  const { t } = useT();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const hasOptions = getFormatOptions(format).length > 0;

  return (
    <div className={s.panel}>
      <div className={s.header}>
        <h3 className={s.title}>{t.config}</h3>
      </div>

      <div className={s.body}>
        {/* Format */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <span className={s.label}>{t.format}</span>
          <div className={s.formatRow}>
            <Select options={FORMAT_OPTIONS} value={format as 'webp' | 'avif'} onChange={onFormatChange} />
            {hasOptions && (
              <button className={s.gearBtn} title={t.formatOptions} onClick={() => setSettingsOpen(true)}>
                <Icon type="wrench" size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Quality */}
        <div className={s.group}>
          <div className={s.labelRow}>
            <label className={s.label}>{t.quality}</label>
            <span className={s.value}>{quality}%</span>
          </div>
          <input type="range" min={1} max={100} value={quality}
            onChange={(e) => onQualityChange(Number(e.target.value))} className={s.slider}/>
          <div className={s.rangeLabels}>
            <span>{t.smallerFile}</span>
            <span>{t.betterQuality}</span>
          </div>
        </div>

        <div className={s.switch}>
          <div className={s.switchLabel}>
            <span className={s.switchTitle}>{t.keepExtension}</span>
            <span className={s.switchHint}>{t.keepExtensionHintWebp}</span>
          </div>
          <Switch checked={keepName} onChange={onKeepNameChange} />
        </div>

        <div className={s.switch}>
          <div className={s.switchLabel}>
            <span className={s.switchTitle}>{t.copyOtherTypes}</span>
            <span className={s.switchHint}>{t.copyOtherTypesHint}</span>
          </div>
          <Switch checked={copyNonConvertible} onChange={onCopyNonConvertibleChange} />
        </div>

        <div className={s.divider} />

        <div className={s.switch}>
          <div className={s.switchLabel}>
            <span className={s.switchTitle}>{t.watchMode}</span>
            <span className={s.switchHint}>{canWatch ? t.watchModeHint : t.watchModeNoFolder}</span>
          </div>
          <Switch checked={watchMode} onChange={onWatchModeChange} disabled={!canWatch} />
        </div>
      </div>

      <div className={s.convertArea}>
        <button className={`btn btnPrimary ${s.convertBtn} ${status === 'converting' ? 'loading' : ''}`}
          disabled={!canConvert} onClick={onConvert}>
          {status === 'converting' ? t.converting : status === 'done' ? t.convertAgain : t.convert}
        </button>
        {!outputDir ? (
          <div
            className={`${s.pathHint} ${s.pathHintEmpty} ${watchMode ? s.pathHintLocked : ''}`}
            onClick={watchMode ? undefined : onSelectOutputDir}
          >
            {t.selectOutputFolder}
          </div>
        ) : watchMode ? (
          <Tooltip text={t.watchModeLockOutput}>
            <div className={`${s.pathHint} ${s.pathHintLocked}`}>{outputDir}</div>
          </Tooltip>
        ) : (
          <div className={s.pathHint} onClick={onSelectOutputDir} title={outputDir}>{outputDir}</div>
        )}
      </div>

      <FormatSettingsModal
        open={settingsOpen}
        format={format}
        values={formatOptions}
        onChange={onFormatOptionChange}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  );
}
