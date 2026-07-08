# Cham - Desktop Image Converter

## Rules

### i18n Required
All user-facing text must use the i18n system. Never hardcode strings in components.

- Add new keys to both `src/renderer/i18n/en.ts` and `src/renderer/i18n/zh.ts`
- Use `const { t } = useT()` in components
- Use `t.keyName` for all display text
- If a text is visible to the user, it must have a translation key

### Project Structure
- `src/main/` — Electron main process
- `src/renderer/` — React renderer
  - `components/` — Reusable UI components (each in its own folder with `index.tsx` + `index.module.css`)
  - `pages/` — Page components (same folder structure)
  - `i18n/` — Internationalization (en.ts, zh.ts, index.tsx)
  - `styles/global.css` — CSS variables, reset, shared styles
- Use `@/` path alias for imports

### Tech Stack
- Electron + React + TypeScript
- sharp for image processing (WebP/AVIF)
- better-sqlite3 for persistence
- CSS Modules for styling
