import React, { useState, useCallback } from "react";
import { useT, type Lang } from "@/i18n";
import { useTheme, type Theme } from "@/i18n/useTheme";
import Select from "@/components/Select";
import Toast from "@/components/Toast";

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
  const [toast, setToast] = useState({ visible: false, message: "" });

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
    const result = await window.cham.clearCache();
    if (result.success) {
      showToast(t.cacheCleared);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <label
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          fontSize: 12,
        }}
      >
        <span>{t.language}:</span>
        <Select
          options={[
            { value: "zh", label: "中文" },
            { value: "en", label: "English" },
          ]}
          value={lang}
          onChange={(v) => handleLang(v as Lang)}
        />
      </label>

      <label
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          fontSize: 12,
        }}
      >
        <span>{t.theme}:</span>
        <Select
          options={[
            { value: "dark", label: "Dark" },
            { value: "light", label: "Light" },
          ]}
          value={theme}
          onChange={(v) => handleTheme(v as Theme)}
        />
      </label>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <span style={{ fontSize: 13, color: "var(--text)" }}>
          {t.clearCache}
        </span>
        <button onClick={handleClearCache} style={btnSmall}>
          {t.clearCache}
        </button>
      </div>

      <Toast
        message={toast.message}
        visible={toast.visible}
        onClose={() => setToast({ visible: false, message: "" })}
      />
    </div>
  );
}
