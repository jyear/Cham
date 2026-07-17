# Cham

A free, open-source desktop image converter. Batch convert images to **WebP** and **AVIF** with blazing speed — all offline, all local.

## Features

- ⚡ **Blazing Fast** — Powered by [sharp](https://github.com/lovell/sharp) (libvips), converts at native C speed
- 🖼️ **WebP & AVIF** — Convert PNG, JPG, GIF, TIFF, BMP to next-gen formats. Save up to 80% file size
- 📦 **Batch Processing** — Drag & drop folders, convert everything in one click
- 👁️ **Watch Mode** — Auto-convert on file change
- 🎨 **Fine Control** — Adjust quality, lossless/lossy, effort level, and more
- 🔒 **100% Offline** — No uploads, no cloud, no telemetry
- 🧩 **Plugin System** — Extend with built-in and downloadable store plugins

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

---

## Plugin System

Cham supports three types of apps:

| Type | Load Method | Can Be Uninstalled | Examples |
|------|------------|-------------------|----------|
| **System** | Compiled at build time | No | Settings |
| **Built-in** | Compiled at build time, follows Plugin Manifest | No | Image Conversion |
| **Store** | Downloaded from OSS at runtime | Yes | (Future: Watermark, Compressor, etc.) |

### Architecture

```
┌─────────────────────────────────────────────────┐
│  Main Process                                    │
│  sharp / better-sqlite3 / fs / worker pool      │
│         │                                        │
│         │ IPC (contextBridge)                    │
│         ▼                                        │
│  window.cham.*  (existing APIs)                  │
│  window.cham.plugin.*  (plugin APIs)             │
│         │                                        │
│         ▼                                        │
│  Renderer Process (sandboxed)                    │
│  ┌─────────────┐  ┌───────────────────────────┐ │
│  │ Builtin Apps │  │ Store Apps (dynamic load) │ │
│  │ (bundled)    │  │ (imported at runtime)     │ │
│  └─────────────┘  └───────────────────────────┘ │
│                                                   │
│  PluginRegistry ←── unified discovery            │
│  WindowContext  ←── window management             │
│  FooterNav      ←── dock / launcher              │
└─────────────────────────────────────────────────┘
```

### Plugin Manifest Specification

Every plugin (built-in or store) defines a `PluginManifest`:

```typescript
interface PluginManifest {
  /* ── Identity ── */
  id: string;            // Unique identifier, e.g. "conversion", "watermark-tool"
  name: string;          // i18n key for the display name
  version: string;       // Semantic version, e.g. "1.0.0"

  /* ── Description ── */
  description?: string;  // i18n key for the description

  /* ── UI ── */
  icon: string;          // Icon type name (see components/Icon/index.tsx)
  color: string;         // CSS gradient or solid color for the app icon

  /* ── Window ── */
  minWidth?: number;     // Minimum window width (default: 600)
  minHeight?: number;    // Minimum window height (default: 400)
  unresizable?: boolean; // Disable window resize

  /* ── Category ── */
  category: 'builtin' | 'store';

  /* ── Capabilities (v1: documentation only) ── */
  permissions?: Array<'storage' | 'fs' | 'convert' | 'watch' | 'settings'>;

  /* ── Database Tables (optional) ── */
  dbTables?: Array<{
    tableName: string;   // Must start with "plugin_"
    columns: Array<{
      name: string;
      type: 'TEXT' | 'INTEGER' | 'REAL' | 'BLOB';
      constraints?: string; // e.g. "PRIMARY KEY", "NOT NULL DEFAULT 0"
    }>;
  }>;

  /* ── Entry Point ── */
  entry: string;         // Path to the main module
}
```

### Creating a Built-in Plugin

1. Create a directory under `src/renderer/plugins/builtin/<your-plugin>/`:

```
src/renderer/plugins/builtin/
  my-plugin/
    manifest.ts       # PluginManifest definition
    index.tsx          # React component (default export)
    index.module.css   # Styles (optional)
```

2. Write the manifest (`manifest.ts`):

```typescript
import type { PluginManifest } from '@shared/plugin/types';

const manifest: PluginManifest = {
  id: 'my-plugin',
  name: 'myPlugin',            // i18n key
  version: '1.0.0',
  description: 'myPluginDesc', // i18n key
  icon: 'image',
  color: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  minWidth: 800,
  minHeight: 500,
  category: 'builtin',
  permissions: ['fs', 'convert'],
  entry: './index.tsx',
};

export default manifest;
```

3. Write the component (`index.tsx`):

```tsx
import React from 'react';
import s from './index.module.css';

export default function MyPlugin() {
  return <div className={s.container}>Hello, plugin!</div>;
}
```

4. Register in `src/renderer/plugins/registry.ts`:

```typescript
import myPluginManifest from './builtin/my-plugin/manifest';
import MyPluginComponent from './builtin/my-plugin/index';

// Inside the PluginRegistry constructor:
this.registerBuiltin(myPluginManifest, MyPluginComponent);
```

5. Add i18n keys to `en.ts` and `zh.ts` for `myPlugin` and `myPluginDesc`.

### Plugin API (`window.cham.plugin`)

Store plugins run in the renderer sandbox (`contextIsolation: true`, `nodeIntegration: false`). They access native capabilities exclusively through the `window.cham` bridge.

#### Plugin Lifecycle

```typescript
// List all installed store plugins
const { plugins } = await window.cham.plugin.listInstalled();

// Install a plugin from a remote manifest URL
const { manifest } = await window.cham.plugin.install(
  'https://your-cdn.com/store/plugins/my-plugin/manifest.json'
);

// Uninstall a plugin
await window.cham.plugin.uninstall('my-plugin');

// Fetch a remote manifest (without installing)
const { manifest } = await window.cham.plugin.fetchManifest(
  'https://your-cdn.com/store/plugins/my-plugin/manifest.json'
);
```

#### Plugin Storage (Key-Value)

Each plugin has its own isolated key-value store backed by SQLite:

```typescript
// Write
await window.cham.plugin.setItem('my-plugin', 'userPreference', 'dark');

// Read
const { value } = await window.cham.plugin.getItem('my-plugin', 'userPreference');
// value === 'dark'

// List all keys for this plugin
const { items } = await window.cham.plugin.listItems('my-plugin');
// items === [{ key: 'userPreference', value: 'dark' }]

// Delete
await window.cham.plugin.removeItem('my-plugin', 'userPreference');
```

#### Database Tables

Plugins can declare custom database tables in their manifest. Tables are created automatically on install and dropped on uninstall:

```json
{
  "dbTables": [
    {
      "tableName": "plugin_mypreset_data",
      "columns": [
        { "name": "id", "type": "INTEGER", "constraints": "PRIMARY KEY AUTOINCREMENT" },
        { "name": "name", "type": "TEXT", "constraints": "NOT NULL" },
        { "name": "config", "type": "TEXT" }
      ]
    }
  ]
}
```

**Rules:**
- Table names MUST start with `plugin_`
- Tables are created in the app's main SQLite database
- Plugins cannot execute arbitrary SQL — table creation is handled by the main process

---

### Phase 2: Main Process Plugins (`manifest.main`)

Plugins that need Node.js native capabilities (sharp, SQLite, file I/O) can declare a `main` entry point in their manifest. The main process loads this module and injects a restricted API.

#### Architecture

```
Plugin Bundle (zip)
├── manifest.json          # PluginManifest (with "main": "main.js")
├── renderer.js            # React UI (renderer process, sandboxed)
└── main.js                # Node.js backend (main process, API-injected)
     │
     ▼
┌────────────────────────────────────────────────┐
│ Main Process                                    │
│ ┌────────────────────────────────────────────┐ │
│ │ PluginHost                                  │ │
│ │                                             │ │
│ │  const main = require('plugin/main.js');    │ │
│ │  const cleanup = main(api);  // inject API  │ │
│ │                                             │ │
│ │  api.registerHandler('doWork', handler);    │ │
│ │  api.sharp(input).webp().toFile();         │ │
│ │  api.db.prepare('SELECT * FROM ...');      │ │
│ │  api.native.fs.readFile('/absolute/path/conf.json'); │ │
│ └────────────────────────────────────────────┘ │
│              │                                  │
│   IPC: plugin:<id>:<channel>                   │
│              │                                  │
├──────────────┼──────────────────────────────────┤
│ Renderer      ▼                                  │
│ ┌────────────────────────────────────────────┐ │
│ │ plugin's renderer.js                        │ │
│ │                                             │ │
│ │  const result = await                      │ │
│ │    window.cham.plugin.call(                 │ │
│ │      'my-plugin', 'doWork', params          │ │
│ │    );                                       │ │
│ └────────────────────────────────────────────┘ │
└────────────────────────────────────────────────┘
```

#### Manifest (with `main`)

```json
{
  "id": "watermark-tool",
  "name": "watermarkTool",
  "version": "1.0.0",
  "icon": "image",
  "color": "linear-gradient(135deg, #00b4d8 0%, #0077b6 100%)",
  "minWidth": 800,
  "minHeight": 500,
  "category": "store",
  "permissions": ["fs", "convert", "storage"],
  "entry": "renderer.js",
  "main": "main.js",
  "dbTables": [
    {
      "tableName": "plugin_watermark_presets",
      "columns": [
        { "name": "id", "type": "INTEGER", "constraints": "PRIMARY KEY AUTOINCREMENT" },
        { "name": "name", "type": "TEXT", "constraints": "NOT NULL" },
        { "name": "position", "type": "TEXT" },
        { "name": "opacity", "type": "REAL", "constraints": "DEFAULT 0.5" }
      ]
    }
  ]
}
```

#### Writing `main.js` (Main Process Module)

```javascript
// Plugin main.js — runs in the main process with Node.js access
// The function receives the PluginMainApi and may return a cleanup function.

module.exports = function(api) {
  // ── Register IPC handlers ──
  // Channel is auto-namespaced: "plugin:watermark-tool:apply"
  api.registerHandler('apply', async (event, params) => {
    const { inputPath, watermarkPath, position, opacity } = params;

    // Use sharp directly (same instance as the host app)
    const watermark = await api.sharp(watermarkPath)
      .resize(200)
      .ensureAlpha(opacity)
      .toBuffer();

    const result = await api.sharp(inputPath)
      .composite([{ input: watermark, gravity: position || 'southeast' }])
      .webp({ quality: 90 })
      .toFile(api.pluginDir + '/output/watermarked.webp');

    // Save preset to the plugin's dedicated DB table
    api.db.prepare(
      'INSERT INTO plugin_watermark_presets (name, position, opacity) VALUES (?, ?, ?)'
    ).run(params.presetName, position, opacity);

    // Write result to output file (absolute path)
    api.native.fs.writeFile(outputPath, JSON.stringify({
      input: inputPath,
      output: result,
      timestamp: new Date().toISOString(),
    }));

    api.log.info(`Watermark applied: ${inputPath}`);

    return { success: true, outputPath: result };
  });

  // ── Read presets ──
  api.registerHandler('getPresets', async () => {
    const rows = api.db.prepare(
      'SELECT * FROM plugin_watermark_presets ORDER BY id DESC'
    ).all();
    return { success: true, presets: rows };
  });

  // ── Optional cleanup ──
  return () => {
    api.log.info('Plugin deactivated, temporary files cleaned');
    // Remove temp files
    if (api.native.fs.exists(api.native.path.join(api.pluginDir, 'temp'))) {
      api.native.fs.remove(api.native.path.join(api.pluginDir, 'temp'));
    }
  };
};
```

#### Writing `renderer.js` (Renderer — Calling Plugin IPC)

```javascript
// Plugin renderer.js — runs in the renderer process (browser sandbox)
// Uses window.cham.plugin.call() to invoke main.js handlers

var __chamPlugin = (function() {
  function WatermarkUI() {
    const [result, setResult] = React.useState(null);

    async function handleApply() {
      // Calls the custom IPC handler registered by main.js
      const res = await window.cham.plugin.call(
        'watermark-tool',    // plugin ID
        'apply',             // handler name
        {
          inputPath: '/path/to/photo.jpg',
          watermarkPath: '/path/to/logo.png',
          position: 'southeast',
          opacity: 0.5,
          presetName: 'My Preset',
        }
      );

      // Calls another handler
      const { presets } = await window.cham.plugin.call(
        'watermark-tool', 'getPresets'
      );

      setResult(res);
    }

    return React.createElement('button', { onClick: handleApply }, 'Apply Watermark');
  }

  return { default: WatermarkUI };
})();
```

#### PluginMainApi Reference

| Property | Description |
|----------|------------|
| `api.pluginId` | The plugin's unique ID (string, read-only) |
| `api.pluginDir` | Absolute path to the plugin's install directory |
| `api.appVersion` | Cham app version string |

| Method | Description |
|--------|------------|
| `api.registerHandler(channel, handler)` | Register a namespaced IPC handler. Channel becomes `plugin:<id>:<channel>` |
| `api.sharp` | Access to sharp for image processing (same instance as host app) |
| `api.db.prepare(sql).run/get/all(params)` | Execute SQL on plugin-declared tables and `plugin_store` |
| `api.db.exec(sql)` | Execute raw SQL (CREATE TABLE restricted to declared tables) |
| `api.native.fs.readFile(path)` | Read a text file from an absolute path |
| `api.native.fs.writeFile(path, data)` | Write a text file to an absolute path |
| `api.native.fs.readBuffer(path)` | Read a binary file from an absolute path |
| `api.native.fs.exists(path)` | Check if a file exists at an absolute path |
| `api.native.fs.mkdir(path)` | Create a directory at an absolute path |
| `api.native.fs.listDir(path)` | List files in a directory at an absolute path |
| `api.native.fs.remove(path)` | Delete a file or directory at an absolute path |
| `api.log.info/warn/error(msg)` | Logger with plugin ID prefix |

**Rules:**
- All `api.native.fs` paths must be absolute. Relative paths will throw an error.
- `api.db` table access is validated — only tables declared in `manifest.dbTables` + `plugin_store` are allowed.
- `api.registerHandler` channels are automatically prefixed with `plugin:<pluginId>:` to prevent collisions.

#### Sharing Dependencies (webpack externals)

To avoid bundling large libraries that Cham already provides, mark them as externals in the plugin's webpack config. Cham exposes shared libraries through `window.__chamShared`:

**webpack.config.js** (plugin developer's build tooling):

```javascript
module.exports = [
  // ── Renderer bundle (target: web) ──
  {
    target: 'web',
    entry: './src/renderer.js',
    output: { path: './dist', filename: 'renderer.js' },
    externals: {
      react: 'window.__chamShared.react',
      'react-dom': 'window.__chamShared.reactDom',
      'framer-motion': 'window.__chamShared.framerMotion',
    },
  },
  // ── Main process bundle (target: node) ──
  {
    target: 'node',
    entry: './src/main.js',
    output: { path: './dist', filename: 'main.js', libraryTarget: 'commonjs2' },
    externals: {
      sharp: 'sharp',  // Provided by Cham, don't bundle
    },
  },
];
```

#### What If My Plugin Needs a Package Cham Doesn't Have?

Three strategies, in order of preference:

| Strategy | When to Use | How |
|----------|------------|-----|
| **A. Use Cham's injected API** | 90% of cases | `api.sharp`, `api.db`, `api.native.fs` cover image processing, storage, file I/O |
| **B. Bundle pure-JS packages** | For utilities like `lodash`, `dayjs`, `pdf-lib` | `target: 'node'` webpack bundles them into `main.js` automatically |
| **C. Pre-compiled native `.node` files** | Rare, requires review | Ship platform-specific `.node` binaries; Cham validates ABI on install (future) |

**Strategy B** works for any npm package that does NOT contain native C++ code. These are bundled by webpack into the `main.js` file — no extra install step needed:

```javascript
// Plugin main.js — webpack bundles 'pdf-lib' into the output
const { PDFDocument } = require('pdf-lib');  // pure JS, no .node files

module.exports = function(api) {
  api.registerHandler('extractImages', async (event, params) => {
    const pdfDoc = await PDFDocument.load(params.buffer);
    // ...
  });
};
```

**Strategy C** is the VS Code / Obsidian approach for native modules. It requires:
- Plugin author pre-compiles for each platform (win32-x64, darwin-arm64, linux-x64)
- `.node` files shipped in the plugin zip
- Cham verifies the binary ABI matches the current Electron version

> **Note:** Strategy C is not yet enabled. If your plugin genuinely needs a native package Cham doesn't provide, the recommended path is to request it be added to Cham's core dependencies — this is safer and benefits all plugins.

### Common APIs (available to all plugins)

All plugins — whether or not they have a `main` entry — can use these `window.cham` APIs:

| API | Description |
|-----|------------|
| `cham.selectFiles()` | Open file picker |
| `cham.selectFolder()` | Open folder picker |
| `cham.selectOutputDir()` | Select output directory |
| `cham.getFileHash(path)` | Get SHA-256 hash of a file |
| `cham.readImage(path)` | Read image as data URL |
| `cham.loadSettings()` / `cham.saveSettings()` | App settings |
| `cham.clearCache()` | Clear cache (triggers `cache:clear` hook) |
| `cham.backgroundSetFromUrl(url)` | Download and set background image |
| `cham.deleteFile(path)` / `cham.deleteDir(path)` | Delete files/directories |
| `cham.plugin.*` | Plugin lifecycle + storage + IPC + hooks (see above) |

> Conversion-specific APIs (`convertImage`, `convertImages`, `onConvertProgress`, `onWatchChange`) are internal to the Conversion plugin and accessed via `cham.plugin.call('conversion', ...)`.

### Publishing to the Store

Store plugins are hosted on an OSS/CDN.

#### Directory Structure on CDN

```
store/
  index.json                        # All available plugins
  plugins/
    <plugin-id>/
      manifest.json                  # Full PluginManifest JSON
      renderer.js                    # Renderer bundle (for Store plugins)
      main.js                        # Main process bundle (optional, Phase 2)
```

#### Store Index Format (`index.json`)

```json
{
  "plugins": [
    {
      "id": "watermark-tool",
      "name": "watermarkTool",
      "description": "watermarkToolDesc",
      "icon": "image",
      "color": "linear-gradient(135deg, #00b4d8 0%, #0077b6 100%)",
      "version": "1.0.0",
      "author": "Cham Team",
      "minAppVersion": "0.1.0",
      "manifestUrl": "https://your-cdn.com/store/plugins/watermark-tool/manifest.json",
      "downloadUrl": "https://your-cdn.com/store/plugins/watermark-tool/renderer.js"
    }
  ],
  "updatedAt": "2026-07-14T00:00:00Z"
}
```

### Store Page

The in-app Store (accessible via the dock or `/store` route) has two tabs:

- **Installed** — Lists all plugins (built-in + store), with Open/Uninstall actions
- **Discover** — Fetches `index.json` from the CDN, shows available plugins with Install buttons

### Security

- Store plugins run in the Electron renderer sandbox (**`contextIsolation: true`**, **`nodeIntegration: false`**)
- Renderer plugins cannot access Node.js APIs (`fs`, `child_process`, etc.) directly
- Main process plugins receive an **injected API** — not raw `require()` access to Node.js
- `api.native.fs` requires absolute paths; relative paths throw an error
- `api.db` validates table access per the plugin's declared `dbTables`
- `api.registerHandler` channels are namespaced to prevent collisions
- Plugin database tables are declared in the manifest — no raw CREATE TABLE from plugin code
- Table names are enforced to start with `plugin_` to prevent collision with core tables

## License

MIT
