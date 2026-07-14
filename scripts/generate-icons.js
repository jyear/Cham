/**
 * Generates app icons from icons/log.png using sharp.
 * - Auto-detects corner background color → transparent
 * - Trims transparent edges
 * - Pads to square → resizes exactly
 * Run: node scripts/generate-icons.js
 */
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'icons', 'log.png');
const OUT_DIR = path.join(__dirname, '..', 'assets', 'icons');
const SIZES = [16, 24, 32, 48, 64, 128, 256];
const COLOR_TOLERANCE = 50;

async function removeBg(inputPath) {
  const { data, info } = await sharp(inputPath)
    .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const pixels = new Uint8ClampedArray(data);
  const { width: w, height: h } = info;

  // Detect bg from 4 corners
  let rs = 0, gs = 0, bs = 0;
  for (const [x, y] of [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]]) {
    const i = (y * w + x) * 4;
    rs += pixels[i]; gs += pixels[i + 1]; bs += pixels[i + 2];
  }
  const bg = { r: Math.round(rs / 4), g: Math.round(gs / 4), b: Math.round(bs / 4) };
  console.log(`    bg: rgb(${bg.r},${bg.g},${bg.b})`);

  for (let i = 0; i < pixels.length; i += 4) {
    if (Math.abs(pixels[i] - bg.r) <= COLOR_TOLERANCE &&
        Math.abs(pixels[i + 1] - bg.g) <= COLOR_TOLERANCE &&
        Math.abs(pixels[i + 2] - bg.b) <= COLOR_TOLERANCE) {
      pixels[i + 3] = 0;
    }
  }

  return sharp(pixels, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();
}

async function main() {
  if (!fs.existsSync(SRC)) { console.error('Not found:', SRC); process.exit(1); }
  fs.mkdirSync(OUT_DIR, { recursive: true });

  // Step 1: remove background once (cached)
  const bgRemoved = await removeBg(SRC);

  // Step 2: trim transparent edges once
  const trimmed = await sharp(bgRemoved).trim({ threshold: 0 }).toBuffer({ resolveWithObject: true });
  const tw = trimmed.info.width, th = trimmed.info.height;
  const maxDim = Math.max(tw, th);
  const padX = Math.floor((maxDim - tw) / 2);
  const padY = Math.floor((maxDim - th) / 2);
  console.log(`    trimmed: ${tw}x${th} → square: ${maxDim}x${maxDim}`);

  // Step 3: pad to square once
  const squared = await sharp(trimmed.data)
    .extend({
      top: padY, bottom: maxDim - th - padY,
      left: padX, right: maxDim - tw - padX,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png().toBuffer();

  // Step 4: resize to each target size
  for (const size of SIZES) {
    const out = path.join(OUT_DIR, `icon-${size}x${size}.png`);
    await sharp(squared).resize(size, size).png().toFile(out);
    console.log(`  ✓ ${out}`);
  }

  const mainIcon = path.join(OUT_DIR, 'icon.png');
  await sharp(squared).resize(256, 256).png().toFile(mainIcon);
  console.log(`  ✓ ${mainIcon}`);

  // Verify
  const m = await sharp(mainIcon).metadata();
  console.log(`\n✓ Done. icon.png = ${m.width}x${m.height}.`);
  console.log('Run: npx png-to-ico assets/icons/icon-256x256.png > assets/icons/icon.ico');
}

main().catch(e => { console.error(e); process.exit(1); });
