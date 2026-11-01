// Renders the app artwork from SVG to PNG: `npm run icons` (from the repo root).
//
// Sources (apps/mobile/assets):
//   icon.svg                    → icon.png: 1024×1024, opaque RGB (the App Store rejects
//                                 icons with an alpha channel; iOS rounds the corners itself)
//   splash.svg, splash-dark.svg → splash-icon.png, splash-icon-dark.png: transparent, shown
//                                 centred on the splash background (expo-splash-screen)
//
// The splash text uses macOS system fonts (SF Pro for the tagline, Helvetica Neue Bold for
// "Routes"), so render on a Mac. Elsewhere, resvg falls back to other fonts and the
// splash text will look different.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
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
const ICON_BACKGROUND = '#EDE7DD';
const SF_PRO = '/System/Library/Fonts/SFNS.ttf';
const font = {
  fontFiles: existsSync(SF_PRO) ? [SF_PRO] : [],
  loadSystemFonts: true,
  defaultFontFamily: 'Helvetica Neue',
};

const readSvg = (file) => readFileSync(join(assets, file), 'utf8');

/** Renders an SVG file to an opaque RGB PNG of the given width. */
function renderOpaque(svgFile, pngFile, width) {
  const rendered = new Resvg(readSvg(svgFile), {
    fitTo: { mode: 'width', value: width },
    background: ICON_BACKGROUND,
  }).render();
  const rgba = PNG.sync.read(rendered.asPng());
  const rgb = PNG.sync.write(rgba, { colorType: 2, inputColorType: 6, inputHasAlpha: true });
  writeFileSync(join(assets, pngFile), rgb);
  console.log(`${svgFile} → ${pngFile} (${rgba.width}×${rgba.height}, RGB)`);
}

/** Renders an SVG file to a transparent PNG of the given width, with system fonts. */
function renderTransparent(svgFile, pngFile, width) {
  const rendered = new Resvg(readSvg(svgFile), {
    fitTo: { mode: 'width', value: width },
    font,
  }).render();
  writeFileSync(join(assets, pngFile), rendered.asPng());
  console.log(`${svgFile} → ${pngFile} (${rendered.width}×${rendered.height}, transparent)`);
}

if (!existsSync(SF_PRO)) {
  console.warn('SF Pro not found (not macOS?): splash text will use fallback fonts.');
}
renderOpaque('icon.svg', 'icon.png', 1024);
renderTransparent('splash.svg', 'splash-icon.png', 800);
renderTransparent('splash-dark.svg', 'splash-icon-dark.png', 800);
