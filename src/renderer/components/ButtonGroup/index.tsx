import React from 'react';
import s from './index.module.css';

interface Option<T extends string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  options: Option<T>[];
  value: T;
  onChange: (v: T) => void;
}

export default function ButtonGroup<T extends string>({ options, value, onChange }: Props<T>) {
  return (
    <div className={s.group}>
      {options.map((opt) => (
        <button
          key={opt.value}
          className={`${s.btn} ${opt.value === value ? s.active : ''}`}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
