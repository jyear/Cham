import React, { useState, useCallback, useRef, useEffect } from "react";
import { useT, type Lang } from "@/i18n";
import { useTheme, type Theme } from "@/i18n/useTheme";
import { useBackground } from "@/hooks/useBackground";
import Select from "@/components/Select";
import Switch from "@/components/Switch";
import Icon from "@/components/Icon";
import Toast from "@/components/Toast";
import s from "./index.module.css";

export const ApplicationName = 'settingsTitle';
export const ApplicationIcon = 'settings';
export const ApplicationColor = 'linear-gradient(135deg, #6c8ee0 0%, #4a6db5 100%)';
export const ApplicationDesc = '';
export const ApplicationUnResize = true;
export const ApplicationRoute = '/settings';
export const ApplicationMinWidth = 600;
export const ApplicationMinHeight = 400;

type NavKey = "basic" | "appearance";

interface NavItem {
  key: NavKey;
  icon: "settings" | "wrench";
  label: string;
}

const btnSmall = {
  padding: "5px 12px",
  borderRadius: 5,
  background: "var(--primary)",
  color: "#fff",
  border: "none",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
  whiteSpace: "nowrap",
} as const;

export default function Settings() {
  const { t, lang, setLang } = useT();
  const { theme, setTheme } = useTheme();
  const {
    items,
    enabled,
    setEnabled,
    selectBackground,
    setActiveBackground,
    deleteBackground,
  } = useBackground();
  const [activeNav, setActiveNav] = useState<NavKey>("basic");
  const [toast, setToast] = useState({ visible: false, message: "" });

  // Refs for scroll-spy
  const basicRef = useRef<HTMLDivElement>(null);
  const appearanceRef = useRef<HTMLDivElement>(null);
  const scrollingByClick = useRef(false);

  const showToast = useCallback((message: string) => {
    setToast({ visible: true, message });
  }, []);

  const handleLang = (l: Lang) => {
    setLang(l);
    window.cham?.saveSettings({ language: l });
  };

  const handleTheme = (th: Theme) => {
    setTheme(th);
  };

  const handleClearCache = async () => {
    if (!window.cham) return;
    // Emit hook — each plugin's timing setting decides whether it fires
    const result = await window.cham.plugin.emitHook('cache:clear');
    if (result.success) {
      showToast(t.cacheCleared);
    }
  };

  const navItems: NavItem[] = [
    { key: "basic", icon: "settings", label: t.basicSettings },
    { key: "appearance", icon: "wrench", label: t.appearanceSettings },
  ];

  const sectionMap: Record<NavKey, React.RefObject<HTMLDivElement | null>> = {
    basic: basicRef,
    appearance: appearanceRef,
  };

  // Scroll to section on nav click
  const handleNavClick = (key: NavKey) => {
    scrollingByClick.current = true;
    sectionMap[key].current?.scrollIntoView({ behavior: "smooth" });
    setActiveNav(key);
    setTimeout(() => {
      scrollingByClick.current = false;
    }, 600);
  };

  // IntersectionObserver: auto-highlight nav based on visible section
  useEffect(() => {
    const sections = [basicRef.current, appearanceRef.current].filter(Boolean) as HTMLElement[];
    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (scrollingByClick.current) return;
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          const el = visible[0].target as HTMLElement;
          const key = el.dataset.section as NavKey;
          if (key) setActiveNav(key);
        }
      },
      { rootMargin: "-20% 0px -70% 0px" }
    );

    sections.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const clearCacheField = (
    <div className={s.field}>
      <span className={s.fieldLabel}>{t.clearCache}</span>
      <button onClick={handleClearCache} style={btnSmall}>
        {t.clearCache}
      </button>
    </div>
  );

  return (
    <div className={s.container}>
      {/* Left navigation */}
      <nav className={s.nav}>
        {navItems.map((item) => (
          <button
            key={item.key}
            className={`${s.navItem} ${activeNav === item.key ? s.navItemActive : ""}`}
            onClick={() => handleNavClick(item.key)}
          >
            <span className={s.navIcon}>
              <Icon type={item.icon} size={14} />
            </span>
            {item.label}
          </button>
        ))}
      </nav>

      {/* Right content */}
      <div className={s.content}>
        {/* Basic Settings */}
        <div ref={basicRef} data-section="basic">
          <div className={s.sectionTitle}>{t.basicSettings}</div>

          <div className={s.field}>
            <span className={s.fieldLabel}>{t.language}</span>
            <Select
              options={[
                { value: "zh", label: "中文" },
                { value: "en", label: "English" },
              ]}
              value={lang}
              onChange={(v) => handleLang(v as Lang)}
            />
          </div>

          {clearCacheField}
        </div>

        {/* Appearance Settings */}
        <div ref={appearanceRef} data-section="appearance" style={{ marginTop: 32 }}>
          <div className={s.sectionTitle}>{t.appearanceSettings}</div>

          <div className={s.field}>
            <span className={s.fieldLabel}>{t.theme}</span>
            <Select
              options={[
                { value: "dark", label: "Dark" },
                { value: "light", label: "Light" },
              ]}
              value={theme}
              onChange={(v) => handleTheme(v as Theme)}
            />
          </div>

          {/* Background gallery */}
          <div className={s.field}>
            <span className={s.fieldLabel}>{t.backgroundImage}</span>
            <Switch checked={enabled} onChange={setEnabled} />
          </div>

          <div className={s.bgGrid}>
            {items.map((item) => (
              <div
                key={item.id}
                className={`${s.bgThumb} ${item.selected ? s.bgThumbActive : ""}`}
                onClick={() => setActiveBackground(item.id)}
              >
                <img src={item.dataUrl} alt={item.filename} />
                <button
                  className={s.bgDelete}
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteBackground(item.id);
                  }}
                >
                  <Icon type="close" size={10} />
                </button>
                {item.selected && <span className={s.bgCheck}>✓</span>}
              </div>
            ))}
            <div className={s.bgAdd} onClick={selectBackground}>
              <span className={s.bgAddIcon}>+</span>
            </div>
            {items.length === 0 && (
              <div className={s.bgPlaceholder}>{t.noBackground}</div>
            )}
          </div>
        </div>
      </div>

      <Toast
        message={toast.message}
        visible={toast.visible}
        onClose={() => setToast({ visible: false, message: "" })}
      />
    </div>
  );
}
