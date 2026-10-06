# Instructions for coding agents

You are building **Routes**, an iPhone app that compares three driving routes by time or cost and hands off to Google Maps.

## Read first

| Doc | Use it for |
|---|---|
| [docs/brd.md](docs/brd.md) | What to build: requirements FR-1 to FR-22, NFR-1 to NFR-11, business rules |
| [docs/technical-design.md](docs/technical-design.md) | How to build it: stack, repo layout, proxy contract, algorithms |
| [docs/ux-sketch.md](docs/ux-sketch.md) | Screens, copy and states. The written spec beats the sketch images. |
| [docs/test-plan.md](docs/test-plan.md) | Test IDs, canonical fixture values, definition of done |
| [docs/PLAN.md](docs/PLAN.md) | Issue order and dependencies |

If the docs conflict or leave a gap that blocks you, don't guess on product behavior. Comment on the issue, add the `blocked` label and move to the next unblocked issue. Small engineering choices that the docs don't cover (library versions, file names, internal helpers) are yours to make. Note them in the PR description.

## Workflow

1. Take the lowest-numbered open issue labelled `agent` whose "Blocked by" issues are all closed.
2. Branch from `main`: `r-<id>-<short-slug>`, e.g. `r-04-ranking`.
3. Implement only that issue's scope. Out-of-scope improvements become a comment or a new issue, not part of the PR.
4. Write the tests listed in the issue. Put the test ID at the start of the test name: `it("RC-RANK-02: cheapest orders C, B, A", …)`.
5. Run locally: `npm run lint && npm run typecheck && npm test && npm run test:coverage`.
6. Open one PR per issue:
   - Title: `R-xx: <issue title>`.
   - Body: `Closes #<issue number>`, the acceptance checklist with every box ticked, and any decisions you made.
7. Keep the PR green in CI. Don't disable, skip or weaken tests or coverage thresholds to get green.
8. **Do not merge your own PRs.** The repo owner reviews and merges every PR. Request review and stop work on that issue.
9. Address review comments on your open PRs before starting anything new.
10. While a PR awaits review, you may start the next issue in the plan, but only one whose "Blocked by" issues are all **merged**. If none is unblocked, stop and wait. Don't stack branches on unmerged PRs.
11. After the owner merges, tick the item in the pinned tracking issue.

## Engineering rules

- TypeScript `strict` everywhere. No `any` unless commented why.
- **No real network calls in tests.** Stub Google with `nock` in proxy tests, and stub `fetch` or the API client in app tests.
- **No secrets in the repo.** Keys come from environment variables. `.env*` files are git-ignored, except `.env.example`.
- `packages/routing-core` stays pure. It has no React Native, Node, Expo or I/O imports.
- All user-visible strings go through the i18n strings table (NFR-11).
- Logs (proxy and app) never contain coordinates, addresses or search text (NFR-3).
- Mock mode must keep working. `npm run proxy:dev` plus the simulator must run the whole app with no keys.
- CI jobs that need secrets (EAS, Cloud Run, Sentry) must skip cleanly, not fail, when the secrets are absent.

## Environment notes

- Node 22 LTS, npm workspaces.
- Unit, integration and component tests run on Linux. iOS simulator builds and Maestro E2E need macOS with Xcode; in CI they run on the macOS job (R-24). If you can't run the simulator locally, rely on that CI job.
- Never run Expo Go. The app uses dev builds (`npx expo run:ios`, or `eas build --profile development`).
