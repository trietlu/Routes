# Routes app (Expo)

iPhone app built with Expo SDK 57 and Expo Router. It uses **development builds only**; never use Expo Go.

## Simulator dev loop (no keys needed)

From the repo root, in two terminals:

```
npm run proxy:dev                 # proxy on :8080, PROVIDER=mock, ATTEST_MODE=off
npm run ios -w @routes/mobile     # expo run:ios: prebuild, build and launch in the simulator
```

After the first build, `npm run start -w @routes/mobile` starts Metro for the installed dev build. This needs macOS with Xcode. CI builds and runs the simulator app in the macOS job (R-24).

## Configuration

`app.config.ts` reads these at build time:

| Variable | Default | Purpose |
|---|---|---|
| `EXPO_PUBLIC_PROXY_URL` | `http://localhost:8080` | Proxy base URL |
| `EXPO_PUBLIC_APP_ENV` | `development` | `development`, `staging` or `production` |
| `EXPO_PUBLIC_MAP_PROVIDER` | `default` | `default` (Apple Maps, no key) or `google` |
| `GOOGLE_MAPS_IOS_KEY` | unset | Passed to react-native-maps only when set |
| `IOS_BUNDLE_IDENTIFIER` | `com.routes.app.dev` | iOS bundle ID |

At runtime, read them with `getAppConfig()` from `config/env.ts`.

## Layout

| Folder | Contents |
|---|---|
| `app/` | Expo Router routes, one per screen. They are placeholders until R-16 to R-23. |
| `features/` | Screen components. Text must come from `i18n/` (APP-I18N-01 fails on raw JSX strings). |
| `i18n/` | en-US strings table and `t()`. `coreT` feeds routing-core's formatters. |
| `theme/` | Light and dark color tokens (route colors A/B/C), type scale, spacing, radii and the contrast helper |
| `config/` | Runtime config from `app.config.ts` |
| `test/` | Jest setup and native-module mocks (maps, location, SQLite, linking, NetInfo) |

## Tests

Tests run from the root with `npm test`, as the `mobile` Jest project (jest-expo iOS preset plus React Native Testing Library). To run only these: `npx jest --selectProjects mobile`.

## End-to-end tests (Maestro)

The flows are in `e2e/flows` (E2E-01 to E2E-15 and E2E-17). Shared steps are in `e2e/common`. With a booted simulator running a Release build, and `npm run proxy:dev` running:

```
npm run e2e
```

**E2E-16 (offline)** needs the proxy to stop mid-flow, so it is split in two:

1. Run `maestro test apps/mobile/e2e/offline/e2e-16a-prepare.yaml`. This leaves a recent while the proxy is up.
2. Stop the proxy.
3. Run `maestro test apps/mobile/e2e/offline/e2e-16b-offline.yaml`.

The `E2E` GitHub workflow (`.github/workflows/e2e.yml`) does all of this on macOS:
- it prebuilds the app, builds it for the simulator (Release, `EXPO_PUBLIC_MAP_PROVIDER=default`, `EXPO_PUBLIC_PROXY_URL=http://localhost:8080`) and boots a simulator;
- it runs the flows;
- on failure, it uploads Maestro's screenshots and logs.
