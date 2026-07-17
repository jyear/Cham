#!/usr/bin/env node
/**
 * create-cham-plugin — Scaffold a new Cham store plugin project.
 *
 * Usage:
 *   node scripts/create-cham-plugin.js my-plugin
 *
 * Creates:
 *   my-plugin/
 *     manifest.json         ← PluginManifest (with asarBundle + binaryFiles)
 *     package.json          ← Scripts: build, watch, dev, bundle
 *     webpack.config.js     ← Dual-target (renderer + main)
 *     tsconfig.json
 *     scripts/
 *       package.js          ← Production .asar packaging
 *     src/
 *       renderer.tsx        ← React UI entry
 *       main.ts             ← Main process entry
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
const displayName = name
  .replace(/-/g, ' ')
  .replace(/\b\w/g, (c) => c.toUpperCase());

console.log(`Creating plugin: ${id}`);

// ── Directory structure ──
fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
fs.mkdirSync(path.join(dir, 'i18n'), { recursive: true });
fs.mkdirSync(path.join(dir, 'scripts'), { recursive: true });

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
  permissions: ['storage'],
  asarBundle: `${id}.asar`,
  entry: 'renderer.js',
  main: 'main.js',
  files: [
    'i18n/en.json',
    'i18n/zh.json',
  ],
  binaryFiles: [],
  dbTables: [],
}, null, 2));

// ── package.json ──
fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({
  name: id,
  version: '1.0.0',
  description: displayName,
  private: true,
  scripts: {
    build: 'webpack --mode production',
    bundle: 'node scripts/package.js',
    watch: 'webpack --watch --mode development',
    dev: 'npx webpack serve --mode development --config webpack.config.js',
  },
  devDependencies: {
    '@electron/asar': '^3.4.1',
    'css-loader': '^6.8.0',
    'style-loader': '^3.3.0',
    'ts-loader': '^9.5.0',
    'typescript': '^5.3.0',
    'webpack': '^5.89.0',
    'webpack-cli': '^5.1.0',
    'webpack-dev-server': '^6.0.0',
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
const fs = require('fs');

/** Copies static plugin files into dist/ on every build. */
class CopyPluginFiles {
  constructor(files) { this.files = files; }
  apply(compiler) {
    compiler.hooks.afterEmit.tap('CopyPluginFiles', () => {
      for (const { from, to, transform } of this.files) {
        const src = path.resolve(__dirname, from);
        const dest = path.resolve(__dirname, to);
        if (!fs.existsSync(src)) continue;
        try {
          const srcTime = fs.statSync(src).mtimeMs;
          const destTime = fs.existsSync(dest) ? fs.statSync(dest).mtimeMs : 0;
          if (srcTime > destTime) {
            const destDir = path.dirname(dest);
            if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
            if (transform) {
              const content = fs.readFileSync(src, 'utf-8');
              fs.writeFileSync(dest, transform(content), 'utf-8');
            } else {
              fs.copyFileSync(src, dest);
            }
            console.log('[plugin] ' + from + ' → ' + to);
          }
        } catch (err) {
          console.warn('[plugin] Copy ' + from + ' failed:', err.message);
        }
      }
    });
  }
}

const sharedResolve = {
  extensions: ['.tsx', '.ts', '.js'],
};

module.exports = [
  // ── Production renderer bundle ──
  {
    mode: 'production',
    target: 'web',
    devtool: false,
    entry: './src/renderer.tsx',
    output: { path: path.resolve(__dirname, 'dist'), filename: 'renderer.js' },
    resolve: sharedResolve,
    module: {
      rules: [
        { test: /\\.tsx?$/, use: 'ts-loader', exclude: /node_modules/ },
        { test: /\\.css$/, use: ['style-loader', 'css-loader'] },
      ],
    },
    externals: {
      react: 'window.__chamShared.react',
      'react-dom': 'window.__chamShared.reactDom',
      'framer-motion': 'window.__chamShared.framerMotion',
    },
    plugins: [
      new CopyPluginFiles([
        { from: 'src/main.js', to: 'dist/main.js' },
        { from: 'manifest.json', to: 'dist/manifest.json', transform: (c) => {
          const m = JSON.parse(c);
          delete m.devServer;
          return JSON.stringify(m, null, 2);
        }},
        { from: 'i18n/en.json', to: 'dist/i18n/en.json' },
        { from: 'i18n/zh.json', to: 'dist/i18n/zh.json' },
      ]),
    ],
  },
  // ── Development build (iframe HMR) ──
  {
    mode: 'development',
    target: 'web',
    devtool: 'eval-source-map',
    entry: './src/renderer.tsx',
    output: { path: path.resolve(__dirname, 'dist'), filename: 'renderer.dev.js' },
    resolve: sharedResolve,
    module: {
      rules: [
        { test: /\\.tsx?$/, use: 'ts-loader', exclude: /node_modules/ },
        { test: /\\.css$/, use: ['style-loader', 'css-loader'] },
      ],
    },
    externals: {
      react: 'window.__chamShared.react',
      'react-dom': 'window.__chamShared.reactDom',
      'framer-motion': 'window.__chamShared.framerMotion',
    },
    devServer: {
      port: 0,
      hot: true,
      allowedHosts: 'all',
      headers: { 'Access-Control-Allow-Origin': '*' },
    },
  },
];
`);

// ── scripts/package.js ──
fs.writeFileSync(path.join(dir, 'scripts', 'package.js'), `/**
 * Production packaging — creates the .asar bundle ready for CDN upload.
 *
 * Output (release/):
 *   ${id}.asar       ← Everything: code, i18n, manifest, binaries
 *   manifest.json    ← For CDN store discovery
 *
 * Binary files (listed in manifest.binaryFiles) are packed inside the
 * .asar and extracted to the companion folder on install.
 *
 * Usage:
 *   node scripts/package.js    or    pnpm bundle
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const asar = require('@electron/asar');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const RELEASE = path.join(ROOT, 'release');
const STAGING = path.join(RELEASE, '.asar-staging');
const PLUGIN_ID = '${id}';
const ASAR_PATH = path.join(RELEASE, \`\${PLUGIN_ID}.asar\`);

(async () => {
try {

// ── Step 1: Build ──
console.log('[1/5] Building plugin...');
execSync('npx webpack --mode production --config webpack.config.js', {
  cwd: ROOT,
  stdio: 'inherit',
});

// ── Step 2: Clean previous outputs ──
console.log('[2/5] Cleaning previous outputs...');
fs.mkdirSync(RELEASE, { recursive: true });
for (const name of [ASAR_PATH, STAGING]) {
  try {
    if (fs.existsSync(name)) fs.rmSync(name, { recursive: true, force: true });
  } catch { /* locked by OS, will overwrite */ }
}

// ── Step 3: Assemble staging dir ──
console.log('[3/5] Assembling .asar contents...');
fs.mkdirSync(STAGING, { recursive: true });

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const sp = path.join(src, entry.name);
    const dp = path.join(dest, entry.name);
    if (entry.isDirectory()) { copyDir(sp, dp); }
    else if (!entry.name.endsWith('.dev.js') && !entry.name.endsWith('.LICENSE.txt')) {
      fs.copyFileSync(sp, dp);
    }
  }
}
copyDir(DIST, STAGING);

// ── Step 4: Create .asar ──
console.log('[4/5] Creating .asar...');
await asar.createPackage(STAGING, ASAR_PATH);
fs.rmSync(STAGING, { recursive: true, force: true });

// ── Step 5: Copy manifest.json ──
console.log('[5/5] Copying manifest.json...');
fs.copyFileSync(path.join(DIST, 'manifest.json'), path.join(RELEASE, 'manifest.json'));

console.log('');
console.log('✅ Packaging complete!');
console.log('  → ' + ASAR_PATH);
console.log('  → ' + path.join(RELEASE, 'manifest.json'));
console.log('');
console.log('Upload to CDN:');
console.log('  store/plugins/' + PLUGIN_ID + '/');
console.log('    ├── manifest.json');
console.log('    └── ' + PLUGIN_ID + '.asar');

} catch (err) {
  console.error('❌ Packaging failed:', err.message);
  process.exit(1);
}
})();
`);

// ── src/renderer.tsx ──
fs.writeFileSync(path.join(dir, 'src', 'renderer.tsx'), `import React from 'react';

function App() {
  const [result, setResult] = React.useState<string | null>(null);

  async function handleAction() {
    // Select files via Cham API
    const files = await window.cham.selectFiles();
    if (!files.length) return;

    // Call plugin's main process IPC handler
    const res = await window.cham.plugin.call('${id}', 'process', {
      paths: files.map(f => f.path),
    });
    if (res.success) setResult(res.outputPath);

    // Or read image as data URL for preview
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

// ── src/main.js ──
fs.writeFileSync(path.join(dir, 'src', 'main.js'), `// Main process module — runs in Node.js VM sandbox.
// Must be plain JavaScript (not TypeScript) for the VM sandbox.
// Full API reference: docs/plugin-api.md

module.exports = function(api) {
  // ── IPC handlers ──
  api.registerHandler('process', function (_event, params) {
    api.log.info('Processing files: ' + (params.paths ? params.paths.length : 0));

    // Image processing with sharp (same instance as host app)
    // var buf = await api.sharp(params.paths[0]).resize(100).webp().toBuffer();

    // Write result file (api.native.fs accepts absolute paths)
    // api.native.fs.writeFile('/absolute/path/output.webp', buf);

    // Save to plugin's database (declare tables in manifest.dbTables)
    // api.db.prepare('INSERT INTO plugin_${id} (key, value) VALUES (?, ?)').run('lastFile', params.paths[0]);

    return { success: true };
  });

  // ── Hooks ──
  api.registerHook('cache:clear', function () {
    api.log.info('Cache cleared');
  });

  // ── Optional cleanup ──
  return function () {
    api.log.info('Plugin deactivated');
  };
};
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
console.log('  cd ' + name);
console.log('  pnpm install');
console.log('');
console.log('Development:');
console.log('  pnpm dev                (webpack dev server with HMR)');
console.log('  pnpm build              (production build)');
console.log('');
console.log('Packaging:');
console.log('  pnpm bundle             (→ release/' + id + '.asar)');
