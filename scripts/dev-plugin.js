#!/usr/bin/env node
/**
 * Plugin development helper.
 *
 * Watches a plugin's dist directory and copies built files to Cham's
 * plugin directory on every change, then (re)launches Cham.
 *
 * Usage:
 *   node scripts/dev-plugin.js /path/to/my-plugin
 *
 * The plugin directory must have:
 *   manifest.json
 *   dist/renderer.js   (build with webpack --watch)
 *   dist/main.js       (if applicable)
 *
 * While this script runs, webpack --watch rebuilds your plugin,
 * and this script auto-copies to Cham's plugins dir.
 */
const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');

const pluginDir = path.resolve(process.argv[2] || '.');
const manifestPath = path.join(pluginDir, 'manifest.json');

if (!fs.existsSync(manifestPath)) {
  console.error('manifest.json not found in', pluginDir);
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
const pluginId = manifest.id;

// Resolve Cham's plugin directory
const chamUserData = process.env.APPDATA
  ? path.join(process.env.APPDATA, 'cham')
  : path.join(process.env.HOME || '', '.config', 'cham');

const targetDir = path.join(chamUserData, 'plugins', pluginId);

console.log(`[dev-plugin] Watching: ${pluginDir}/dist → ${targetDir}`);
console.log('[dev-plugin] Run "pnpm dev" in Cham project to start the app.');

// Copy files initially
copyDist(pluginDir, targetDir, manifest);

// Watch for changes (simple polling)
let lastMtime = 0;
setInterval(() => {
  const distDir = path.join(pluginDir, 'dist');
  if (!fs.existsSync(distDir)) return;

  const files = fs.readdirSync(distDir);
  const latest = Math.max(...files.map((f) => {
    try { return fs.statSync(path.join(distDir, f)).mtimeMs; } catch { return 0; }
  }));

  if (latest > lastMtime) {
    lastMtime = latest;
    copyDist(pluginDir, targetDir, manifest);
    console.log('[dev-plugin] Updated:', new Date().toLocaleTimeString());
  }
}, 1000);

function copyDist(srcDir, destDir, manifest) {
  // Ensure target exists
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  // Copy manifest
  fs.writeFileSync(path.join(destDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

  // Copy i18n if present
  const i18nSrc = path.join(srcDir, 'i18n');
  const i18nDest = path.join(destDir, 'i18n');
  if (fs.existsSync(i18nSrc)) {
    if (!fs.existsSync(i18nDest)) fs.mkdirSync(i18nDest, { recursive: true });
    for (const f of fs.readdirSync(i18nSrc)) {
      fs.copyFileSync(path.join(i18nSrc, f), path.join(i18nDest, f));
    }
  }

  // Copy dist files
  const distSrc = path.join(srcDir, 'dist');
  if (fs.existsSync(distSrc)) {
    for (const f of fs.readdirSync(distSrc)) {
      fs.copyFileSync(path.join(distSrc, f), path.join(destDir, f));
    }
  }

  console.log(`[dev-plugin] Copied to ${destDir}`);
}
