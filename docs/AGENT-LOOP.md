# Running the coding agent (Claude Code)

How to start Claude Code on the Routes build and keep it working until every agent issue is done, or until it's stuck on something that needs you.

## One-time setup (the Mac that runs the agent)

1. Install:
   - Node 22
   - Xcode, then run `sudo xcodebuild -license accept` and install an iOS simulator
   - GitHub CLI, then run `gh auth login`
   - Claude Code
2. Clone the repo: `git clone https://github.com/trietlu/Routes && cd Routes`.
3. The repo already includes:
   - `CLAUDE.md`, which loads `AGENTS.md` (the agent's rules) into every session.
   - `.claude/settings.json`, a permission allowlist so the agent can run npm, git, gh, Maestro and Xcode tools, and edit files, without prompting. It denies sudo, force pushes, direct pushes to `main`, repo deletion or settings changes, secrets, and reading `.env` files.
4. Keep the Mac awake while the agent runs, e.g. `caffeinate -dims` in a separate terminal.

## Start the agent

Run `claude` in the repo folder and paste:

```
/loop Work the Routes build per AGENTS.md and the pinned tracking issue #38.
Each iteration:
1. If you have an open PR, get its CI green and merge it per AGENTS.md
   (squash, delete branch), then tick it on #38.
2. Otherwise take the lowest-numbered open `agent` issue whose blocking
   issues are all closed (see its "Blocked by" section or GitHub
   dependencies) and that isn't labelled `blocked`. Implement it per
   AGENTS.md, open a PR, and continue with step 1.
3. If CI is still running, schedule a short wakeup and check again.
4. If you're stuck (doc gap, needs a human, or CI still failing after
   three real attempts), follow the "When you're stuck" rules in
   AGENTS.md and move on.
Stop the loop when every `agent` issue is closed, or when none of the
remaining ones is actionable. Then post a summary on #38 of what was
done and what's blocked, and why.
```

## While it runs

- **Progress:** watch the checklist on [#38](https://github.com/trietlu/Routes/issues/38), merged PRs, and closed issues.
- **What needs you:** issues labelled [`blocked`](https://github.com/trietlu/Routes/issues?q=is%3Aopen+label%3Ablocked). Unblock one by answering in a comment and removing the label. A running loop picks it up on its next iteration. If the loop has stopped, restart it.
- **Resuming:** if the terminal closes or the Mac sleeps, the loop stops. Run `claude` again and paste the same `/loop` prompt. All state lives in GitHub, so the agent picks up where it left off.
- **Long runs:** Claude Code summarizes older conversation automatically. The issues, docs and `AGENTS.md` hold everything the agent needs to re-orient.

## Notes

- There is no human review: the agent merges its own PRs once CI is green. CI and the [test plan](test-plan.md) are the quality gate. It's worth skimming merged PRs now and then, especially #4 (R-04, ranking) and #19 (R-19, results cards).
- The `needs-human` issues (#30 to #37) run in parallel and don't block the agent's build. They're listed in [GETTING-STARTED.md](GETTING-STARTED.md).
- **Fully hands-off option:** instead of the allowlist, run `claude --dangerously-skip-permissions`. Do this only in a VM or a separate macOS user account with nothing else valuable on it.
