import React from 'react';
import './index.module.css';

interface EmptyStateProps {
  message?: string;
}

export function EmptyState({ message }: EmptyStateProps) {
  return (
    <div className="bing-empty">
      <svg width={48} height={48} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <rect x={3} y={3} width={18} height={18} rx={3} />
        <circle cx={8.5} cy={8.5} r={1.5} fill="currentColor" />
        <path d="M3 16l5-5 4 4 3-3 6 6" />
      </svg>
      <p>{message}</p>
    </div>
  );
}
