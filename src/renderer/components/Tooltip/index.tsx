import React, { type ReactNode } from 'react';
import s from './index.module.css';

interface Props {
  text: string;
  children: ReactNode;
}

export default function Tooltip({ text, children }: Props) {
  return (
    <div className={s.wrapper}>
      {children}
      <span className={s.tip}>{text}</span>
    </div>
  );
}
