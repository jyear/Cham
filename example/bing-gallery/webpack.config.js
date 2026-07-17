const path = require('path');
const fs = require('fs');

/**
 * Copies static plugin files into dist/ on every build.
 * - src/main/index.js → dist/main.js
 * - manifest.json → dist/manifest.json
 */
class CopyPluginFiles {
  constructor(files) {
    this.files = files;
  }
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
            console.log(`[plugin] ${from} → ${to}`);
          }
        } catch (err) {
          console.warn(`[plugin] Copy ${from} failed:`, err.message);
        }
      }
    });
    compiler.hooks.afterCompile.tap('CopyPluginFiles', (compilation) => {
      for (const { from } of this.files) {
        compilation.fileDependencies.add(path.resolve(__dirname, from));
      }
    });
  }
}

const sharedModuleRules = [
  {
    test: /\.tsx?$/,
    use: 'ts-loader',
    exclude: /node_modules/,
  },
  {
    test: /\.css$/,
    use: [
      'style-loader',
      {
        loader: 'css-loader',
        options: { modules: false },
      },
    ],
  },
];

const sharedResolve = {
  extensions: ['.tsx', '.ts', '.js'],
  alias: {
    '@': path.resolve(__dirname, 'src/renderer'),
  },
};

module.exports = [
  // ── Production build (self-contained, bundles all deps) ──
  {
    mode: 'production',
    target: 'web',
    devtool: false,
    entry: './src/renderer/index.tsx',
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'renderer.js',
    },
    resolve: sharedResolve,
    module: { rules: sharedModuleRules },
    plugins: [
      new CopyPluginFiles([
        { from: 'src/main/index.js', to: 'dist/main.js' },
        { from: 'manifest.json', to: 'dist/manifest.json', transform: (c) => {
    const m = JSON.parse(c);
    delete m.devServer;  // strip dev-only field for store distribution
    return JSON.stringify(m, null, 2);
  }},
        { from: 'i18n/en.json', to: 'dist/i18n/en.json' },
        { from: 'i18n/zh.json', to: 'dist/i18n/zh.json' },
        { from: 'node_modules/wallpaper/source/windows-wallpaper-x86-64.exe', to: 'dist/dependence/windows-wallpaper-x86-64.exe' },
      ]),
    ],
  },

  // ── Development build (for iframe HMR, also self-contained) ──
  {
    mode: 'development',
    target: 'web',
    devtool: 'eval-source-map',
    entry: './src/renderer/index.tsx',
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'renderer.dev.js',
    },
    resolve: sharedResolve,
    module: { rules: sharedModuleRules },
    devServer: {
      port: 3001,
      hot: true,
      allowedHosts: 'all',
      headers: { 'Access-Control-Allow-Origin': '*' },
    },
  },
];
