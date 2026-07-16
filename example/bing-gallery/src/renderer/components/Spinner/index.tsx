import React from 'react';
import './index.module.css';

interface SpinnerProps {
  message?: string;
}

export function Spinner({ message }: SpinnerProps) {
  return (
    <div className="bing-loading">
      <div className="bing-spinner" />
      {message && <span>{message}</span>}
    </div>
  );
}
