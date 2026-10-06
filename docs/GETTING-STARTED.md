# Getting started — owner handoff

Status as of Oct 6, 2026: the docs are on `main` and all work is filed as GitHub issues. No code has been written yet.

## What's in the repo

| File | Contents |
|---|---|
| [docs/brd.md](brd.md) | Business requirements: FR-1 to FR-22, NFRs, business rules |
| [docs/technical-design.md](technical-design.md) | Stack, repo layout, proxy contract, algorithms |
| [docs/ux-sketch.md](ux-sketch.md) | Screens 1–5, supporting screens S1–S3, all states and copy; images in `docs/ux/` |
| [docs/PLAN.md](PLAN.md) | Build order, dependency graph, milestones |
| [docs/test-plan.md](test-plan.md) | About 170 test IDs (unit, proxy, component, E2E, manual), canonical fixture values, requirement-to-test traceability |
| [AGENTS.md](../AGENTS.md) | Working rules for the coding agent |

## Issues

| Issues | Label | What |
|---|---|---|
| #1 – #29 | `agent` | The build, in order. Each issue has scope, acceptance criteria, test IDs and "Blocked by" links. |
| #30 – #37 | `needs-human` | Owner tasks (see below) |
| #38 | `tracking` (pinned) | Ordered checklist of every issue |

Each title starts with a stable ID: **R-xx** for agent issues, **H-xx** for human ones. The docs refer to issues by these IDs. R-01 to R-29 are issues #1 to #29, H-01 to H-08 are #30 to #37, and the tracking issue is #38.

The agent build goes through these phases:

1. Monorepo setup and CI (#1–#2)
2. Ranking and cost logic (#3–#5)
3. Proxy in mock mode (#6–#10)
4. App foundation (#11–#15)
5. Screens (#16–#23)
6. E2E tests, accessibility, privacy and App Attest (#24–#27)
7. Build and deploy workflows (#28–#29)

## How the agent works

- One issue per PR. Branch name: `r-<id>-<slug>`. The PR body says `Closes #N` and includes the ticked acceptance checklist.
- **The agent never merges.** The owner reviews and merges every PR.
- While a PR waits for review, the agent may start the next issue whose blockers are already merged; otherwise it waits. Review speed sets the build pace.
- It can't build or test on real Google data, Apple accounts or devices. Everything runs against a mock proxy with fixture data, so issues #1–#29 need no keys or accounts. Deploy and build workflows skip cleanly until secrets exist.
- iOS simulator builds and Maestro E2E tests need macOS. If the agent's machine isn't a Mac, it relies on the macOS CI job added in #24, which uses paid GitHub macOS runners.

## Your next steps

1. **On the new computer:**

   ```
   git clone https://github.com/trietlu/Routes
   gh auth login
   ```

   On a Mac, also accept the Xcode license (`sudo xcodebuild -license accept`), or git won't run.
2. **Start the agent:** point it at `AGENTS.md` and issue #38, and tell it to begin with #1.
3. **Start the slow human tasks early**, since account approvals can take days:
   - #31 (H-02): Google Cloud projects, APIs, keys, budgets
   - #32 (H-03): Apple Developer, App Store Connect, Expo/EAS accounts, GitHub secrets
4. **Confirm the proposed values** in #30 (H-01): 10 recents, 80% overlap threshold, 25 mpg at $3.50/gal, iOS 16+, 3 s and 500 ms performance targets, rate limits. They're constants in code, so they can change any time before beta.
5. **The other human tasks:**

   | Issue | Task | When |
   |---|---|---|
   | #33 (H-04) | Cloud Run infrastructure | After #31 |
   | #34 (H-05) | Sentry | Any time |
   | #35 (H-06) | Legal review of Google Maps Platform terms | Before beta |
   | #36 (H-07) | Live-data validation and overlap tuning | Before beta |
   | #37 (H-08) | Device QA, TestFlight and App Store submission | At launch |

## Editing the plan

GitHub issues are the source of truth for the work. To change scope, edit the issue directly, and update `docs/PLAN.md` or `docs/test-plan.md` if the order or tests change.
