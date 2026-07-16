import React, { useState, useEffect } from "react";
import type { DownloadRecord } from "../../types";
import "./index.module.css";

interface DownloadRecordsProps {
  records: DownloadRecord[];
  loading: boolean;
  t: Record<string, string>;
  onDelete: (record: DownloadRecord) => void;
  onViewImage: (record: DownloadRecord) => void;
}

/** Loads a local file as a data URL via plugin IPC, falls back to placeholder on error */
function RecordThumb({ filePath }: { filePath: string }) {
  const [src, setSrc] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setSrc("");
    setFailed(false);

    if (!window.cham) {
      setFailed(true);
      return;
    }

    window.cham.plugin.call("bing-gallery", "read-local-image", { filePath })
      .then((result) => {
        if (cancelled) return;
        if (result && result.success && result.dataUrl) {
          setSrc(result.dataUrl);
        } else {
          setFailed(true);
        }
      }).catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => { cancelled = true; };
  }, [filePath]);

  if (failed || !src) {
    return (
      <div className="bing-downloads-thumb-placeholder">
        <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
          <rect x={3} y={3} width={18} height={18} rx={2} ry={2} />
          <circle cx={8.5} cy={8.5} r={1.5} />
          <polyline points="21 15 16 10 5 21" />
        </svg>
      </div>
    );
  }

  return <img className="bing-downloads-thumb" src={src} alt="" />;
}

export function DownloadRecords({ records, loading, t, onDelete, onViewImage }: DownloadRecordsProps) {
  if (loading) {
    return (
      <div className="bing-downloads-loading">
        <div className="bing-spinner-sm" />
      </div>
    );
  }

  if (records.length === 0) {
    return <div className="bing-downloads-empty">{t.noDownloads}</div>;
  }

  function handleOpenFolder(localPath: string) {
    if (!window.cham) return;
    window.cham.plugin.call("bing-gallery", "open-folder", { filePath: localPath });
  }

  function formatTime(dateStr: string): string {
    if (!dateStr) return "";
    try {
      const d = new Date(dateStr + "Z");
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleString();
    } catch {
      return dateStr;
    }
  }

  return (
    <div className="bing-downloads-list">
      {/* Header */}
      <div className="bing-downloads-header">
        <span className="bing-downloads-col-thumb" />
        <span className="bing-downloads-col-name">{t.title || "Name"}</span>
        <span className="bing-downloads-col-path">{t.localPath}</span>
        <span className="bing-downloads-col-time">{t.downloadedAt}</span>
        <span className="bing-downloads-col-actions" />
      </div>

      {/* Rows */}
      {records.map((record) => (
        <div key={record.id} className="bing-downloads-row">
          <span
            className="bing-downloads-col-thumb bing-downloads-col-thumb-clickable"
            onClick={() => onViewImage(record)}
          >
            <RecordThumb filePath={record.localPath} />
          </span>
          <span className="bing-downloads-col-name" title={record.title}>
            {record.title || record.fileName}
          </span>
          <span className="bing-downloads-col-path" title={record.localPath}>
            {record.localPath}
          </span>
          <span className="bing-downloads-col-time">
            {formatTime(record.downloadedAt)}
          </span>
          <span className="bing-downloads-col-actions">
            <button
              className="bing-btn-icon"
              onClick={() => handleOpenFolder(record.localPath)}
              title={t.openFolder}
            >
              <svg
                width={15}
                height={15}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
            </button>
            <button
              className="bing-btn-icon bing-btn-icon-delete"
              onClick={() => onDelete(record)}
              title={t.deleteRecord}
            >
              <svg
                width={15}
                height={15}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
              >
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </button>
          </span>
        </div>
      ))}
    </div>
  );
}
