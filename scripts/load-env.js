/**
 * Tiny .env loader for webpack configs — no dependency needed.
 *
 * Usage:
 *   require('./scripts/load-env')('.env.dev');
 *
 * Loads `.env.dev` first (committed defaults), then `.env` (local override,
 * gitignored). Values in `.env` override `.env.dev`. Explicit OS environment
 * variables take highest precedence.
 */
const fs = require('fs');
const path = require('path');

function loadEnv(filename) {
  const root = path.resolve(__dirname, '..');

  // 1. Load default file (committed)
  const defaultPath = path.join(root, filename);
  readEnvFile(defaultPath);

  // 2. Load .env (local override, gitignored)
  const localPath = path.join(root, '.env');
  if (fs.existsSync(localPath) && localPath !== defaultPath) {
    readEnvFile(localPath);
  }
}

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.warn(`[load-env] File not found: ${filePath}`);
    return;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;

    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();

    // Strip surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    // Only set if not already provided via the actual OS environment
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }

  console.log(`[load-env] Loaded ${path.basename(filePath)}`);
}

module.exports = loadEnv;
