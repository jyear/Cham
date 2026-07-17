# Plugin Development Guide

从零开始开发一个 Cham 插件并发布到商店。

---

## 1. 项目结构

```
my-plugin/
  src/
    renderer.tsx     ← 渲染进程入口（React UI）
    main.ts          ← 主进程入口（Node.js 后端，可选）
    i18n/
      en.json        ← 英文翻译
      zh.json        ← 中文翻译
  manifest.json      ← 插件元数据
  package.json
  webpack.config.js  ← 构建配置
```

---

## 2. manifest.json

```json
{
  "id": "watermark-tool",
  "name": "watermarkTool",
  "version": "1.0.0",
  "description": "watermarkToolDesc",
  "icon": "image",
  "color": "linear-gradient(135deg, #00b4d8 0%, #0077b6 100%)",
  "minWidth": 800,
  "minHeight": 500,
  "category": "store",
  "permissions": ["fs", "convert", "storage"],
  "entry": "renderer.js",
  "main": "main.js",
  "files": [
    "i18n/en.json",
    "i18n/zh.json",
    "dependence/windows-wallpaper-x86-64.exe"
  ],
  "dbTables": [
    {
      "tableName": "plugin_watermark_presets",
      "columns": [
        { "name": "id", "type": "INTEGER", "constraints": "PRIMARY KEY AUTOINCREMENT" },
        { "name": "name", "type": "TEXT", "constraints": "NOT NULL" },
        { "name": "config", "type": "TEXT" }
      ]
    }
  ]
}
```

---

## 3. webpack.config.js

```js
const path = require('path');

module.exports = [
  // ── 渲染进程 ──
  {
    target: 'web',
    entry: './src/renderer.tsx',
    output: { path: path.resolve(__dirname, 'dist'), filename: 'renderer.js' },
    resolve: { extensions: ['.tsx', '.ts', '.js'] },
    module: {
      rules: [
        { test: /\.tsx?$/, use: 'ts-loader', exclude: /node_modules/ },
        { test: /\.css$/,  use: ['style-loader', 'css-loader'] },
      ],
    },
    externals: {
      // 宿主体提供的共享库——不打包，运行时注入
      react: 'window.__chamShared.react',
      'react-dom': 'window.__chamShared.reactDom',
      'framer-motion': 'window.__chamShared.framerMotion',
    },
  },
  // ── 主进程（可选）──
  {
    target: 'node',
    entry: './src/main.ts',
    output: { path: path.resolve(__dirname, 'dist'), filename: 'main.js', libraryTarget: 'commonjs2' },
    resolve: { extensions: ['.ts', '.js'] },
    module: { rules: [{ test: /\.ts$/, use: 'ts-loader', exclude: /node_modules/ }] },
    externals: {
      sharp: 'commonjs sharp',  // 由 Cham 提供
    },
  },
];
```

---

## 4. 渲染进程入口

```tsx
// src/renderer.tsx
// 插件必须暴露 __chamPlugin 全局变量，包含 default 组件
import React from 'react';

function WatermarkUI() {
  const [image, setImage] = React.useState<string | null>(null);

  async function handlePickAndApply() {
    // 选择文件
    const files = await window.cham.selectFiles();
    if (!files.length) return;

    // 调用自己的主进程 IPC
    const result = await window.cham.plugin.call(
      'watermark-tool', 'apply',
      { inputPath: files[0].path, text: '© My Watermark' }
    );

    if (result.success) setImage(result.outputPath);
  }

  async function handleSetBackground() {
    // 使用宿主 API 设置背景
    await window.cham.backgroundSetFromUrl('https://example.com/bg.jpg');
  }

  return React.createElement('div', null,
    React.createElement('button', { onClick: handlePickAndApply }, 'Apply Watermark'),
    React.createElement('button', { onClick: handleSetBackground }, 'Set Background'),
    image && React.createElement('img', { src: 'file://' + image }),
  );
}

// 必须暴露
var __chamPlugin = { default: WatermarkUI };
```

---

## 5. 主进程入口（可选）

```ts
// src/main.ts
// 导出默认函数，接收 api 对象
export default function(api: any) {
  // 注册 IPC handler
  api.registerHandler('apply', async (event: any, params: any) => {
    const { inputPath, text } = params;
    const outputPath = api.pluginDir + '/output/watermarked.webp';

    // 用 sharp 合成水印
    const svgText = `<svg width="800" height="200">
      <text x="50%" y="50%" text-anchor="middle" fill="rgba(255,255,255,0.5)" font-size="48">${text}</text>
    </svg>`;

    await api.sharp(inputPath)
      .composite([{ input: Buffer.from(svgText), gravity: 'southeast' }])
      .webp({ quality: 90 })
      .toFile(outputPath);

    return { success: true, outputPath };
  });

  // 注册 hook——跟随 Cham 的缓存清理
  api.registerHook('cache:clear', async () => {
    api.fs.remove('output');
  });

  // 使用 KV 存储（通过 api.db 操作 plugin_store 表）
  api.registerHandler('savePreset', async (_e: any, preset: any) => {
    const row = api.db.prepare(
      'SELECT value FROM plugin_store WHERE plugin_id = ? AND key = ?'
    ).get(api.pluginId, 'presets') as { value: string } | undefined;
    const presets = row ? JSON.parse(row.value) : [];
    presets.push(preset);
    api.db.prepare(
      'INSERT OR REPLACE INTO plugin_store (plugin_id, key, value) VALUES (?, ?, ?)'
    ).run(api.pluginId, 'presets', JSON.stringify(presets));
    return { success: true };
  });
}
```

---

## 6. 翻译文件

```json
// i18n/en.json
{
  "watermarkTool": "Watermark Tool",
  "watermarkToolDesc": "Add text or image watermarks to photos"
}
```

```json
// i18n/zh.json
{
  "watermarkTool": "水印工具",
  "watermarkToolDesc": "给图片添加文字或图片水印"
}
```

---

## 7. 本地调试

### 方式一：自动化脚本（推荐）

Cham 提供了开发辅助脚本，自动监听插件构建产物并复制到 Cham 的插件目录：

```bash
# 终端 1：webpack watch 模式构建插件
cd my-plugin
npx webpack --watch --mode development

# 终端 2：运行 Cham 项目（开发模式)
cd cham
pnpm dev

# 终端 3：开发辅助脚本，监听构建产物并自动复制
node scripts/dev-plugin.js /path/to/my-plugin
```

每次 webpack 重新构建，脚本自动把 `dist/` 里的文件复制到 `userData/plugins/<plugin-id>/`。Cham 重启后（或下次打开 Store → Installed）即可看到更新。

### 方式二：手动安装

```bash
# 构建插件
npx webpack --mode production

# 找到 Cham 的 userData 目录
# Windows: %APPDATA%/cham
# macOS:   ~/Library/Application Support/cham
# Linux:   ~/.config/cham

# 手动复制到 plugins 目录
cp -r dist/* manifest.json ~/.config/cham/plugins/my-plugin/
```

每次修改需重新构建并手动复制，重启 Cham 生效。

### 调试技巧

- **渲染进程**：Cham 运行时按 `Ctrl+Shift+I` 打开 DevTools → Console 看日志
- **主进程**：终端查看 `[plugin]` 和 `[PluginHost]` 前缀的日志
- **插件代码断点**：DevTools → Sources → 搜索插件名
- **重新加载**：修改后重启 Cham 即可（脚本自动复制）

---

## 8. 构建 & 发布

```bash
# 1. 构建
npm install
npx webpack --mode production

# 产物
dist/
  renderer.js    ← 上传到 CDN
  main.js        ← 上传到 CDN（如果有）

# 2. 上传到 CDN
# 将 dist/ 内的文件和 manifest.json 一起上传到你的 CDN：
# https://your-cdn.com/plugins/watermark-tool/
#   manifest.json
#   renderer.js
#   main.js

# 3. 注册到商店
# 在商店的 index.json 中添加条目：
{
  "plugins": [
    {
      "id": "watermark-tool",
      "name": "watermarkTool",
      "description": "watermarkToolDesc",
      "icon": "image",
      "color": "linear-gradient(135deg, #00b4d8 0%, #0077b6 100%)",
      "version": "1.0.0",
      "author": "Your Name",
      "minAppVersion": "0.1.0",
      "manifestUrl": "https://your-cdn.com/plugins/watermark-tool/manifest.json",
      "downloadUrl": "https://your-cdn.com/plugins/watermark-tool/renderer.js"
    }
  ],
  "updatedAt": "2026-07-15T00:00:00Z"
}
```

Cham 用户打开 Store → 发现 → 点击 Install，即可下载使用。

### 打包平台二进制

如果插件需要调用外部工具（ffmpeg、ImageMagick 等），将二进制文件放入 `bin/` 目录一起发布：

```
my-plugin/
  bin/
    ffmpeg.exe       ← Windows 64-bit
    ffmpeg           ← macOS / Linux
  ...
```

在 `main.ts` 中按平台选择：

```ts
export default function(api: any) {
  const platform = api.native.os.platform();
  const ffmpeg = platform === 'win32' ? 'bin/ffmpeg.exe' : 'bin/ffmpeg';

  api.registerHandler('transcode', async (_e, params) => {
    const result = await api.native.child_process.execFile(ffmpeg, [
      '-i', params.inputPath,
      '-c:v', 'libx264',
      params.outputPath,
    ], { timeout: 120000 });

    if (result.exitCode !== 0) throw new Error(result.stderr);
    return { success: true };
  });
}
```

---

## 9. 完整 API 参考

### 渲染进程 (`window.cham`)

| API | 说明 |
|-----|------|
| `selectFiles()` | 打开文件选择 |
| `selectFolder()` | 打开文件夹选择 |
| `selectOutputDir()` | 选择输出目录 |
| `getFileHash(path)` | 获取文件 MD5 |
| `readImage(path)` | 读取图片为 dataURL |
| `loadSettings()` / `saveSettings(s)` | 应用设置 |
| `clearCache()` | 清空缓存（→ 触发 `cache:clear` 钩子）|
| `backgroundList()` | 列出背景图片 |
| `backgroundSelect()` | 选择背景图片文件 |
| `backgroundSetActive(id)` | 设置当前背景 |
| `backgroundDelete(id)` | 删除背景 |
| `backgroundSetFromUrl(url)` | 从 URL 下载并设为背景 |
| `windowMinimize/Maximize/Close()` | 窗口控制 |
| `checkUpdate()` / `downloadUpdate()` / `installUpdate()` | 更新管理 |
| `deleteFile(path)` / `deleteDir(path)` | 删除文件/目录 |
| `watchStart/Stop(path)` | 文件监听 |

| `plugin` 子对象 | 说明 |
|-----------------|------|
| `plugin.call(id, channel, ...args)` | 调用插件的 IPC handler |
| `plugin.subscribe(id, channel, cb)` | 订阅插件的推送事件 |
| `plugin.getItem(id, key)` | 读 KV 存储 |
| `plugin.setItem(id, key, value)` | 写 KV 存储 |
| `plugin.removeItem(id, key)` | 删 KV 存储 |
| `plugin.listItems(id)` | 列出所有 KV |
| `plugin.emitHook(name, ...args)` | 触发钩子 |
| `plugin.listInstalled()` | 列出已安装插件 |
| `plugin.install(url)` / `plugin.uninstall(id)` | 安装/卸载插件 |
| `plugin.isActive(id)` | 检查插件是否活跃 |

### 主进程 (`api`)

| API | 说明 |
|-----|------|
| `api.pluginId` / `api.pluginDir` / `api.appVersion` | 插件元数据 |
| `api.registerHandler(channel, handler)` | 注册 IPC handler |
| `api.sendEvent(channel, data)` | 推送事件到渲染进程 |
| `api.registerHook(name, handler, timing?)` | 注册钩子 |
| `api.emitHook(name, ...args)` | 触发钩子 |
| `api.sharp` | sharp 图片处理（同宿主实例） |
| `api.db.prepare(sql)` / `api.db.exec(sql)` | 数据库操作 |
| `api.fs.readFile/writeFile/exists/mkdir/listDir/remove` | 沙箱文件系统 |
| `api.native.crypto.randomBytes/sha256/md5` | 加密哈希 |
| `api.native.os.platform/arch/cpus/memory` | 系统信息 |
| `api.native.path.join/resolve/basename/extname/dirname` | 路径操作 |
| `api.native.http.get/download` | 网络请求 |
| `api.native.child_process.execFile(exe, args, opts?)` | 执行插件目录内的二进制 |
| `api.log.info/warn/error(msg)` | 日志 |
