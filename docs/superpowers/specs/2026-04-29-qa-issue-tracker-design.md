# QA Issue Tracker Agent — Design

**Date:** 2026-04-29
**Author:** Zach Wild
**Status:** Approved (pending implementation plan)

## Purpose

Track GitHub issues and PRs in `HHS/simpler-grants-gov` that are relevant to specific testers (initially: Bhavna-Ramachandran), so the user can proactively offer help. Two delivery modes:

1. **On-demand** — a Claude Code subagent that produces a fresh digest when invoked.
2. **Scheduled** — a `/schedule`d cloud routine that runs every weekday morning and updates a private gist with the latest digest.

Both modes share configuration and classification logic.

## Scope

- **In scope:** Tracking activity for a fixed list of testers across one upstream repo. Recency-tiered digest output. Gist-based daily delivery. On-demand subagent invocation.
- **Out of scope:** Multi-repo support, multi-tester teams resolved dynamically, persistent diff state ("what changed since yesterday"), Slack/email integrations, push notifications.

## Architecture

### File layout

```
.claude/
├── qa-tracker.config.yaml       # single source of truth (testers, repo, gist, signals)
└── agents/
    └── qa-tracker.md            # on-demand Claude Code subagent
```

External state:

- A private gist created via `gh gist create --secret`. Holds the current digest. Gist revision history provides day-over-day diff automatically.
- A `/schedule`d routine. Stored in the user's routines (not in the repo). Its prompt instructs the cloud agent to follow the subagent's workflow, then write the digest to the gist.

### Why this layout

- **Config separated from agent prompt:** The list of testers, gist ID, and keywords will change. YAML edits don't require touching the agent's instructions, and the scheduled routine reads the same config so the two stay in sync.
- **No shared shell script:** The agent's value is in nuanced classification of comments. Pure keyword grep would miss paraphrases like "give this a once-over before we ship?". The agent runs `gh` directly and applies LLM judgment.
- **Not in `.github/agents/`:** That directory holds GitHub Copilot agents (different runtime). Claude Code subagents live in `.claude/agents/`.

## Configuration (`.claude/qa-tracker.config.yaml`)

```yaml
# Who to track (GitHub handles)
testers:
  - Bhavna-Ramachandran

# Repo to query for issues/PRs
upstream_repo: HHS/simpler-grants-gov

# Where the scheduled routine writes the daily digest
tracking_gist:
  id: null   # filled in during setup, after the gist is created

# Recency tiers (days)
time_windows:
  hot_days: 3
  warm_days: 14

# Signals to surface (each becomes a labeled reason on a digest item)
signals:
  assignee: true        # issue/PR assigned to a tester
  mention: true         # tester @-mentioned in body or comment in window
  needs_testing: true   # comment text suggests a tester should test
  reviewer: true        # PRs only — tester is a requested reviewer

# Hints for the "needs testing" classifier (LLM-judged, not strict matching)
needs_testing_hints:
  - "ready for testing"
  - "needs QA"
  - "ready to test"
  - "please verify"
  - "can you test"
  - "ready for review"

# What to include
include_issues: true
include_prs: true
```

`needs_testing_hints` are seeds for the classifier, not a whitelist. The agent reads recent comments and uses LLM judgment to decide whether a comment is asking a tester to verify something — paraphrases are caught.

## Subagent behavior (`.claude/agents/qa-tracker.md`)

On invocation:

1. **Read config** — load `.claude/qa-tracker.config.yaml`.
2. **Run `gh search` queries per tester**, scoped to `updated:>=<warm_window_start>` against `upstream_repo`:
   - `is:open assignee:<tester>` — issues + PRs they own
   - `is:open mentions:<tester>` — anywhere they're @-mentioned
   - `is:open is:pr review-requested:<tester>` — PRs where they're a requested reviewer

   The first two queries return both issues and PRs by default. If `include_prs: false`, append `is:issue` to those queries and skip the third query entirely. If `include_issues: false`, append `is:pr` to the first two queries.
3. **Deduplicate** results by `(repo, number)`.
4. **Classify each item:**
   - **Recency tier:** Hot (≤ `hot_days`) or Warm (≤ `warm_days`), based on `updated_at`
   - **Signals fired:** any of `Assignee`, `Mentioned`, `Reviewer`, `Needs testing` — multiple can apply
   - **Needs-testing detection:** LLM-judged read of comments in window using `needs_testing_hints` as seeds. Borderline cases are marked ⚠️ Suspected with the comment quoted.
5. **Emit** a markdown digest to stdout.

### Output format

```markdown
# QA Status — Bhavna-Ramachandran (2026-04-29)

**Summary:** 2 hot · 4 warm · 1 flagged "needs testing"

## 🔥 Hot (last 3 days)

### Issues
- **#9962** Feature file for Search state persistence tests
  - Signals: Assignee
  - Last activity: 2026-04-29 by @bhavna ("Working on this — should have a draft tomorrow")

### PRs
- **#9988** Add foo to bar
  - Signals: Reviewer · ⚠️ Needs testing
  - Last activity: 2026-04-28 by @teammate ("@Bhavna please verify on staging")

## Warm (4–14 days)

### Issues
- **#9919** Align on E2E testing needs
  - Signals: Assignee
  - Last activity: 2026-04-22 by @other-tester

### PRs
- (none)
```

Behaviors:

- **Summary line** is the headline — used both at the top of the digest and as a quick-glance read.
- **`⚠️ Needs testing`** is shown inline as an additional signal on an item, not as a separate section, to keep the document scannable.
- **Empty state:** if a tester has no activity in 14 days, the digest says so plainly ("No active items in the last 14 days") rather than rendering empty sections.

## Scheduled routine

**Cadence:** Weekdays, 8:30am ET (Mon–Fri). Adjustable via `/schedule`.

**Stored prompt:**

```
Repo: HHS/simpler-grants-gov

1. Read .claude/qa-tracker.config.yaml.
2. Read .claude/agents/qa-tracker.md and follow its workflow exactly,
   producing the markdown digest.
3. If the digest reports zero hot + zero warm items, exit silently
   (do not update the gist).
4. Otherwise, overwrite the gist specified in config.tracking_gist.id
   with the new digest using `gh gist edit <id>`.
```

**Behaviors:**

- **Silent skip on empty:** No gist update when there's nothing to report. Avoids noise that would erode the signal.
- **Overwrite, not append:** The gist always holds the *current* state. Gist revision history preserves day-over-day diffs natively — `gh gist view <id> --version <sha>` retrieves any past version.

## Setup steps (one-time, in order)

1. Create a private gist:
   `gh gist create --secret --desc "QA Tracker — Bhavna" placeholder.md`
   (initial content can be `# QA Tracker — first run pending`). Note the gist ID.
2. Write `.claude/qa-tracker.config.yaml` with the testers list and the gist ID.
3. Write `.claude/agents/qa-tracker.md`.
4. **Smoke test on-demand:** invoke the subagent. Expected result: a digest mentioning the 7 issues currently assigned to Bhavna — including #9962 (hot, updated today) and #9919 (warm). If the digest matches reality, the logic is sound.
5. Create the routine via `/schedule` with the prompt above.
6. Run the routine once manually to confirm it updates the gist.

## Error handling

| Failure mode | Behavior |
|---|---|
| `gh` query returns empty for a tester | Treated as "nothing to report" — not an error |
| `needs_testing` classification is borderline | Marked ⚠️ Suspected; comment is quoted so user can judge |
| Gist deleted or inaccessible | Routine fails loudly via `/schedule`'s run log |
| Cloud routine has no `gh` auth | Routine fails loudly; `/schedule` surfaces the error |
| Tester misspelled / not in repo | `gh search` returns empty → digest says "No active items". Not loud, but noticed when no gist updates appear |
| GitHub rate limit | Extremely unlikely (<20 API calls/day). On hit: agent retries once with backoff, then errors |

## YAGNI — explicitly not building

- **No persistent diff state.** No "what changed since yesterday" — the gist's revision history covers this.
- **No retries beyond one** for rate limits.
- **No multi-repo support.** Could add a `repos:` list later if testers cover multiple repos.
- **No notifications, Slack, or email.** The gist is the only delivery channel.
- **No heartbeat** ("agent ran successfully but had nothing to report"). If signal goes silent for a week and you're suspicious, run the on-demand subagent.

## Future expansions (not in this spec)

- Adding more testers — append to `testers:` in config; no other changes needed. Digest grows a top-level section per tester.
- Multi-repo support — add `upstream_repos:` list, run queries per repo, group by repo in output.
- Heartbeat — daily "still running" ping on weekly cadence.
