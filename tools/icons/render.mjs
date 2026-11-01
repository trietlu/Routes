// Renders the app artwork from SVG to PNG: `npm run icons` (from the repo root).
//
// Source: apps/mobile/assets/icon.svg
// Output: apps/mobile/assets/icon.png, 1024×1024, opaque RGB (the App Store
// rejects icons with an alpha channel; iOS rounds the corners itself).
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';
import { PNG } from 'pngjs';

const assets = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'apps',
  'mobile',
  'assets',
);
const BACKGROUND = '#EDE7DD';

/** Renders an SVG file to an opaque RGB PNG of the given width. */
function renderOpaque(svgFile, pngFile, width) {
  const svg = readFileSync(join(assets, svgFile), 'utf8');
  const rendered = new Resvg(svg, {
    fitTo: { mode: 'width', value: width },
    background: BACKGROUND,
  }).render();
  const rgba = PNG.sync.read(rendered.asPng());
  const rgb = PNG.sync.write(rgba, { colorType: 2, inputColorType: 6, inputHasAlpha: true });
  writeFileSync(join(assets, pngFile), rgb);
  console.log(`${svgFile} → ${pngFile} (${rgba.width}×${rgba.height}, RGB)`);
}

renderOpaque('icon.svg', 'icon.png', 1024);
