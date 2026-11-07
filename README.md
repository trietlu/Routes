# Routes

An iPhone app that shows drivers three routes to a destination, ranked **Fastest** or **Cheapest** (tolls plus estimated fuel), then hands the chosen route to Google Maps for navigation.

**New here? Read [docs/OVERVIEW.md](docs/OVERVIEW.md).** It covers the design, tech stack, file layout, build and release flow, and the Expo, Google Cloud and Apple setup, and links to every other doc.

## Quick start (simulator, no keys needed)

```sh
nvm use                          # Node 22
npm ci
npm run proxy:dev                # terminal 1: proxy with fixture data on :8080
npm run ios -w @routes/mobile    # terminal 2: build, launch in the simulator, start Metro
```

Needs macOS with Xcode 26 or later and CocoaPods. See [docs/developer.md](docs/developer.md) for prerequisites, and [docs/COMMANDS.md](docs/COMMANDS.md) for every everyday command.

## Repository layout

| Path | What it is |
|---|---|
| `apps/mobile/` | The iPhone app (Expo SDK 57, React Native, Expo Router) |
| `apps/proxy/` | Fastify service on Cloud Run that fronts Google Routes and Places |
| `packages/routing-core/` | Pure TypeScript: decode, dedupe, cost, rank, format |
| `packages/api-types/` | zod schemas and types shared by app and proxy |
| `fixtures/` | Google-format responses for mock mode and tests |
| `docs/` | [Overview](docs/OVERVIEW.md) and detailed docs |

## Checks (what CI runs)

```sh
npm run lint && npm run typecheck && npm run test:coverage
```

Coverage gates: `routing-core` ≥ 95%, `api-types` ≥ 90%, `proxy` ≥ 85%, mobile non-UI modules ≥ 80%.

## Status

The app is feature-complete. The proxy runs on Cloud Run, and store builds go to TestFlight through EAS. Remaining launch work is tracked in GitHub issues; see the pinned tracker [#38](https://github.com/trietlu/Routes/issues/38).
