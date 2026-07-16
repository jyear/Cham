import React from 'react';
import type { BingImage, FavoriteImage } from '../../types';
import './index.module.css';

interface ImageViewerProps {
  image: BingImage | FavoriteImage | null;
  onClose: () => void;
  onDownload: (img: BingImage | FavoriteImage) => void;
  onSetBackground: (img: BingImage | FavoriteImage) => void;
  t: Record<string, string>;
}

export function ImageViewer({ image, onClose, onDownload, onSetBackground, t }: ImageViewerProps) {
  if (!image) return null;

  const imgUrl = 'fullUrl' in image ? (image as BingImage).fullUrl : image.url;
  const copyrightText = image.copyright || '';
  const match = copyrightText.match(/^(.+?)\s*\(©/);
  const displayTitle = match ? match[1] : copyrightText;

  return (
    <div className="bing-viewer" onClick={onClose}>
      <div className="bing-viewer-content" onClick={(e) => e.stopPropagation()}>
        <button className="bing-viewer-close" onClick={onClose}>
          ×
        </button>
        <img src={imgUrl} alt={displayTitle} />
        <div className="bing-viewer-info">
          <div className="bing-viewer-title">{displayTitle || 'Bing Wallpaper'}</div>
          {copyrightText && <div className="bing-viewer-copyright">© {copyrightText}</div>}
          <div className="bing-viewer-actions">
            <button className="bing-btn bing-btn-primary" onClick={() => onDownload(image)}>
              {t.download}
            </button>
            <button className="bing-btn bing-btn-secondary" onClick={() => onSetBackground(image)}>
              {t.setAsBackground}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
