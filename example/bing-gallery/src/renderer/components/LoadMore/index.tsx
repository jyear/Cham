import React from 'react';
import './index.module.css';

interface LoadMoreProps {
  loading: boolean;
  onLoadMore: () => void;
  t: Record<string, string>;
}

export function LoadMore({ loading, onLoadMore, t }: LoadMoreProps) {
  return (
    <div className="bing-load-more">
      <button className="bing-btn bing-btn-primary" onClick={onLoadMore} disabled={loading}>
        {loading ? t.loading : t.loadMore}
      </button>
    </div>
  );
}
