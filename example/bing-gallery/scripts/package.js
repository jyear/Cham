/**
 * Bing Gallery — Production Packaging Script
 *
 * Builds the plugin and creates the ASAR + companion folder structure
 * ready for upload to CDN.
 *
 * Output (release/):
 *   bing-gallery.asar         ← Code, i18n, manifest (read-only)
 *   bing-gallery/             ← Companion folder
 *     dependence/
 *       windows-wallpaper-x86-64.exe
 *
 * Usage:
 *   node scripts/package.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const asar = require('@electron/asar');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const RELEASE = path.join(ROOT, 'release');
const STAGING = path.join(RELEASE, '.asar-staging');
const PLUGIN_ID = 'bing-gallery';
const ASAR_PATH = path.join(RELEASE, `${PLUGIN_ID}.asar`);

(async () => {
try {

// ── Step 1: Build ──
console.log('[1/4] Building plugin...');
execSync('npx webpack --mode production --config webpack.config.js', {
  cwd: ROOT,
  stdio: 'inherit',
});

// ── Step 2: Clean previous outputs ──
console.log('[2/4] Cleaning previous outputs...');
fs.mkdirSync(RELEASE, { recursive: true });
// Remove only the files we generate (avoid EPERM on locked .asar)
for (const name of [ASAR_PATH, STAGING]) {
  try {
    if (fs.existsSync(name)) fs.rmSync(name, { recursive: true, force: true });
  } catch (e) {
    // If a file is locked (e.g. antivirus), overwrite it later instead
    console.warn(`  ⚠ Could not remove ${path.basename(name)}, will overwrite`);
  }
}

// ── Step 3: Assemble staging dir (dist/ → staging) ──
console.log('[3/4] Assembling .asar contents...');
fs.mkdirSync(STAGING, { recursive: true });

// Copy dist/ → staging (skip dev-only files).
// Webpack already copied the binary into dist/dependence/, so it comes along.
// On install, extractBinaryFiles() copies it from .asar → companion folder.
function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      if (entry.name.endsWith('.dev.js') || entry.name.endsWith('.LICENSE.txt')) continue;
      fs.copyFileSync(srcPath, destPath);
    }
  }
}
copyDir(DIST, STAGING);

// ── Step 4: Create .asar from staging ──
console.log('[4/4] Creating .asar...');
await asar.createPackage(STAGING, ASAR_PATH);
console.log(`  → ${ASAR_PATH}`);

// Clean up staging
fs.rmSync(STAGING, { recursive: true, force: true });

// ── Step 5: Copy manifest.json to release (for CDN store discovery) ──
const manifestSrc = path.join(DIST, 'manifest.json');
const manifestDest = path.join(RELEASE, 'manifest.json');
fs.copyFileSync(manifestSrc, manifestDest);
console.log(`  → ${manifestDest}`);

// ── Done ──
console.log('');
console.log('✅ Packaging complete!');
console.log(`  → ${ASAR_PATH}`);
console.log(`  → ${manifestDest}`);
console.log('');
console.log('Upload to CDN:');
console.log(`  store/plugins/${PLUGIN_ID}/`);
console.log(`    ├── manifest.json`);
console.log(`    └── ${PLUGIN_ID}.asar`);
console.log('');
console.log('At install time, binaryFiles (listed in manifest) are extracted');
console.log('from the .asar into the companion folder automatically.');
console.log('');

} catch (err) {
  console.error('❌ Packaging failed:', err.message);
  process.exit(1);
}
})();
