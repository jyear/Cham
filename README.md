# Cham

A free, open-source desktop image converter. Batch convert images to **WebP** and **AVIF** with blazing speed — all offline, all local.

## Features

- ⚡ **Blazing Fast** — Powered by [sharp](https://github.com/lovell/sharp) (libvips), converts at native C speed
- 🖼️ **WebP & AVIF** — Convert PNG, JPG, GIF, TIFF, BMP to next-gen formats. Save up to 80% file size
- 📦 **Batch Processing** — Drag & drop folders, convert everything in one click
- 👁️ **Watch Mode** — Auto-convert on file change
- 🎨 **Fine Control** — Adjust quality, lossless/lossy, effort level, and more
- 🔒 **100% Offline** — No uploads, no cloud, no telemetry

## Tech Stack

- **Electron** — Cross-platform desktop app (Windows / macOS / Linux)
- **React + TypeScript** — Renderer UI
- **sharp** (libvips) — High-performance image processing
- **better-sqlite3** — Local persistence
- **CSS Modules** — Scoped styling

## Development

```bash
# Install dependencies
pnpm install

# Run in development mode
pnpm dev

# Run the landing page only
pnpm dev:web

# Build
pnpm build

# Package desktop app
pnpm dist
```

## License

MIT
