# Plugin API Reference

Cham 插件通过两个接口与宿主 App 交互：

| 接口 | 运行进程 | 能力 |
|------|---------|------|
| `window.cham` | Renderer（浏览器沙箱） | IPC 通信、文件选择、转换、设置 |
| `PluginMainApi` (`api`) | Main（Node.js，VM 沙箱） | sharp、SQLite、文件 I/O、自定义 IPC |

---

## 目录

- [Manifest 规范](#manifest-规范)
- [Renderer API (`window.cham`)](#renderer-api-windowcham)
  - [文件操作](#文件操作)
  - [图片转换](#图片转换)
  - [Watch 模式](#watch-模式)
  - [应用设置](#应用设置)
  - [缓存管理](#缓存管理)
  - [更新管理](#更新管理)
  - [窗口控制](#窗口控制)
  - [Dock 管理](#dock-管理)
  - [背景图片](#背景图片)
  - [Plugin 管理](#plugin-管理)
  - [事件订阅](#事件订阅)
- [Main Process API (`api`)](#main-process-api-api)
  - [IPC 注册](#ipc-注册)
  - [图片处理 (sharp)](#图片处理-sharp)
  - [数据库](#数据库)
  - [文件系统](#文件系统)
  - [日志](#日志)
- [共享依赖](#共享依赖)
- [安全模型](#安全模型)

---

## Manifest 规范

每个插件定义一个 `PluginManifest`，内置插件写 `.ts` 文件，商店插件提供 `.json`：

```typescript
interface PluginManifest {
  /* ── 身份 ── */
  id: string;            // 唯一标识，推荐 kebab-case，如 "conversion"、"watermark-tool"
  name: string;          // i18n key，如 "conversionTool"
  version: string;       // 语义版本，如 "1.0.0"

  /* ── 描述 ── */
  description?: string;  // i18n key，如 "conversionToolDesc"

  /* ── 界面 ── */
  icon: string;          // IconType 名称（见 components/Icon/index.tsx）
  color: string;         // CSS 渐变色或纯色，如 "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"

  /* ── 窗口 ── */
  minWidth?: number;     // 最小宽度，默认 600
  minHeight?: number;    // 最小高度，默认 400
  unresizable?: boolean; // 是否禁止调整窗口大小

  /* ── 分类 ── */
  category: 'builtin' | 'store';

  /* ── 权限声明（v1 仅文档，未强制执行）── */
  permissions?: Array<'storage' | 'fs' | 'convert' | 'watch' | 'settings'>;

  /* ── 数据库表（可选）── */
  dbTables?: Array<{
    tableName: string;   // 必须以 "plugin_" 开头
    columns: Array<{
      name: string;
      type: 'TEXT' | 'INTEGER' | 'REAL' | 'BLOB';
      constraints?: string; // 如 "PRIMARY KEY", "NOT NULL DEFAULT 0"
    }>;
  }>;

  /* ── 入口 ── */
  entry: string;         // 渲染进程入口文件名，如 "renderer.js"
  main?: string;         // 主进程入口文件名（可选，Phase 2），如 "main.js"
}
```

### 内置插件示例

```typescript
// src/renderer/plugins/builtin/conversion/manifest.ts
import type { PluginManifest } from '@shared/plugin/types';

const manifest: PluginManifest = {
  id: 'conversion',
  name: 'conversionTool',
  version: '1.0.0',
  description: 'conversionToolDesc',
  icon: 'image',
  color: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  minWidth: 900,
  minHeight: 580,
  category: 'builtin',
  permissions: ['fs', 'convert', 'watch', 'settings'],
  entry: './index.tsx',
};

export default manifest;
```

### 商店插件示例（manifest.json）

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

---

## Renderer API (`window.cham`)

渲染进程 API 通过 `contextBridge` 暴露在 `window.cham` 上，所有方法返回 Promise。

### 文件操作

```typescript
// 打开文件选择对话框
const files: FileInfo[] = await window.cham.selectFiles();

// 打开文件夹选择对话框
const { folderPath, files } = await window.cham.selectFolder();

// 选择输出目录
const outputDir: string | null = await window.cham.selectOutputDir();

// 获取文件 SHA-256 哈希
const { hash } = await window.cham.getFileHash('/path/to/file.png');

// 读取图片为 base64 DataURL
const { dataUrl } = await window.cham.readImage('/path/to/image.jpg');
```

**类型定义：**
```typescript
interface FileInfo {
  path: string;
  name: string;
  size: number;
  ext: string;
}
```

### 图片转换

```typescript
// 转换单张图片
const result = await window.cham.convertImage({
  inputPath: '/path/to/photo.jpg',
  outputDir: '/output/dir',
  quality: 90,
  keepName: false,
  copyNonConvertible: true,
  format: 'webp',
  options: { lossless: false, effort: 4 },
});

// 批量转换
const results = await window.cham.convertImages({
  files: [{ path: '/a.jpg', name: 'a.jpg', size: 1024, ext: 'jpg' }],
  outputDir: '/output/dir',
  quality: 85,
  format: 'avif',
});
```

**转换参数：**
| 参数 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `inputPath` / `files` | `string` / `FileInfo[]` | — | 输入文件 |
| `outputDir` | `string` | — | 输出目录 |
| `quality` | `number` | `100` | 质量 0-100 |
| `keepName` | `boolean` | `false` | 保留原始扩展名 |
| `copyNonConvertible` | `boolean` | `false` | 复制不可转换的文件 |
| `format` | `string` | `'webp'` | 目标格式：`'webp'` / `'avif'` |
| `options` | `object` | — | 格式特定选项，见下方 |

**WebP 选项（`format: 'webp'`）：**
| Key | 类型 | 默认 | 说明 |
|-----|------|------|------|
| `lossless` | `boolean` | `false` | 无损压缩 |
| `nearLossless` | `boolean` | `false` | 近无损压缩 |
| `alphaQuality` | `number` | `100` | Alpha 通道质量 0-100 |
| `effort` | `number` | `4` | CPU 占用 0（最快）~ 6（最慢） |
| `preset` | `string` | `'default'` | 预设：`default`/`photo`/`picture`/`drawing`/`icon`/`text` |
| `smartSubsample` | `boolean` | `false` | 高质量色度二次采样 |
| `smartDeblock` | `boolean` | `false` | 自动去块滤波 |
| `minSize` | `boolean` | `false` | 最小化体积（禁用动画关键帧） |
| `loop` | `number` | `0` | 动画循环次数（0=无限） |
| `mixed` | `boolean` | `false` | 混合有损/无损动画帧 |
| `exact` | `boolean` | `false` | 保留透明像素颜色 |

**返回类型：**
```typescript
interface ConvertResult {
  inputPath: string;
  outputPath?: string;
  outputSize?: number;
  success: boolean;
  cached?: boolean;
  copied?: boolean;
  error?: string;
}
```

### Watch 模式

```typescript
// 启动文件监听
await window.cham.watchStart('/path/to/watch/folder');

// 停止监听
await window.cham.watchStop();

// 监听文件变化事件
const unsubscribe = window.cham.onWatchChange((event) => {
  console.log(event.event);  // 'add' | 'change' | 'unlink' | 'unlinkDir'
  console.log(event.file);   // FileInfo | undefined
  console.log(event.path);   // string | undefined
});

// 取消订阅
unsubscribe();
```

**转换进度事件（所有转换请求共享）：**
```typescript
const unsubscribe = window.cham.onConvertProgress((result: ConvertResult) => {
  // 每个文件处理完成后触发
  console.log(`${result.inputPath} → ${result.success}`);
});
unsubscribe();
```

### 应用设置

```typescript
// 加载全局设置
const { settings } = await window.cham.loadSettings();
// settings: { quality: '90', format: 'webp', language: 'zh', theme: 'dark', ... }

// 保存全局设置
await window.cham.saveSettings({ quality: '90', format: 'webp' });
```

> ⚠️ 全局设置所有插件共享。如需插件独立存储，使用 `window.cham.plugin.getItem/setItem`（见 [Plugin 管理](#plugin-管理)）。

### 缓存管理

```typescript
// 清除转换缓存
await window.cham.clearCache();

// 检查文件是否已缓存
const { cached, outputPath } = await window.cham.checkCached('/path/to/input.jpg');
```

### 更新管理

```typescript
// 检查更新
const status = await window.cham.checkUpdate();
// { updateAvailable: boolean, latestVersion?: string, latestNotes?: string, changelog: [...] }

// 获取当前版本
const version = await window.cham.getAppVersion();

// 下载更新
const { filePath } = await window.cham.downloadUpdate();

// 安装更新
await window.cham.installUpdate();

// 订阅更新事件
const unsub1 = window.cham.onUpdateAvailable((status) => { ... });
const unsub2 = window.cham.onUpdateProgress(({ progress }) => { ... });
```

### 窗口控制

```typescript
await window.cham.windowMinimize();
await window.cham.windowMaximize();
await window.cham.windowClose();

const maximized = await window.cham.windowIsMaximized();

const unsubscribe = window.cham.onWindowStateChanged(({ maximized }) => {
  console.log('Maximized:', maximized);
});
```

> 🔒 插件组件应使用 `useScopedWindowActions(winId)` hook 而非直接调用这些方法——该 hook 确保只能操作自己的窗口。

### Dock 管理

```typescript
const { entries } = await window.cham.loadDock();
await window.cham.saveDock([
  { app_key: 'conversion', icon: 'image', color: '#667eea', title: 'Conversion', description: null, unresizable: 0 },
]);
```

### 背景图片

```typescript
const { items } = await window.cham.backgroundList();
const { items } = await window.cham.backgroundSelect();
const { dataUrl } = await window.cham.backgroundSetActive(id);
await window.cham.backgroundDelete(id);
```

### Plugin 管理

```typescript
// 列出已安装插件
const { plugins } = await window.cham.plugin.listInstalled();

// 从远程 URL 安装插件
const { manifest } = await window.cham.plugin.install(
  'https://your-cdn.com/store/plugins/my-plugin/manifest.json'
);

// 卸载插件（不能卸载内置插件）
await window.cham.plugin.uninstall('my-plugin');

// 获取远程 manifest（不安装）
const { manifest } = await window.cham.plugin.fetchManifest(
  'https://your-cdn.com/store/plugins/my-plugin/manifest.json'
);
```

#### Plugin KV 存储

每个插件有独立的键值存储（SQLite 后盾），读写互不干扰：

```typescript
// 写入
await window.cham.plugin.setItem('my-plugin', 'lastPreset', 'dark');

// 读取
const { value } = await window.cham.plugin.getItem('my-plugin', 'lastPreset');
// value === 'dark'

// 列出所有键
const { items } = await window.cham.plugin.listItems('my-plugin');
// items === [{ key: 'lastPreset', value: 'dark' }]

// 删除
await window.cham.plugin.removeItem('my-plugin', 'lastPreset');
```

> 🔒 推荐使用 `usePluginStorage(pluginId)` hook 替代直接调用——自动绑定 pluginId，插件无法伪造。

#### Plugin IPC 调用

调用其他插件的自定义 IPC handler（Phase 2 主进程插件注册的 handler）：

```typescript
// 调用 Plugin A 注册的 handler
const result = await window.cham.plugin.call(
  'watermark-tool',       // 插件 ID
  'apply',                // handler 名称
  { image: '/p/a.jpg' }   // 参数
);
```

实际 channel 为 `plugin:watermark-tool:apply`，主进程自动命名空间隔离。

```typescript
// 检查插件主进程模块是否活跃
const { active } = await window.cham.plugin.isActive('watermark-tool');
```

### 事件订阅

所有事件订阅方法返回一个取消订阅函数，务必在组件卸载时调用：

```typescript
const unsubscribe = window.cham.onXxxEvent(callback);
// 在 useEffect cleanup 中：
return () => unsubscribe();
```

---

## Main Process API (`api`)

插件声明 `main` 入口后，主进程用 `vm.compileFunction()` 加载并注入受限 API。

### 模块签名

```javascript
// main.js —— 主进程插件模块
module.exports = function(api) {
  // 注册 IPC handler
  api.registerHandler('doWork', async (event, params) => {
    // 使用 api.sharp, api.db, api.fs ...
    return { success: true };
  });

  // 可选：返回清理函数
  return () => {
    api.log.info('Plugin deactivated');
  };
};
```

### API 参考

| 属性 | 类型 | 说明 |
|------|------|------|
| `api.pluginId` | `string` | 插件 ID（只读） |
| `api.pluginDir` | `string` | 插件安装目录的绝对路径 |
| `api.appVersion` | `string` | Cham 版本号 |

### IPC 注册

```javascript
api.registerHandler(channel, handler);
```

- `channel`: 字符串，如 `'apply'`。实际 channel 自动前缀为 `plugin:<pluginId>:apply`
- `handler`: `(event: IpcMainInvokeEvent, ...args: any[]) => any` — 标准的 Electron IPC handler
- 覆盖已存在的同名 handler 会打印警告
- 返回给渲染进程的值直接作为 IPC invoke 的返回值

**渲染进程调用**：
```javascript
// renderer.js
const result = await window.cham.plugin.call('my-plugin', 'apply', params);
```

### 图片处理 (sharp)

```javascript
api.sharp(input)  // 获取 sharp 实例
```

`api.sharp` 是和宿主 App **同一个 sharp 实例**，无额外内存开销。所有 [sharp API](https://sharp.pixelplumbing.com/) 方法可用：

```javascript
module.exports = function(api) {
  api.registerHandler('applyWatermark', async (event, params) => {
    const { inputPath, watermarkPath, opacity } = params;

    // 读取水印图片，调整大小+透明度
    const watermark = await api.sharp(watermarkPath)
      .resize(200)
      .ensureAlpha(opacity)
      .toBuffer();

    // 合成水印
    const outputPath = api.pluginDir + '/output/result.webp';
    await api.sharp(inputPath)
      .composite([{ input: watermark, gravity: 'southeast' }])
      .webp({ quality: 90 })
      .toFile(outputPath);

    return { success: true, outputPath };
  });
};
```

### 数据库

```javascript
// 参数化查询
const stmt = api.db.prepare('SELECT * FROM plugin_watermark_presets WHERE id = ?');
const row = stmt.get(1);

const rows = api.db.prepare('SELECT * FROM plugin_watermark_presets ORDER BY id DESC').all();

api.db.prepare('INSERT INTO plugin_watermark_presets (name, position) VALUES (?, ?)').run('My Preset', 'southeast');

// 执行原始 SQL（受限制）
api.db.exec('CREATE TABLE IF NOT EXISTS plugin_mydata (id INTEGER PRIMARY KEY, value TEXT)');
```

**安全限制**：
- 禁止 `ATTACH` / `DETACH` / `DROP` / `ALTER` / `PRAGMA` / `REINDEX` / `VACUUM`
- 禁止事务控制语句（`BEGIN` / `COMMIT` / `ROLLBACK`）
- `CREATE TABLE` 只能操作 manifest 中 `dbTables` 声明的表
- 表名必须以 `plugin_` 开头

### 文件系统

所有路径相对于插件安装目录，绝对路径和 `..` 向上穿越被拒绝：

```javascript
api.fs.readFile('config.json');       // → string
api.fs.writeFile('config.json', '{}');
api.fs.readBuffer('logo.png');        // → Buffer
api.fs.exists('output');              // → boolean
api.fs.mkdir('output/temp');
api.fs.listDir('output');             // → string[] (文件/目录名)
api.fs.remove('temp');                // 递归删除
```

### 日志

```javascript
api.log.info('Processing started');
api.log.warn('Low disk space');
api.log.error('Failed to process:', err.message);
```

输出格式：`[pluginId] 消息内容`

### Push 事件

向渲染进程推送事件（非请求-响应模式）：

```javascript
api.sendEvent('watch-change', { event: 'add', file: { path, name, size, ext } });
```

实际 channel 为 `plugin:<pluginId>:watch-change`，渲染进程通过 `window.cham.onWatchChange(cb)` 订阅。

### Hook 系统（跨插件通信）

插件间通过 pub/sub 钩子解耦通信，无需相互依赖：

#### 注册钩子

```javascript
module.exports = function(api) {
  // timing: 'startup' (默认) — 仅在 app 启动完毕后触发，刚安装的插件不影响
  // timing: 'install' — 安装后立即生效，无需重启
  api.registerHook('cache:clear', async () => {
    api.fs.remove('thumbnails');         // 清空本地缓存
    api.db.exec('DELETE FROM plugin_mydata'); // 清空数据库缓存
    api.log.info('My cache cleared');
  }, 'startup');

  // 另一个 hook — 安装即生效
  api.registerHook('file:imported', async (filePath) => {
    api.log.info(`File imported: ${filePath}`);
  }, 'install');
};
```

**`registerHook(hookName, handler, timing?)`**

| 参数 | 类型 | 说明 |
|------|------|------|
| `hookName` | `string` | 钩子名称（如 `'cache:clear'`） |
| `handler` | `(...args: any[]) => Promise<void> \| void` | 钩子回调 |
| `timing` | `'startup' \| 'install'` | 默认 `'startup'`。`'startup'` 仅在 app 启动完毕后触发（刚安装的插件下次重启生效）；`'install'` 安装后立即生效 |

#### 触发钩子

**主进程：**
```javascript
api.emitHook('cache:clear');
api.emitHook('file:imported', '/path/to/file.png');
```

**渲染进程：**
```javascript
await window.cham.plugin.emitHook('cache:clear');
```

**触发逻辑（host 自动判断）：**

```
emitHook('cache:clear')
  │
  └─ 遍历已注册的 handlers，按 timing 过滤：
       ├─ timing === 'install'  → ✅ 总是执行
       └─ timing === 'startup'  → 检查 startupComplete 标志
            ├─ true  → ✅ app 已启动 → 执行
            └─ false → ❌ 还在启动中 → 跳过
```

- 一个 handler 抛出异常不会阻塞其他 handler（错误被捕获并打印日志）
- 插件卸载时，其注册的 hooks 自动移除

#### 内置钩子

| 钩子名 | 触发时机 | 参数 | 说明 |
|--------|---------|------|------|
| `cache:clear` | 用户在 Settings 点击"清空缓存" | 无 | 插件应清空自己的缓存数据 |

---

## 共享依赖

Cham 通过 `window.__chamShared` 注入共享库，避免每个插件重复打包：

```javascript
// 插件 webpack.config.js
module.exports = [
  // 渲染进程 bundle
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
  // 主进程 bundle
  {
    target: 'node',
    entry: './src/main.js',
    output: { path: './dist', filename: 'main.js', libraryTarget: 'commonjs2' },
    externals: {
      sharp: 'commonjs sharp',  // 由 Cham 提供
    },
  },
];
```

| 共享库 | 来源 | 说明 |
|--------|------|------|
| `react` | `window.__chamShared.react` | 与宿主 App 共享同一 React 实例 |
| `react-dom` | `window.__chamShared.reactDom` | 同上 |
| `framer-motion` | `window.__chamShared.framerMotion` | 同上 |
| `sharp` | `api.sharp` | 主进程插件通过 API 获取 |

---

## 第三方依赖策略

| 策略 | 场景 | 做法 |
|------|------|------|
| **A. 使用 Cham 注入的 API** | 90% 场景 | `api.sharp`、`api.db`、`api.fs` 已覆盖图片处理、存储、文件 I/O |
| **B. 打包纯 JS 库** | `lodash`、`dayjs`、`pdf-lib` 等 | webpack `target: 'node'` 自动打进 `main.js` |
| **C. 预编译 `.node` 文件** | 需要额外原生模块 | 按平台预编译，Cham 验证 ABI 后加载（未来支持） |

策略 B 示例——纯 JS 库自动打包：

```javascript
// 开发时 npm install pdf-lib，构建时 webpack 打进 main.js
const { PDFDocument } = require('pdf-lib');

module.exports = function(api) {
  api.registerHandler('extractImages', async (event, params) => {
    const pdfDoc = await PDFDocument.load(params.buffer);
    // ...纯 JS 操作，无原生依赖
  });
};
```

> 如果确实需要 Cham 没有的原生模块，推荐提交 PR 将其加入 Cham 核心依赖——比每个插件各自携带一份更安全、更高效。

---

## 安全模型

| 边界 | 机制 |
|------|------|
| **渲染进程沙箱** | `contextIsolation: true` + `nodeIntegration: false` — 插件代码无法直接访问 Node.js API |
| **插件 bundle 执行** | `new Function()` 传入最小沙箱对象 `{ cham, console }`，不暴露 `window`/`document` |
| **主进程模块加载** | `vm.compileFunction()` 替代 `require()` — `require`/`process`/`fs` 不在作用域中 |
| **文件系统** | `api.fs` 限制在插件安装目录内，`delete-file`/`delete-dir` IPC 限制在 `userData`+`temp` 内 |
| **数据库** | SQL 黑名单拦截 ATTACH/DROP/ALTER/PRAGMA 等，表名强制 `plugin_` 前缀 |
| **IPC** | 插件自定义 handler 自动前缀 `plugin:<id>:` 防冲突；dangerous IPC handler 加路径白名单 |
| **窗口隔离** | React Error Boundary 单窗口崩溃不影响其他；`useScopedWindowActions` 阻止跨窗口操作 |
| **KV 存储** | `usePluginStorage` hook 自动绑定 pluginId，阻止跨插件读取 |
| **Hook 系统** | register 时声明 timing；startup 钩子仅在启动后触发；卸载时自动移除 |
