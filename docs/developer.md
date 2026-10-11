# Routes — Developer guide

Related: [Architecture](architecture.md) · [Technical design](technical-design.md) · [Test plan](test-plan.md) · [Agent rules](../AGENTS.md)

How to set up, run, test and change the code. Everything runs on fixture data, so you need no Google keys or Apple account.

## Prerequisites

| Tool | Needed for | Install (macOS) |
|---|---|---|
| Node 22 (`.nvmrc`) and npm | Everything | `brew install nvm && nvm install 22` |
| Xcode (full app) with an iOS simulator runtime | Building and running the app | App Store; then `sudo xcodebuild -license accept`; Xcode → Settings → Components |
| CocoaPods | iOS native dependencies | `brew install cocoapods` |
| Watchman | Metro file watching (recommended) | `brew install watchman` |
| GitHub CLI | Issues and PRs | `brew install gh && gh auth login` |
| Maestro and Java 17+ | E2E flows (optional locally) | `curl -fsSL "https://get.maestro.mobile.dev" \| bash` and `brew install openjdk@17` |
| Docker | Building the proxy image locally (optional) | Docker Desktop |

Only Node is needed for the proxy, the packages and all Jest tests. They also run on Linux.

## First-time setup

```
git clone https://github.com/trietlu/Routes
cd Routes
nvm use
npm ci
npm test            # confirms the toolchain works
```

## Running the app

Use two terminals from the repo root:

```
npm run proxy:dev                  # proxy on :8080 with fixtures (PROVIDER=mock, ATTEST_MODE=off)
npm run ios -w @routes/mobile      # prebuild, compile and launch in the simulator
```

- **Set the simulator's location** to the fixture origin, Denver: Features → Location → Custom Location → **39.7392, -104.9903**. Otherwise "current location" is far from the routes drawn on the map.
- **The first build takes several minutes.** It generates `apps/mobile/ios/` (git-ignored) and installs pods. After that, `npm run start -w @routes/mobile` starts Metro for the installed build, and JS changes reload live. Rebuild with `npm run ios` only after native changes: new native modules, `app.config.ts` edits, or Expo upgrades.
- **Never use Expo Go.** The app needs a development build.

**Things to try:** search **Union**, then **Union Station**, and you get three routes (A 22 min $5.12, B 27 min $1.48, C 31 min $1.25). Edge-case destinations: **Two Routes Test**, **One Route Test**, **Unknown Toll Test**, **Near Duplicates Test**, **No Route Test**, **Error Test**, **Partial Error Test**, **Slow Test**. Expected values are in [test plan §2](test-plan.md#2-canonical-fixture-and-expected-values).

### Configuration

| Variable | Default | Effect |
|---|---|---|
| `EXPO_PUBLIC_PROXY_URL` | `http://localhost:8080` | Proxy the app calls |
| `EXPO_PUBLIC_APP_ENV` | `development` | Environment name |
| `EXPO_PUBLIC_MAP_PROVIDER` | `default` (Apple Maps) | `google` needs `GOOGLE_MAPS_IOS_KEY` |
| `PROVIDER` (proxy) | `mock` outside production | `google` needs `GOOGLE_MAPS_API_KEY` |
| `ATTEST_MODE` (proxy) | `off` | `enforce` requires App Attest |
| `RATE_LIMIT_ROUTES_PER_HOUR`, `RATE_LIMIT_PLACES_PER_HOUR` | 60, 600 | Raise them for long manual or E2E sessions |

Full lists: `apps/proxy/src/config.ts` and `apps/mobile/app.config.ts`. Put local values in `.env` files, which are git-ignored. Never commit keys.

**Testing against live Google data:** run the proxy with `PROVIDER=google GOOGLE_MAPS_API_KEY=… npm run proxy:dev`, using a dev key from H-02 (#31).

## Commands

| Command | What it does |
|---|---|
| `npm run lint` | ESLint and Prettier check (all workspaces, including Markdown) |
| `npm run format` | Prettier write |
| `npm run typecheck` | `tsc --build` for the packages and proxy, plus the app's `tsc --noEmit` |
| `npm test` | All Jest projects |
| `npm run test:coverage` | Jest with the coverage gates from the test plan (what CI runs) |
| `npm run proxy:dev` | Proxy in watch mode, mock provider |
| `npm run fixtures:generate` | Regenerate `fixtures/` from `scripts/fixtures/build.ts` |
| `npm run ios -w @routes/mobile` | Build and run the app in the simulator |
| `npm run start -w @routes/mobile` | Metro for an installed development build |

Run the same checks as CI before pushing: `npm run lint && npm run typecheck && npm run test:coverage`.

## Tests

Jest runs five projects: `routing-core`, `api-types`, `proxy`, `scripts` (fixture checks) and `mobile` (jest-expo with React Native Testing Library).

```
npx jest --selectProjects routing-core       # one project
npx jest apps/mobile/features/results        # one folder
npx jest -t "RC-RANK-02"                     # one test by ID
```

- **Test IDs.** Every test named in the [test plan](test-plan.md) starts with its ID, e.g. `it("RC-RANK-02: …")`. Add the ID when you implement a planned test. For a new test, add it to the plan.
- **No network.** Proxy tests stub Google with `nock`, and the app tests use a fake API client.
- **Coverage gates:** routing-core ≥ 95%, api-types ≥ 90%, proxy ≥ 85%, mobile non-UI modules ≥ 80%. They are set in `jest.config.js`.
- **Screen tests** render the real app with `test/appHarness.tsx`. Use the helpers in `test/flows.tsx` (`grantLocation`, `fakeRoutesClient`, `openUnionResults`, `openDetail`) to jump straight to a screen. Native modules are mocked in `apps/mobile/test/mocks/`. Check accessibility with `a11yProblems(root)` from `test/a11y.ts`; R-25 extends it to every screen.
- **E2E.** Maestro flows live in `apps/mobile/e2e/` (R-24). They need macOS, a booted simulator and `npm run proxy:dev`.

## Common changes

**Add or change copy.** Edit `apps/mobile/i18n/strings.ts` and use `t('key')` in components. Raw text in JSX under `features/` fails a test. Strings used by `routing-core` formatters are in `packages/routing-core/src/format/strings.ts`.

**Change ranking, cost or display rules.**
1. Edit `packages/routing-core`.
2. Update the expected values in [test plan §2](test-plan.md#2-canonical-fixture-and-expected-values) if they change.
3. Keep the package free of platform imports.

**Add a screen.**
1. Create `app/<route>.tsx` as a thin wrapper.
2. Put the component in `features/<screen>/`, using `t()`, theme tokens, `AppText` and `Button`.
3. Add tests through `renderApp(url)`.

**Change the database schema.** Append a new entry to `MIGRATIONS` in `apps/mobile/storage/migrations.ts`. Never edit a shipped migration. Then update the repository and its tests (`APP-STORE-*`).

**Change the proxy contract.**
1. Edit the zod schema in `packages/api-types`.
2. Update the proxy normalization and the app client.
3. Run `npm run typecheck` to find every caller.

**Change fixtures.** Edit `scripts/fixtures/build.ts`, run `npm run fixtures:generate`, and commit both. Don't hand-edit the JSON; a test fails if they drift. See [fixtures/README.md](../fixtures/README.md).

**Add a native module.** Use an Expo module if one exists. Add a mock in `apps/mobile/test/mocks/`, then rebuild the app with `npm run ios`.

## CI

`.github/workflows/ci.yml` runs on every PR and on pushes to `main`:

| Job | Runs on | Checks |
|---|---|---|
| Lint, typecheck and test | ubuntu | `npm ci`, lint, typecheck, `test:coverage` |
| Proxy Docker image | ubuntu | Builds `apps/proxy/Dockerfile`, checks `/healthz` and the non-root user |
| actionlint | ubuntu | Workflow files |
| E2E (R-24, in progress) | macOS | iOS Release build and Maestro flows against the mock proxy |

`proxy-deploy.yml` deploys the proxy after merges and skips until GCP is configured. See [deploy.md](deploy.md).

## Conventions

- TypeScript `strict`, and no `any` without a comment explaining why.
- One issue per branch and PR: branch `r-<id>-<slug>`, PR body `Closes #N`.
- No secrets in the repo, and no coordinates, addresses or search text in logs.
- Work done by the coding agent follows [AGENTS.md](../AGENTS.md); humans should follow the same rules.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `git` or `xcodebuild` errors about the Xcode license | `sudo xcodebuild -license accept` |
| `expo run:ios` fails resolving Swift packages | Expo SDK 57 needs Xcode 26 or later (Swift tools 6.2). Check with `xcodebuild -version`. |
| `apps/mobile/tsconfig.json` shows as modified after a build | Expo rewrites it. Discard with `git checkout apps/mobile/tsconfig.json`; don't commit it. |
| App shows "Couldn't load routes" or "You're offline" | Is `npm run proxy:dev` running on :8080? Check with `curl localhost:8080/healthz`. |
| Map routes are far from the blue dot | Set the simulator location to 39.7392, -104.9903. |
| `RATE_LIMITED` during long testing | Restart the proxy, or raise `RATE_LIMIT_*_PER_HOUR`. |
| Port 8080 in use | `lsof -i :8080`, then stop that process. |
| Lint fails on Markdown or JSON | `npm run format` |
