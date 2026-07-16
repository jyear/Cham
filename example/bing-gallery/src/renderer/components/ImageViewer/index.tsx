import React, { useState, useEffect } from 'react';
import type { BingImage, FavoriteImage, DownloadRecord, ViewableImage } from '../../types';
import './index.module.css';

interface ImageViewerProps {
  image: ViewableImage | null;
  onClose: () => void;
  onDownload: (img: BingImage | FavoriteImage) => void;
  onSetAppBackground: (img: BingImage | FavoriteImage) => void;
  onSetDesktopBackground: (img: BingImage | FavoriteImage) => void;
  onSetAppBackgroundFromPath: (filePath: string) => void;
  onSetDesktopBackgroundFromPath: (filePath: string) => void;
  t: Record<string, string>;
}

function isDownloadRecord(img: ViewableImage): img is DownloadRecord {
  return 'localPath' in img && 'imageUrl' in img && !('time' in img || 'createdAt' in img);
}

export function ImageViewer({ image, onClose, onDownload, onSetAppBackground, onSetDesktopBackground, onSetAppBackgroundFromPath, onSetDesktopBackgroundFromPath, t }: ImageViewerProps) {
  const [localSrc, setLocalSrc] = useState('');

  useEffect(() => {
    if (!image || !isDownloadRecord(image)) {
      setLocalSrc('');
      return;
    }

    let cancelled = false;
    if (window.cham) {
      window.cham.plugin.call('bing-gallery', 'read-local-image', { filePath: image.localPath })
        .then((result) => {
          if (!cancelled && result?.success && result.dataUrl) {
            setLocalSrc(result.dataUrl);
          }
        })
        .catch(() => {});
    }
    return () => { cancelled = true; };
  }, [image]);

  if (!image) return null;

  const isLocal = isDownloadRecord(image);
  const imgUrl = isLocal
    ? (localSrc || (image as DownloadRecord).imageUrl)
    : ('fullUrl' in image ? (image as BingImage).fullUrl : image.url);

  const copyrightText = isLocal
    ? (image as DownloadRecord).copyright || ''
    : image.copyright || '';
  const displayTitle = isLocal
    ? ((image as DownloadRecord).title || (image as DownloadRecord).fileName || '')
    : (image.title || 'Bing Wallpaper');

  const match = copyrightText.match(/^(.+?)\s*\(©/);
  const displayCopyright = match ? match[1] : copyrightText;

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
            {!isLocal && (
              <button className="bing-btn bing-btn-primary" onClick={() => onDownload(image as BingImage | FavoriteImage)}>
                {t.download}
              </button>
            )}
            <button
              className="bing-btn bing-btn-secondary"
              onClick={() => {
                if (isLocal) {
                  onSetAppBackgroundFromPath((image as DownloadRecord).localPath);
                } else {
                  onSetAppBackground(image as BingImage | FavoriteImage);
                }
              }}
            >
              {t.setAsAppBackground}
            </button>
            <button
              className="bing-btn bing-btn-secondary"
              onClick={() => {
                if (isLocal) {
                  onSetDesktopBackgroundFromPath((image as DownloadRecord).localPath);
                } else {
                  onSetDesktopBackground(image as BingImage | FavoriteImage);
                }
              }}
            >
              {t.setAsDesktopBackground}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
