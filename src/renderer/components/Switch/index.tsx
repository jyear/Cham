import React from 'react';
import s from './index.module.css';

interface Props {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}

export default function Switch({ checked, onChange, disabled }: Props) {
  return (
    <label className={`${s.toggle} ${disabled ? s.disabled : ''}`}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className={s.slider} />
    </label>
  );
}
