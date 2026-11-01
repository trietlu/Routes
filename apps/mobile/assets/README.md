# App artwork

| File | What | Used by |
|---|---|---|
| `icon.svg` | **Source** for the app icon: three routes (A blue, B green, C orange) on a street grid, from a start dot to a destination pin | — |
| `icon.png` | Rendered icon: 1024×1024, opaque RGB (no alpha channel, no rounded corners) | `icon` in `app.config.ts`; Expo generates every iOS size at prebuild |
| `splash.svg` / `splash-dark.svg` | **Sources** for the splash screen: the icon's routes and pin (no grid), the word "Routes" and the tagline "Get there fast or cheap". The dark version uses the dark-theme colours. | — |
| `splash-icon.png` / `splash-icon-dark.png` | Rendered splash images: 800×1180, transparent, shown 220 pt wide on `#FAF7F2` (light) or `#121212` (dark) | `expo-splash-screen` plugin in `app.config.ts` |

## Changing the artwork

1. Edit the SVGs (any editor, or by hand; they're plain SVG).
2. From the repo root, **on a Mac**, run:

   ```
   npm run icons
   ```

   This installs the render tools in `tools/icons/` (kept separate from the app's dependencies) and writes all the PNGs.
   - The icon is opaque RGB because the App Store rejects icons with an alpha channel.
   - The splash text uses macOS fonts: **Helvetica Neue Bold** for "Routes" and **SF Pro** for the tagline. On other systems the text renders in fallback fonts and will look different.
3. Commit the SVGs and the PNGs.
4. Icons and splash screens are native configuration, so rebuild to see changes: `rm -rf apps/mobile/ios && npm run ios -w @routes/mobile`.

Tests APP-CFG-02 (icon is a 1024×1024 RGB PNG) and APP-CFG-03 (splash configured, images present) check the setup. APP-SPL-01 checks that the splash stays up until storage has opened.
