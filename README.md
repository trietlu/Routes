# Routes

An iPhone app that shows drivers three routes to a destination, ranked **Fastest** or **Cheapest** (tolls plus estimated fuel), then hands the chosen route to Google Maps for navigation.

## Docs

- [Getting started (owner handoff)](docs/GETTING-STARTED.md)
- [Running the coding agent](docs/AGENT-LOOP.md)

- [Business requirements](docs/brd.md)
- [Technical design](docs/technical-design.md)
- [UX sketch](docs/ux-sketch.md)
- [Plan of action](docs/PLAN.md)
- [Test plan](docs/test-plan.md)
- [Instructions for coding agents](AGENTS.md)

## Repository layout

npm workspaces, Node 22 LTS (see `.nvmrc`).

| Path | What it is |
|---|---|
| `apps/mobile/` | The Expo app (contents land in R-11) |
| `apps/proxy/` | Node/TypeScript service for Cloud Run |
| `packages/routing-core/` | Pure TypeScript: decode, dedupe, cost, rank, diff, format |
| `packages/api-types/` | Request and response types plus zod schemas shared by app and proxy |
| `fixtures/` | Provider responses used by mock mode and tests |

## Getting started

```sh
nvm use      # Node 22
npm ci
```

## Scripts

Run these from the repo root; they cover every workspace.

| Command | What it runs |
|---|---|
| `npm run lint` | ESLint and a Prettier formatting check |
| `npm run typecheck` | `tsc --build` across all TypeScript projects |
| `npm test` | Jest (unit, integration and component tests) |
| `npm run test:coverage` | Jest with the test plan's coverage gates enforced |
| `npm run format` | Rewrites files with Prettier |

Coverage gates come from the [test plan](docs/test-plan.md#1-test-levels) and are enforced per package: `routing-core` ≥ 95%, `api-types` ≥ 90%, `proxy` ≥ 85%.

CI (`.github/workflows/ci.yml`) runs `lint`, `typecheck` and `test:coverage` on Ubuntu with Node 22, for every pull request and every push to `main`.

## Status

In development. Work is tracked in GitHub issues; see the pinned tracking issue for order and progress.
