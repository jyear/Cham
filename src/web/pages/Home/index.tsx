import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useT } from '../../i18n';
import LangSwitcher from '../../components/LangSwitcher';
import {
  fetchVersion,
  ResolvedVersion,
  PLATFORM_LABELS,
  PLATFORM_ICONS,
  downloadUrl,
} from '../../data/version';
import appIcon from '../../../../assets/icon.png';
import './index.css';

const FALLBACK_VERSION = '0.0.1';

/** Detect current OS and map to platform key ("win" | "mac" | "linux") */
function detectPlatform(): string | null {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('win')) return 'win';
  if (ua.includes('mac')) return 'mac';
  if (ua.includes('linux')) return 'linux';
  return null;
}

export default function Home() {
  const { t } = useT();
  const [versionData, setVersionData] = useState<ResolvedVersion | null>(null);
  const [activePlatform, setActivePlatform] = useState('win');
  const [noDownload, setNoDownload] = useState(false);

  useEffect(() => {
    fetchVersion().then(setVersionData);
  }, []);

  const currentVersion = versionData?.version || FALLBACK_VERSION;
  const platforms = versionData?.platforms || {};
  const platformKeys = Object.keys(platforms);
  const userPlatform = detectPlatform();

  const handleDownload = useCallback(() => {
    if (!userPlatform || !platforms[userPlatform]?.length) {
      setNoDownload(true);
      const el = document.getElementById('download');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    const file = platforms[userPlatform][0];
    window.location.href = downloadUrl(currentVersion, file.name);
  }, [userPlatform, platforms, currentVersion]);

  const FEATURES = [
    { icon: '⚡', title: t.feat1Title, desc: t.feat1Desc },
    { icon: '🖼️', title: t.feat2Title, desc: t.feat2Desc },
    { icon: '📦', title: t.feat3Title, desc: t.feat3Desc },
    { icon: '👁️', title: t.feat4Title, desc: t.feat4Desc },
    { icon: '🔒', title: t.feat5Title, desc: t.feat5Desc },
    { icon: '🎨', title: t.feat6Title, desc: t.feat6Desc },
  ];

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
              <Link to="/features">{t.changelog}</Link>
              <LangSwitcher />
            </div>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="hero">
        <div className="container">
          <div className="hero-content">
            <div className="hero-badge">
              <span className="badge-dot" />
              {t.heroBadge(currentVersion)}
            </div>
            <h1 className="hero-title">
              {t.heroTitle1}<span className="gradient">{t.heroTitle2}</span>{t.heroTitle3}
            </h1>
            <p className="hero-desc">{t.heroDesc}</p>
            <div className="hero-actions">
              <button className="btn-primary" onClick={handleDownload}>
                {t.downloadFree}
              </button>
              {noDownload && (
                <p className="hero-no-download">
                  {userPlatform ? t.noDownloadCurrent : t.noDownloadUnknown}
                </p>
              )}
            </div>
          </div>
          <div className="hero-visual">
            <div className="hero-mockup">
              <div className="mockup-bar">
                <span className="mockup-dot" />
                <span className="mockup-dot" />
                <span className="mockup-dot" />
              </div>
              <div className="mockup-body">
                <div className="mockup-left">
                  <div className="mockup-block" />
                  <div className="mockup-block short" />
                </div>
                <div className="mockup-center">
                  <div className="mockup-slider" />
                  <div className="mockup-toggle" />
                  <div className="mockup-btn" />
                </div>
                <div className="mockup-right">
                  <div className="mockup-row" />
                  <div className="mockup-row" />
                  <div className="mockup-row" />
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="hero-glow" />
      </section>

      {/* Features */}
      <section id="features" className="features">
        <div className="container">
          <h2 className="section-title">
            {t.featuresTitle1}<span className="gradient">{t.featuresTitle2}</span>{t.featuresTitle3}
          </h2>
          <p className="section-desc">{t.featuresDesc}</p>
          <div className="feature-grid">
            {FEATURES.map((f) => (
              <div key={f.title} className="feature-card">
                <span className="feature-icon">{f.icon}</span>
                <h3 className="feature-title">{f.title}</h3>
                <p className="feature-desc">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Download */}
      <section id="download" className="download">
        <div className="container">
          <h2 className="section-title">{t.downloadTitle}</h2>
          <p className="section-desc">{t.downloadDesc}</p>

          <div className="download-card">
            <div className="platform-tabs">
              {platformKeys.map((key) => (
                <button
                  key={key}
                  className={`platform-tab ${activePlatform === key ? 'active' : ''}`}
                  onClick={() => setActivePlatform(key)}
                >
                  <span className="platform-icon">{PLATFORM_ICONS[key] || ''}</span>
                  {PLATFORM_LABELS[key] || key}
                </button>
              ))}
            </div>
            <div className="download-list">
              {(platforms[activePlatform] || []).map((f) => (
                <a
                  key={f.ext}
                  href={downloadUrl(currentVersion, f.name)}
                  className="download-btn"
                >
                  <span className="download-label">
                    {PLATFORM_LABELS[activePlatform] || activePlatform}
                  </span>
                  <span className="download-ext">{f.label}</span>
                  <span className="download-arrow">↓</span>
                </a>
              ))}
            </div>
            <p className="download-hint">
              {t.githubReleases}{' '}
              <a href="https://github.com" target="_blank" rel="noopener noreferrer">{t.githubReleasesLink}</a>
            </p>
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
