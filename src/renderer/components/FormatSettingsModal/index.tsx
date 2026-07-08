import React from 'react';
import Modal from '@/components/Modal';
import Switch from '@/components/Switch';
import Select from '@/components/Select';
import { useT } from '@/i18n';
import { getFormatOptions, type FormatOptionDef } from '@shared/formatConfig';
import s from './index.module.css';

interface Props {
  open: boolean;
  format: string;
  values: Record<string, number | boolean | string>;
  onChange: (key: string, value: number | boolean | string) => void;
  onClose: () => void;
}

export default function FormatSettingsModal({ open, format, values, onChange, onClose }: Props) {
  const { t } = useT() as { t: Record<string, any> };
  const options = getFormatOptions(format);

  if (options.length === 0) return null;

  const renderControl = (opt: FormatOptionDef) => {
    const val = values[opt.key] ?? opt.default;

    switch (opt.type) {
      case 'boolean':
        return (
          <Switch
            checked={Boolean(val)}
            onChange={(v) => onChange(opt.key, v)}
          />
        );

      case 'number':
        return (
          <div className={s.numRow}>
            <input
              type="range"
              min={opt.min ?? 0}
              max={opt.max ?? 100}
              value={Number(val)}
              onChange={(e) => onChange(opt.key, Number(e.target.value))}
              className={s.slider}
            />
            <span className={s.numVal}>{String(val)}</span>
          </div>
        );

      case 'select':
        return (
          <Select
            options={(opt.options ?? []).map((o) => ({ value: o.value, label: o.label }))}
            value={String(val)}
            onChange={(v) => onChange(opt.key, v)}
          />
        );

      default:
        return null;
    }
  };

  return (
    <Modal open={open} title={(t as any).formatOptions} onClose={onClose}>
      <div className={s.body}>
        {options.map((opt) => (
          <div key={opt.key} className={s.optRow}>
            <div className={s.optInfo}>
              <span className={s.optLabel}>{(t as any)[opt.labelKey] ?? opt.key}</span>
              <span className={s.optDesc}>{(t as any)[opt.descKey]}</span>
            </div>
            <div className={s.optControl}>{renderControl(opt)}</div>
          </div>
        ))}
      </div>
    </Modal>
  );
}
