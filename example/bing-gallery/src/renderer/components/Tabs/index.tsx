import React from 'react';
import type { TabType } from '../../types';
import './index.module.css';

interface TabsProps {
  activeTab: TabType;
  onChange: (tab: TabType) => void;
  t: Record<string, string>;
}

export function Tabs({ activeTab, onChange, t }: TabsProps) {
  return (
    <div className="bing-tabs">
      <button
        className={`bing-tab ${activeTab === 'daily' ? 'bing-tab-active' : ''}`}
        onClick={() => onChange('daily')}
      >
        {t.daily}
      </button>
      <button
        className={`bing-tab ${activeTab === 'favorites' ? 'bing-tab-active' : ''}`}
        onClick={() => onChange('favorites')}
      >
        {t.favorites}
      </button>
    </div>
  );
}
