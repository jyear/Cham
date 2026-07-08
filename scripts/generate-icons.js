/**
 * Generates app icons from icons/cham.png using sharp.
 * Run: node scripts/generate-icons.js
 */
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'icons', 'cham.png');
const OUT_DIR = path.join(__dirname, '..', 'assets');
const WEB_OUT = path.join(__dirname, '..', 'web');

const SIZES = [16, 24, 32, 48, 64, 128, 256];

async function main() {
  if (!fs.existsSync(SRC)) {
    console.error('Source icon not found:', SRC);
    process.exit(1);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });

  // Generate resized PNGs
  for (const size of SIZES) {
    const out = path.join(OUT_DIR, `icon-${size}x${size}.png`);
    await sharp(SRC).resize(size, size).png().toFile(out);
    console.log(`  ✓ ${out}`);
  }

  // Main icon (256x256)
  const mainIcon = path.join(OUT_DIR, 'icon.png');
  await sharp(SRC).resize(256, 256).png().toFile(mainIcon);
  console.log(`  ✓ ${mainIcon}`);

  // Favicon is handled by HtmlWebpackPlugin → webpack.web.config.js

  console.log('\n✓ All PNG icons generated in assets/');
  console.log('Tip: Run "npx png-to-ico assets/icon-256x256.png > assets/icon.ico" for Windows .ico');
  console.log('     electron-builder accepts .png as icon on all platforms.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
