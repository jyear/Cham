import React, { useState, useEffect } from 'react';
import './index.module.css';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  t: Record<string, string>;
}

export function SettingsModal({ open, onClose, t }: SettingsModalProps) {
  const [downloadPath, setDownloadPath] = useState('');
  const [selecting, setSelecting] = useState(false);

  useEffect(() => {
    if (!open || !window.cham) return;
    window.cham.plugin.call('bing-gallery', 'get-settings').then((result: any) => {
      if (result?.success && result.settings) {
        setDownloadPath(result.settings.download_path || '');
      }
    });
  }, [open]);

  if (!open) return null;

  const savePath = async (path: string) => {
    if (!window.cham) return;
    await window.cham.plugin.call('bing-gallery', 'save-setting', {
      key: 'download_path',
      value: path,
    });
  };

  const handleSelectFolder = async () => {
    if (!window.cham || selecting) return;
    setSelecting(true);
    try {
      const result = await window.cham.plugin.call('bing-gallery', 'select-folder');
      if (result?.success && result.path) {
        setDownloadPath(result.path);
        await savePath(result.path);
      }
    } catch {
      // user cancelled or error
    } finally {
      setSelecting(false);
    }
  };

  return (
    <div className="bing-modal-overlay" onClick={onClose}>
      <div className="bing-modal" onClick={(e) => e.stopPropagation()}>
        <div className="bing-modal-header">
          <h3 className="bing-modal-title">{t.settings}</h3>
          <button className="bing-modal-close" onClick={onClose}>×</button>
        </div>
        <div className="bing-modal-body">
          {/* Download path — left/right layout */}
          <div className="bing-setting-row-lr">
            <div className="bing-setting-left">
              <span className="bing-setting-label">{t.downloadPath}</span>
            </div>
            <div className="bing-setting-right">
              <span className="bing-setting-value">
                {downloadPath || <em className="bing-setting-placeholder">{t.notSet}</em>}
              </span>
              <button
                className="bing-btn bing-btn-secondary"
                onClick={handleSelectFolder}
                disabled={selecting}
              >
                {selecting ? '...' : t.selectFolder}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
