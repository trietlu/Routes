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

If the docs conflict or leave a gap that blocks you, don't guess on product behavior; treat it as stuck (see Workflow). Small engineering choices that the docs don't cover (library versions, file names, internal helpers) are yours to make. Note them in the PR description.

## Autonomy

You run unattended, and nobody is watching the session. **Never ask for confirmation or permission to continue** ("Shall I proceed?", "Want me to…?"). Make the call, note any judgment calls in the PR description, and keep going. The only reasons to stop are listed under "When you're stuck" and in the run's stop condition. If something needs the owner, put it in a GitHub comment and label the issue `blocked`; don't ask in chat.

## Workflow

1. Take the lowest-numbered open issue labelled `agent` whose "Blocked by" issues are all closed.
2. Branch from `main`: `r-<id>-<short-slug>`, e.g. `r-04-ranking`.
3. Implement only that issue's scope. Out-of-scope improvements become a comment or a new issue, not part of the PR.
4. Write the tests listed in the issue. Put the test ID at the start of the test name: `it("RC-RANK-02: cheapest orders C, B, A", …)`.
5. Run locally: `npm run lint && npm run typecheck && npm test && npm run test:coverage`.
6. Open one PR per issue:
   - Title: `R-xx: <issue title>`.
   - Body: `Closes #<issue number>`, the acceptance checklist with every box ticked, and any decisions you made.
7. Wait for CI and get it green. Don't disable, skip or weaken tests, lint rules or coverage thresholds to get green.
8. **Merge your own PR** once every CI check passes and every acceptance box is genuinely satisfied: `gh pr merge --squash --delete-branch`. The owner does not review PRs. CI and the test plan are the gate, so hold yourself to them.
9. After merging, update local `main`, confirm the issue closed, and tick its item in the pinned tracking issue (#38).
10. Then take the next issue. Work one issue at a time; don't stack branches on unmerged PRs.

**When you're stuck.** Stuck means a doc gap or conflict on product behavior, a requirement that needs a human (accounts, keys, devices), or CI still failing after three honest attempts at a fix. When stuck:

- Comment on the issue with what you tried and what's needed, and add the `blocked` label.
- Close any half-finished PR, or leave it as a draft.
- Move on to the next issue whose blockers are all closed. An issue labelled `blocked` counts as not closed, so anything depending on it waits.

Stop when no open `agent` issue is actionable, and summarize what's left in a comment on #38.

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
