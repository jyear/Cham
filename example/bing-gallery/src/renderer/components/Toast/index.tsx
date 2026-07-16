import React from 'react';
import './index.module.css';

interface ToastProps {
  message: string;
  visible: boolean;
}

export function Toast({ message, visible }: ToastProps) {
  if (!visible) return null;
  return <div className="bing-toast">{message}</div>;
}
