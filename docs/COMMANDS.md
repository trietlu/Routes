# Routes — Command reference

Related: [Developer guide](developer.md) (explanations) · [Device testing](DEVICE-TESTING.md) (simulator and real iPhone) · [Integration tests](INTEG.md) (E2E details) · [Deploy](deploy.md)

Copy-paste commands for everyday work. Run everything **from the repo root** (`~/projects/Routes`) unless noted. `-w @routes/mobile` runs a script in the app's workspace (`apps/mobile`).

## Set up

| Task | Command |
|---|---|
| Get the code | `git clone https://github.com/trietlu/Routes && cd Routes` |
| Use the right Node version (22) | `nvm use` |
| Install all dependencies, exactly as in the lockfile | `npm ci` |
| After pulling changes | `git pull && npm ci` |
| Accept the Xcode license (once per Xcode install) | `sudo xcodebuild -license accept` |

## Run the proxy

Run it in its own terminal; leave it running while you use the app. It listens on `http://localhost:8080`.

| Task | Command |
|---|---|
| Fake data (fixtures, no keys) | `npm run proxy:dev` |
| Real Google data (needs `GOOGLE_MAPS_API_KEY=…` in `.env`) | `npm run proxy:live` |
| Check it's up | `curl localhost:8080/healthz` (expects `{"ok":true}`) |
| Raise rate limits for long sessions | `RATE_LIMIT_ROUTES_PER_HOUR=10000 RATE_LIMIT_PLACES_PER_HOUR=10000 npm run proxy:dev` |
| Free port 8080 | `lsof -i :8080`, then `kill <PID>` |

## Build and run the app (iOS Simulator)

| Task | Command |
|---|---|
| Build, install and launch, then start Metro | `npm run ios -w @routes/mobile` |
| Start Metro only (app already installed) | `npm run start -w @routes/mobile` |
| Rebuild the native project from scratch (after an Expo upgrade, `app.config.ts` changes, or odd build errors) | `rm -rf apps/mobile/ios && npm run ios -w @routes/mobile` |
| Set the simulator to the fixture origin (Denver) | `xcrun simctl location booted set 39.7392,-104.9903` |
| Use Google map tiles (needs `GOOGLE_MAPS_IOS_KEY` in `apps/mobile/.env`) | Add `EXPO_PUBLIC_MAP_PROVIDER=google` to `apps/mobile/.env`, then rebuild |
| Discard Expo's rewrite of `tsconfig.json` (if it appears) | `git checkout apps/mobile/tsconfig.json` |

A full first run is two terminals: `npm run proxy:dev` in one, `npm run ios -w @routes/mobile` in the other.

## Check code (what CI runs on every PR)

| Task | Command |
|---|---|
| Everything CI checks | `npm run lint && npm run typecheck && npm run test:coverage` |
| Lint (ESLint and Prettier check) | `npm run lint` |
| Auto-format | `npm run format` |
| Type-check all workspaces | `npm run typecheck` |

## Test (Jest)

| Task | Command |
|---|---|
| All tests | `npm test` |
| All tests with coverage gates | `npm run test:coverage` |
| One project (`mobile`, `proxy`, `routing-core`, `api-types`, `scripts`) | `npm test -- --selectProjects proxy` |
| One file or folder | `npm test -- apps/mobile/test/home.test.tsx` |
| One test by ID or name | `npm test -- -t "APP-LOC-04"` |
| Re-run on save | `npm test -- --watch` |

## E2E (Maestro): manual, not a merge gate

Needs macOS, Xcode 26 or 27, Maestro and Java 17. Details are in [INTEG.md](INTEG.md).

| Task | Command |
|---|---|
| All flows locally (proxy running, app installed in a booted simulator) | `npm run e2e` |
| One flow | `maestro test apps/mobile/e2e/flows/e2e-04-search-results.yaml` |
| With the driver-startup retry CI uses | `bash apps/mobile/e2e/run-maestro.sh apps/mobile/e2e/flows` |
| Explore the screen and selectors interactively | `maestro studio` |
| Run the E2E workflow on GitHub (about an hour) | `gh workflow run E2E --repo trietlu/Routes --ref main` |
| Watch that run | `gh run watch --repo trietlu/Routes` |

## Fixtures

| Task | Command |
|---|---|
| Regenerate `fixtures/` after editing `scripts/fixtures/build.ts` | `npm run fixtures:generate` |

## Proxy container (Docker)

| Task | Command |
|---|---|
| Build the image (as CI does) | `docker build -f apps/proxy/Dockerfile -t routes-proxy .` |
| Run it with fake data | `docker run --rm -p 8080:8080 -e PROVIDER=mock routes-proxy` |

## GitHub

| Task | Command |
|---|---|
| Your open PRs and their checks | `gh pr list --repo trietlu/Routes` then `gh pr checks <number> --repo trietlu/Routes` |
| Issues waiting on you | `gh issue list --repo trietlu/Routes --label needs-human` |
| Blocked issues | `gh issue list --repo trietlu/Routes --label blocked` |
| The tracking issue | `gh issue view 38 --repo trietlu/Routes` |

## Xcode, devices and simulators

The full diagnostic list is in [DEVICE-TESTING.md → Diagnostic commands](DEVICE-TESTING.md#diagnostic-commands-xcode-and-simulator). The most useful:

| Task | Command |
|---|---|
| Xcode and Swift versions | `xcodebuild -version` · `xcrun swift --version` |
| Does Xcode see my iPhone? (look for `physical`) | `xcrun devicectl list devices` |
| Grant location to the app in the simulator | `xcrun simctl privacy booted grant location com.routes.app.dev` |
| Stream the app's logs from the simulator | `xcrun simctl spawn booted log stream --predicate 'process == "Routes"'` |
| Open the project in Xcode (for signing) | `open apps/mobile/ios/Routes.xcworkspace` |

## Clean up disk space

These are safe; everything is rebuilt or re-downloaded when needed.

| Task | Command |
|---|---|
| Generated iOS project | `rm -rf apps/mobile/ios` |
| Xcode build cache | `rm -rf ~/Library/Developer/Xcode/DerivedData` |
| Simulators whose iOS version is gone | `xcrun simctl delete unavailable` |
| npm cache | `npm cache clean --force` |
| CocoaPods cache | `pod cache clean --all` |
| Old simulator runtimes (list, then delete by ID) | `xcrun simctl runtime list`, then `xcrun simctl runtime delete <ID>` |
| Release space held by local Time Machine snapshots | `sudo tmutil deletelocalsnapshots /` |
