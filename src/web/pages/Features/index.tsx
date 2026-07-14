import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useT } from '../../i18n';
import LangSwitcher from '../../components/LangSwitcher';
import {
  fetchAllVersions,
  ResolvedVersion,
  PLATFORM_LABELS,
  PLATFORM_ICONS,
  downloadUrl,
} from '../../data/version';
import appIcon from '../../../../assets/icons/icon.png';
import './index.css';

function formatDate(ts: number): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function Features() {
  const { t } = useT();
  const [versions, setVersions] = useState<ResolvedVersion[]>([]);

  useEffect(() => {
    fetchAllVersions().then(setVersions);
  }, []);

  return (
    <div className="page">
      {/* Nav */}
      <nav className="nav">
        <div className="container">
          <div className="nav-inner">
            <Link to="/" className="logo">
              <img className="logo-icon" src={appIcon} alt="Cham" />
              <span className="logo-text">Cham</span>
            </Link>
            <div className="nav-links">
              <Link to="/features" className="nav-active">{t.changelog}</Link>
              <LangSwitcher />
            </div>
          </div>
        </div>
      </nav>

      {/* Content */}
      <section className="features-page">
        <div className="container">
          <h1 className="features-title">{t.changelogTitle}</h1>
          <p className="features-subtitle">{t.changelogSubtitle}</p>

          {versions.length === 0 && (
            <p className="features-empty">{t.loading}</p>
          )}

          <div className="version-list">
            {versions.map((v) => (
              <div key={v.version} className="version-card">
                <div className="version-header">
                  <span className="version-tag">{v.version}</span>
                  <span className="version-date">{formatDate(v.timestamp)}</span>
                </div>
                <p className="version-notes">{v.notes}</p>
                <div className="version-downloads">
                  {Object.entries(v.platforms).map(([key, files]) =>
                    files.map((f) => (
                      <a
                        key={key + f.ext}
                        href={downloadUrl(v.version, f.name)}
                        className="version-dl-btn"
                      >
                        <span className="version-dl-platform">
                          {PLATFORM_ICONS[key] || ''} {PLATFORM_LABELS[key] || key}
                        </span>
                        <span className="version-dl-ext">{f.label}</span>
                        <span className="download-arrow">↓</span>
                      </a>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="container">
          <div className="footer-inner">
            <div className="footer-brand">
              <img className="logo-icon" src={appIcon} alt="Cham" />
              <span>Cham</span>
            </div>
            <p className="footer-copy">{t.footer}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
