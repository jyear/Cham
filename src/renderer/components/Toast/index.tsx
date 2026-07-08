import React, { useEffect, useState } from 'react';
import s from './index.module.css';

interface Props {
  message: string;
  visible: boolean;
  duration?: number;
  onClose: () => void;
}

export default function Toast({ message, visible, duration = 2000, onClose }: Props) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!visible) {
      setShow(false);
      return;
    }
    setShow(true);
    const timer = setTimeout(() => {
      setShow(false);
      setTimeout(onClose, 200); // wait for fade-out
    }, duration);
    return () => clearTimeout(timer);
  }, [visible, duration, onClose]);

  if (!visible && !show) return null;

  return (
    <div className={`${s.toast} ${show ? s.enter : s.leave}`}>{message}</div>
  );
}
