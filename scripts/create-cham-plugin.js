#!/usr/bin/env node
/**
 * create-cham-plugin — Scaffold a new Cham store plugin project.
 *
 * Usage:
 *   node scripts/create-cham-plugin.js my-plugin
 *
 * Creates:
 *   my-plugin/
 *     manifest.json       ← PluginManifest
 *     package.json
 *     webpack.config.js   ← Dual-target (renderer + main)
 *     src/
 *       renderer.tsx       ← React UI entry
 *       main.ts            ← Main process entry (optional)
 *     i18n/
 *       en.json
 *       zh.json
 */

const fs = require('fs');
const path = require('path');

const name = process.argv[2];
if (!name) {
  console.error('Usage: node scripts/create-cham-plugin.js <plugin-name>');
  process.exit(1);
}

const dir = path.resolve(name);
if (fs.existsSync(dir)) {
  console.error(`Directory already exists: ${dir}`);
  process.exit(1);
}

const id = name;
const displayName = name.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

console.log(`Creating plugin: ${id}`);

// ── Directory structure ──
fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
fs.mkdirSync(path.join(dir, 'i18n'), { recursive: true });

// ── manifest.json ──
fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({
  id,
  name: id,
  version: '1.0.0',
  description: `${id}Desc`,
  icon: 'image',
  color: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  minWidth: 800,
  minHeight: 500,
  category: 'store',
  permissions: ['fs', 'storage'],
  entry: 'renderer.js',
}, null, 2));

// ── package.json ──
fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({
  name: id,
  version: '1.0.0',
  description: displayName,
  scripts: {
    build: 'webpack --mode production',
    watch: 'webpack --watch --mode development',
  },
  devDependencies: {
    'ts-loader': '^9.5.0',
    'typescript': '^5.3.0',
    'webpack': '^5.89.0',
    'webpack-cli': '^5.1.0',
    'css-loader': '^6.8.0',
    'style-loader': '^3.3.0',
  },
}, null, 2));

// ── tsconfig.json ──
fs.writeFileSync(path.join(dir, 'tsconfig.json'), JSON.stringify({
  compilerOptions: {
    target: 'ES2020',
    module: 'commonjs',
    lib: ['ES2020', 'DOM'],
    jsx: 'react-jsx',
    strict: true,
    esModuleInterop: true,
    skipLibCheck: true,
    outDir: './dist',
    rootDir: './src',
    moduleResolution: 'node',
  },
  include: ['src/**/*'],
}, null, 2));

// ── webpack.config.js ──
fs.writeFileSync(path.join(dir, 'webpack.config.js'), `const path = require('path');

module.exports = [
  // Renderer bundle (UI)
  {
    target: 'web',
    entry: './src/renderer.tsx',
    output: { path: path.resolve(__dirname, 'dist'), filename: 'renderer.js' },
    resolve: { extensions: ['.tsx', '.ts', '.js'] },
    module: {
      rules: [
        { test: /\\.tsx?$/, use: 'ts-loader', exclude: /node_modules/ },
        { test: /\\.css$/, use: ['style-loader', 'css-loader'] },
      ],
    },
    // Shared libraries provided by Cham — don't bundle
    externals: {
      react: 'window.__chamShared.react',
      'react-dom': 'window.__chamShared.reactDom',
      'framer-motion': 'window.__chamShared.framerMotion',
    },
  },
  // Main process bundle (Node.js backend, optional)
  {
    target: 'node',
    entry: './src/main.ts',
    output: { path: path.resolve(__dirname, 'dist'), filename: 'main.js', libraryTarget: 'commonjs2' },
    resolve: { extensions: ['.ts', '.js'] },
    module: { rules: [{ test: /\\.ts$/, use: 'ts-loader', exclude: /node_modules/ }] },
    externals: {
      sharp: 'commonjs sharp',  // Provided by Cham
    },
  },
];
`);

// ── src/renderer.tsx ──
fs.writeFileSync(path.join(dir, 'src', 'renderer.tsx'), `import React from 'react';

function App() {
  const [result, setResult] = React.useState<string | null>(null);

  async function handleAction() {
    // Select files
    const files = await window.cham.selectFiles();
    if (!files.length) return;

    // Call plugin's main process handler (if main.ts exists)
    // const res = await window.cham.plugin.call('${id}', 'process', { paths: files.map(f => f.path) });

    // Read a file
    const { dataUrl } = await window.cham.readImage(files[0].path);
    setResult(dataUrl);
  }

  return React.createElement('div', { style: { padding: 24, color: '#fff' } },
    React.createElement('h2', null, '${displayName}'),
    React.createElement('button', {
      onClick: handleAction,
      style: { padding: '8px 16px', borderRadius: 6, border: 'none', background: '#667eea', color: '#fff', cursor: 'pointer' },
    }, 'Do Something'),
    result && React.createElement('img', { src: result, style: { maxWidth: 200, marginTop: 12, borderRadius: 8 } }),
  );
}

// REQUIRED: expose default component via __chamPlugin
var __chamPlugin = { default: App };
`);

// ── src/main.ts ──
fs.writeFileSync(path.join(dir, 'src', 'main.ts'), `// Main process module — runs in Node.js with sandboxed API access.
// See docs/plugin-api.md for the full PluginMainApi reference.

export default function(api: any) {
  // Register IPC handlers
  api.registerHandler('process', async (_event: any, params: any) => {
    api.log.info('Processing files: ' + params.paths?.length);

    // Use sharp for image processing
    // const buf = await api.sharp(params.paths[0]).resize(100).webp().toBuffer();

    // Use KV storage
    // await api.plugin?.setItem?.('${id}', 'lastRun', new Date().toISOString());

    return { success: true };
  });

  // Register hook — clear cache when user clicks "Clear Cache" in Settings
  api.registerHook('cache:clear', async () => {
    api.fs.remove('temp');
    api.log.info('Cache cleared');
  });

  // Cleanup
  return () => {
    api.log.info('Plugin deactivated');
  };
}
`);

// ── i18n/en.json ──
fs.writeFileSync(path.join(dir, 'i18n', 'en.json'), JSON.stringify({
  [id]: displayName,
  [`${id}Desc`]: 'Description of the plugin',
}, null, 2));

// ── i18n/zh.json ──
fs.writeFileSync(path.join(dir, 'i18n', 'zh.json'), JSON.stringify({
  [id]: displayName,
  [`${id}Desc`]: '插件描述',
}, null, 2));

console.log(`\n✅ Plugin "${id}" created at ${dir}`);
console.log('\nNext steps:');
console.log('  1. cd ' + name);
console.log('  2. npm install');
console.log('  3. npm run watch         (auto-build on changes)');
console.log('  4. node ../scripts/dev-plugin.js .  (auto-copy to Cham, in another terminal)');
console.log('  5. Launch Cham (pnpm dev)');
