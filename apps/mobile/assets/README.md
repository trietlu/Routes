# App artwork

| File | What | Used by |
|---|---|---|
| `icon.svg` | **Source** for the app icon: three routes (A blue, B green, C orange) on a street grid, from a start dot to a destination pin | — |
| `icon.png` | Rendered icon: 1024×1024, opaque RGB (no alpha channel, no rounded corners) | `icon` in `app.config.ts`; Expo generates every iOS size at prebuild |

## Changing the artwork

1. Edit the SVG (any editor, or by hand; it's plain SVG).
2. From the repo root, run:

   ```
   npm run icons
   ```

   This installs the render tools in `tools/icons/` (kept separate from the app's dependencies) and writes the PNGs. They're opaque RGB because the App Store rejects icons with an alpha channel.
3. Commit both the SVG and the PNG.
4. The icon is native configuration, so rebuild to see it: `rm -rf apps/mobile/ios && npm run ios -w @routes/mobile`.

Test APP-CFG-02 checks that the icon is configured and is a 1024×1024 RGB PNG.
