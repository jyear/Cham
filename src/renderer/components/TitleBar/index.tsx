import React, { useState, useEffect } from 'react';
import { useT } from '@/i18n';
import Icon from '@/components/Icon';
import Modal from '@/components/Modal';
import Settings from '@/pages/Settings';
import s from './index.module.css';

interface Props {
  maximized: boolean;
}

interface ChangelogEntry {
  version: string;
  notes: string;
  timestamp?: number;
}

interface UpdateStatus {
  checking: boolean;
  updateAvailable: boolean;
  currentVersion: string;
  latestVersion?: string;
  latestNotes?: string;
  downloadUrl?: string;
  changelog: ChangelogEntry[];
  downloading: boolean;
  progress: number;
  error?: string;
}

export default function TitleBar({ maximized }: Props) {
  const { t } = useT();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [updateOpen, setUpdateOpen] = useState(false);
  const [version, setVersion] = useState('');
  const [updateMsg, setUpdateMsg] = useState('');
  const [checking, setChecking] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadDone, setDownloadDone] = useState(false);

  useEffect(() => {
    window.cham?.getAppVersion().then(setVersion);
    // Check if an update was already detected before this component mounted
    window.cham?.getUpdateStatus().then((status: UpdateStatus) => {
      if (status.updateAvailable) {
        setUpdateStatus(status);
      }
    });
  }, []);

  // Listen for silent update check on startup
  useEffect(() => {
    const unsub = window.cham?.onUpdateAvailable((status: UpdateStatus) => {
      setUpdateStatus(status);
    });
    return () => { if (unsub) unsub(); };
  }, []);

  // Listen for download progress
  useEffect(() => {
    const unsub = window.cham?.onUpdateProgress((data: { progress: number; done?: boolean }) => {
      setDownloadProgress(data.progress);
      if (data.done) {
        setDownloading(false);
        setDownloadDone(true);
      }
    });
    return () => { if (unsub) unsub(); };
  }, []);

  const handleCheckUpdate = async () => {
    if (!window.cham) return;
    setChecking(true);
    setUpdateMsg('');
    try {
      const status = await window.cham.checkUpdate();
      if (status.updateAvailable) {
        setUpdateStatus(status);
        setAboutOpen(false);
        setUpdateOpen(true);
      } else if (status.error) {
        setUpdateMsg(t.updateError(status.error));
      } else {
        setUpdateMsg(t.updateUpToDate(status.currentVersion));
      }
    } finally {
      setChecking(false);
    }
  };

  const handleDownload = async () => {
    if (!window.cham) return;
    setDownloading(true);
    setDownloadProgress(0);
    setDownloadDone(false);
    setUpdateMsg('');
    try {
      const result = await window.cham.downloadUpdate();
      if (!result.success) {
        setUpdateMsg(t.updateError(result.error || ''));
        setDownloading(false);
      }
    } catch {
      setUpdateMsg(t.updateError('Download failed'));
      setDownloading(false);
    }
  };

  const handleInstall = async () => {
    if (!window.cham) return;
    await window.cham.installUpdate();
  };

  const handleMinimize = () => window.cham?.windowMinimize();
  const handleMaximize = () => window.cham?.windowMaximize();
  const handleClose = () => window.cham?.windowClose();

  const hasUpdate = updateStatus?.updateAvailable;

  return (
    <>
      <div className={s.bar}>
        <div className={s.drag}>
          <span className={s.icon}>⧉</span>
          <span className={s.appTitle}>Cham</span>
        </div>
        <div className={s.controls}>
          {hasUpdate && (
            <button
              className={`${s.ctrlBtn} ${s.updateBadge}`}
              onClick={() => setUpdateOpen(true)}
              title={t.updateAvailable(updateStatus!.latestVersion!)}
            >
              <Icon type="bell" size={14} />
              <span className={s.updateBadgeText}>
                {t.updateAvailableBanner}
              </span>
            </button>
          )}
          <button className={s.ctrlBtn} onClick={() => setAboutOpen(true)} title={t.checkUpdate}>
            <Icon type="info" size={14} />
          </button>
          <button className={s.ctrlBtn} onClick={() => setSettingsOpen(true)} title={t.settings}>
            <Icon type="settings" size={14} />
          </button>
          <button className={s.ctrlBtn} onClick={handleMinimize} title={t.minimize}>
            <Icon type="minimize" size={12} />
          </button>
          <button className={s.ctrlBtn} onClick={handleMaximize} title={maximized ? t.restore : t.maximize}>
            <Icon type={maximized ? 'restore' : 'maximize'} size={12} />
          </button>
          <button className={`${s.ctrlBtn} ${s.ctrlBtnClose}`} onClick={handleClose} title={t.close}>
            <Icon type="close" size={12} />
          </button>
        </div>
      </div>

      <Modal open={settingsOpen} title={t.settingsTitle} onClose={() => setSettingsOpen(false)}>
        <Settings />
      </Modal>

      {/* About modal — opened by info icon */}
      <Modal
        open={aboutOpen}
        title={t.aboutTitle}
        onClose={() => { setAboutOpen(false); setUpdateMsg(''); }}
      >
        <div className={s.updateBody}>
          <div className={s.aboutVersionRow}>
            <span className={s.aboutVersionLabel}>{t.currentVersion(version)}</span>
            <button className={s.aboutCheckBtn} onClick={handleCheckUpdate} disabled={checking}>
              {checking ? (
                <Icon type="loading" size={14} className={s.spinIcon} />
              ) : (
                t.checkUpdate
              )}
            </button>
          </div>
          {updateMsg && (
            <span className={s.updateMsg}>{updateMsg}</span>
          )}
        </div>
      </Modal>

      {/* Update modal — opened by bell icon or auto-opened when update found */}
      <Modal
        open={updateOpen}
        title={t.updateAvailableBanner}
        onClose={() => { setUpdateOpen(false); setUpdateMsg(''); }}
      >
        <div className={s.updateBody}>
          {updateStatus && (
            <>
              {/* Changelog */}
              {updateStatus.changelog.length > 0 && (
                <div className={s.changelogSection}>
                  <h3 className={s.changelogTitle}>{t.updateChangelog}</h3>
                  <div className={s.changelogList}>
                    {updateStatus.changelog.map((entry, i) => (
                      <div key={i} className={s.changelogEntry}>
                        <span className={s.changelogVersion}>v {entry.version}</span>
                        <span className={s.changelogNotes}>{entry.notes}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Single note fallback */}
              {updateStatus.changelog.length === 0 && updateStatus.latestNotes && (
                <p className={s.updateNote}>{updateStatus.latestNotes}</p>
              )}

              {/* Download progress */}
              {downloading && (
                <div className={s.progressSection}>
                  <div className={s.progressBar}>
                    <div
                      className={s.progressFill}
                      style={{ width: `${downloadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Buttons */}
              {!downloading && (
                downloadDone ? (
                  <button className={s.actionBtn} onClick={handleInstall}>
                    {t.updateInstallNow}
                  </button>
                ) : (
                  <button className={s.actionBtn} onClick={handleDownload}>
                    {t.updateDownloadNow}
                  </button>
                )
              )}
            </>
          )}
          {updateMsg && (
            <span className={s.updateMsg}>{updateMsg}</span>
          )}
        </div>
      </Modal>
    </>
  );
}
