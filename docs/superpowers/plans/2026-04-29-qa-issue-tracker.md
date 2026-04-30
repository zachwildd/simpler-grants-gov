# QA Issue Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Claude Code subagent + a `/schedule`d cloud routine that surface GitHub issues/PRs in `HHS/simpler-grants-gov` relevant to a configured list of testers (initially Bhavna-Ramachandran), delivered via a private gist updated each weekday morning.

**Architecture:** A single YAML config (`.claude/qa-tracker.config.yaml`) holds testers, gist ID, time windows, and signal toggles. A Claude Code subagent (`.claude/agents/qa-tracker.md`) reads the config, runs `gh search` queries against `HHS/simpler-grants-gov`, classifies each result by recency tier (hot / warm) and signal type (assignee, mention, reviewer, needs-testing), and emits a markdown digest. A `/schedule`d cloud routine runs the same workflow daily and overwrites the gist with the result.

**Tech Stack:** YAML, Markdown, `gh` CLI, GitHub Gists, Claude Code subagents, `/schedule` routines.

**Spec:** [docs/superpowers/specs/2026-04-29-qa-issue-tracker-design.md](../specs/2026-04-29-qa-issue-tracker-design.md)

---

## File Structure

| Path | Purpose |
|---|---|
| `.claude/qa-tracker.config.yaml` | Single source of truth: testers, gist ID, windows, signals |
| `.claude/agents/qa-tracker.md` | Claude Code subagent definition (frontmatter + workflow prompt) |
| `.claude/qa-tracker.routine-prompt.md` | The prompt to paste into `/schedule` when creating the routine. Lives in repo for reproducibility. |

External (not in repo):
- A private gist (created via `gh gist create --secret`)
- A `/schedule` routine (created by user via `/schedule`)

---

## Task 1: Create the private gist

**Files:**
- (None — this creates external state, the gist ID is captured for use in Task 2.)

- [ ] **Step 1: Create the gist with placeholder content**

Run:
```bash
echo '# QA Tracker — first run pending' | gh gist create --secret --desc "QA Tracker — Bhavna" --filename qa-status.md -
```

Expected output: a URL like `https://gist.github.com/zachwildd/<32-hex-id>`. Copy the 32-hex ID from the URL.

- [ ] **Step 2: Verify the gist exists and is private**

Run:
```bash
gh gist view <gist-id> --files
gh api gists/<gist-id> -q '.public'
```

Expected: file list shows `qa-status.md`, and `.public` returns `false`.

- [ ] **Step 3: Record the gist ID**

Save the gist ID for Task 2. Do not commit yet — the commit happens after the config file is written.

---

## Task 2: Write the config file

**Files:**
- Create: `.claude/qa-tracker.config.yaml`

- [ ] **Step 1: Write a failing schema check**

Create a small inline test (run from terminal, not committed):

```bash
yq '.testers | length, .upstream_repo, .tracking_gist.id, .time_windows.hot_days, .time_windows.warm_days' .claude/qa-tracker.config.yaml
```

Expected before file exists: error "Error: open .claude/qa-tracker.config.yaml: no such file or directory" (or similar).

- [ ] **Step 2: Create `.claude/qa-tracker.config.yaml`**

```yaml
# Who to track (GitHub handles)
testers:
  - Bhavna-Ramachandran

# Repo to query for issues/PRs
upstream_repo: HHS/simpler-grants-gov

# Where the scheduled routine writes the daily digest
tracking_gist:
  id: <REPLACE-WITH-GIST-ID-FROM-TASK-1>

# Recency tiers (days)
time_windows:
  hot_days: 3
  warm_days: 14

# Signals to surface (each becomes a labeled reason on a digest item)
signals:
  assignee: true
  mention: true
  needs_testing: true
  reviewer: true

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

Replace `<REPLACE-WITH-GIST-ID-FROM-TASK-1>` with the gist ID captured in Task 1. The gist ID is committed to the repo — this is fine because a private gist URL is unguessable and serves as a capability token.

- [ ] **Step 3: Run the schema check**

```bash
yq '.testers | length, .upstream_repo, .tracking_gist.id, .time_windows.hot_days, .time_windows.warm_days' .claude/qa-tracker.config.yaml
```

Expected output (one value per line):
```
1
HHS/simpler-grants-gov
<your-gist-id>
3
14
```

If `yq` is not installed, alternative: `python3 -c "import yaml; print(yaml.safe_load(open('.claude/qa-tracker.config.yaml')))"` and verify the dict structure matches.

- [ ] **Step 4: Commit**

```bash
git add .claude/qa-tracker.config.yaml
git commit -m "Add QA tracker config with Bhavna as initial tester"
```

---

## Task 3: Write the subagent

**Files:**
- Create: `.claude/agents/qa-tracker.md`

- [ ] **Step 1: Write the subagent file**

Create `.claude/agents/qa-tracker.md` with the following content exactly:

````markdown
---
name: qa-tracker
description: Surfaces GitHub issues and PRs in HHS/simpler-grants-gov that are relevant to specific testers. Reads .claude/qa-tracker.config.yaml, queries GitHub via gh, classifies results by recency and signal, and outputs a markdown digest. Invoke when the user asks for a QA status report or wants to know what testers are working on.
tools: Bash, Read
model: sonnet
---

You produce a markdown digest of GitHub issues and PRs relevant to specific testers. The user uses this digest to proactively help testers with their work.

# Workflow

## Step 1: Read config

Read `.claude/qa-tracker.config.yaml`. Extract:
- `testers` (list of GitHub handles)
- `upstream_repo` (e.g., `HHS/simpler-grants-gov`)
- `tracking_gist.id` (not used by the subagent itself, but read for completeness)
- `time_windows.hot_days` and `time_windows.warm_days`
- `signals` (which signals to surface)
- `needs_testing_hints` (seeds for the classifier)
- `include_issues`, `include_prs`

## Step 2: Compute date windows

Use ISO date format (YYYY-MM-DD).

- `warm_window_start` = today minus `warm_days`
- `hot_window_start` = today minus `hot_days`

Compute via Bash:
```bash
date -u -v -14d +%Y-%m-%d   # warm window start (macOS)
date -u -v -3d +%Y-%m-%d    # hot window start (macOS)
```

## Step 3: Query GitHub for each tester

For each tester, run these `gh search` queries against `upstream_repo`, scoped to `--updated ">=<warm_window_start>"`:

1. **Assigned items:**
   ```
   gh search issues --repo <upstream_repo> --assignee <tester> --state open --updated ">=<warm_window_start>" --json number,title,updatedAt,url,isPullRequest,labels,author
   ```

2. **Mentioned items:**
   ```
   gh search issues --repo <upstream_repo> --mentions <tester> --state open --updated ">=<warm_window_start>" --json number,title,updatedAt,url,isPullRequest,labels,author
   ```

3. **PR review-requested items** (skip if `signals.reviewer` is false or `include_prs` is false):
   ```
   gh search prs --repo <upstream_repo> --review-requested <tester> --state open --updated ">=<warm_window_start>" --json number,title,updatedAt,url,labels,author
   ```

Note: `gh search issues` returns both issues and PRs by default. Filter by `isPullRequest` field in the JSON output to honor the include flags:
- If `include_prs: false`: drop results where `isPullRequest == true` from queries 1 and 2; skip query 3.
- If `include_issues: false`: drop results where `isPullRequest == false` from queries 1 and 2.

## Step 4: Deduplicate and classify

Combine results from all queries. Deduplicate by `number`.

For each unique item, determine:

- **Recency tier:** `Hot` if `updatedAt >= hot_window_start`, otherwise `Warm`.
- **Signals fired:** Track which queries returned this item. Possible signals: `Assignee`, `Mentioned`, `Reviewer` (PRs only), `Needs testing` (set in next step).
- **Type:** Issue or PR (use `isPullRequest` from query results, or infer from `--json` output).

## Step 5: Detect "Needs testing"

For each item, fetch comments since `warm_window_start`:

```bash
gh api repos/<upstream_repo>/issues/<num>/comments --paginate -q '.[] | select(.created_at >= "<warm_window_start>") | "\(.created_at)|\(.user.login)|\(.body)"'
```

Read each comment. Use LLM judgment with `needs_testing_hints` as seeds: does the comment ask a tester to verify, test, QA, or review work? If yes, add the `Needs testing` signal to the item.

For borderline cases (uncertain whether the comment is a testing request), still add the signal but mark with ⚠️ Suspected and quote the comment text in the output.

## Step 6: Render the digest

Output a markdown digest to stdout in this exact structure:

```markdown
# QA Status — <tester> (<YYYY-MM-DD>)

**Summary:** <hot_count> hot · <warm_count> warm · <needs_testing_count> flagged "needs testing"

## 🔥 Hot (last <hot_days> days)

### Issues
- **#<num>** <title>
  - Signals: <comma-separated signals>
  - Last activity: <date> by @<author> ("<short excerpt of latest comment or body>")

### PRs
- **#<num>** <title>
  - Signals: <signals>
  - Last activity: <date> by @<author> ("<excerpt>")

## Warm (last <warm_days> days, excluding hot)

### Issues
- **#<num>** <title>
  - Signals: <signals>
  - Last activity: <date> by @<author> ("<excerpt>")

### PRs
- **#<num>** <title>
  - ...
```

Rules:
- If a section has no items, write `- (none)`.
- If the tester has zero items in the warm window total, output instead:
  ```markdown
  # QA Status — <tester> (<YYYY-MM-DD>)

  No active items in the last <warm_days> days.
  ```
- For multiple testers, produce one top-level section per tester (separated by horizontal rules), each with its own Hot/Warm structure.
- Excerpts should be ≤80 characters; trim and add `…` if longer.
- For ⚠️ Suspected needs-testing matches, append a line under "Signals" like: `  - Suspected reason: "<full comment text>"`.

## Step 7: Output

Print the digest to stdout. Do not write any files. Do not invoke other agents.

# Error handling

- **Empty `gh` query results:** Treat as "nothing to report" for that signal. Continue with other queries.
- **Borderline `Needs testing` matches:** Tag with ⚠️ Suspected and quote the full comment text under "Suspected reason".
- **`gh` rate limit (HTTP 403 with rate-limit headers):** Wait briefly (e.g., `sleep 5`) and retry once. If it fails again, exit with an error message naming the rate limit.
- **Network or auth errors:** Exit immediately with the error from `gh` so the caller can see it.
````

- [ ] **Step 2: Verify frontmatter parses**

Run:
```bash
head -10 .claude/agents/qa-tracker.md
```

Expected: shows `---`, `name: qa-tracker`, `description: ...`, `tools: Bash, Read`, `model: sonnet`, `---`.

- [ ] **Step 3: Commit**

```bash
git add .claude/agents/qa-tracker.md
git commit -m "Add qa-tracker subagent"
```

---

## Task 4: Smoke test the subagent on real data

**Files:**
- (No file changes — this validates the subagent works against live GitHub data.)

- [ ] **Step 1: Invoke the subagent**

In Claude Code, ask Claude to "use the qa-tracker subagent to produce the QA status digest." Claude dispatches the agent via the Agent tool with `subagent_type: "qa-tracker"`. The subagent runs its workflow and returns the digest.

If for some reason the agent isn't auto-discovered (Claude Code typically picks up `.claude/agents/*.md` files automatically), restart Claude Code or check that the file's frontmatter is valid YAML.

- [ ] **Step 2: Verify expected items appear**

The digest should include (as of 2026-04-29):
- **Hot:** at least #9962 ("Feature file for Search state persistence tests"), #9919 ("Align on E2E testing needs"), #9670 ("Organize E2E apply tests…").
- **Tester:** Bhavna-Ramachandran appears as the heading.
- **Summary line:** non-zero hot count.

If any expected item is missing, debug the query that should have surfaced it (check `gh search issues --repo HHS/simpler-grants-gov --assignee Bhavna-Ramachandran --state open` directly).

- [ ] **Step 3: Verify the digest format matches the spec**

Check:
- Heading is `# QA Status — Bhavna-Ramachandran (<today>)`
- Summary line is present.
- 🔥 Hot section has Issues + PRs subsections.
- Warm section has Issues + PRs subsections.
- Each item shows Signals + Last activity.
- Empty subsections show `- (none)`.

- [ ] **Step 4: Iterate if output is wrong**

If the format or content is off, edit `.claude/agents/qa-tracker.md`, re-invoke, and re-verify. Common issues:
- Date math wrong (macOS vs GNU `date` flags differ — the agent uses macOS syntax)
- `gh search` flag misuse (test the raw command)
- Missing dedup (same item appears under two signals as two list items)

- [ ] **Step 5: Commit any agent fixes**

```bash
git add .claude/agents/qa-tracker.md
git commit -m "Fix qa-tracker agent: <what was fixed>"
```

(Skip this step if no changes were needed.)

---

## Task 5: Write the routine prompt file

**Files:**
- Create: `.claude/qa-tracker.routine-prompt.md`

This file is documentation — it holds the exact prompt the user will paste into `/schedule` when creating the routine. Keeping it in version control means the schedule is reproducible.

- [ ] **Step 1: Create the routine prompt file**

```markdown
# QA Tracker — Scheduled Routine Prompt

This file holds the prompt to paste into `/schedule` when creating or recreating the QA tracker routine.

## Cadence

Weekdays, 8:30am ET (Mon–Fri).

## Repo binding

`HHS/simpler-grants-gov` (so the cloud agent can read `.claude/qa-tracker.config.yaml` and `.claude/agents/qa-tracker.md` from this repo's working tree).

## Prompt

Paste this exact text into `/schedule` as the routine prompt:

> Read `.claude/qa-tracker.config.yaml` and `.claude/agents/qa-tracker.md` from the repo working tree. Follow the qa-tracker workflow exactly, producing the markdown digest.
>
> If the digest reports zero hot items and zero warm items (i.e., it says "No active items in the last 14 days"), exit silently — do not update the gist.
>
> Otherwise, overwrite the gist `<GIST_ID>` with the digest:
>
>     printf '%s' "<DIGEST>" | gh gist edit <GIST_ID> --filename qa-status.md -
>
> Where `<GIST_ID>` is the ID from `.claude/qa-tracker.config.yaml` `tracking_gist.id` (currently `<REPLACE-WITH-GIST-ID>`), and `<DIGEST>` is the markdown produced by the qa-tracker workflow.
>
> Confirm success by printing the gist URL after the update.
```

Replace `<REPLACE-WITH-GIST-ID>` with the actual gist ID from Task 1 / Task 2.

- [ ] **Step 2: Commit**

```bash
git add .claude/qa-tracker.routine-prompt.md
git commit -m "Add scheduled routine prompt for qa-tracker"
```

---

## Task 6: Create the schedule (manual / external)

**Files:**
- (No file changes — this is a one-time external action that registers the routine.)

- [ ] **Step 1: Run `/schedule` with the routine prompt**

In Claude Code, invoke `/schedule` and provide:
- **Cadence:** weekdays at 8:30am ET (cron: `30 8 * * 1-5` in America/New_York — `/schedule`'s UI may take this in a friendlier form).
- **Repo:** `HHS/simpler-grants-gov` (or your local fork — whichever one this repo is).
- **Prompt:** copy-paste the prompt body from `.claude/qa-tracker.routine-prompt.md` (the indented block under "Prompt"), substituting the actual gist ID for `<REPLACE-WITH-GIST-ID>`.

The `/schedule` skill will guide you through the rest. If you're unsure how a field maps, ask Claude to walk you through it — `/schedule` is interactive.

- [ ] **Step 2: Verify the routine was created**

After `/schedule` confirms creation, list active routines and check that "QA Tracker" (or whatever name was used) appears with the correct cadence.

- [ ] **Step 3: Trigger one manual run**

`/schedule` supports running a routine on demand. Trigger it once to verify the end-to-end flow.

Expected:
- Routine produces a digest matching what Task 4 produced.
- Gist `<gist-id>` is updated (verify via `gh gist view <gist-id>`).
- The gist content is the digest, replacing the placeholder.

- [ ] **Step 4: Verify the gist URL is bookmarkable**

Open `https://gist.github.com/zachwildd/<gist-id>` in a browser. Pin the tab. This is the daily destination.

---

## Verification checklist

After all tasks are complete, confirm:

- [ ] `.claude/qa-tracker.config.yaml` exists with the gist ID filled in
- [ ] `.claude/agents/qa-tracker.md` exists with valid frontmatter and full workflow
- [ ] `.claude/qa-tracker.routine-prompt.md` exists for reproducibility
- [ ] On-demand: invoking the qa-tracker subagent produces a correct digest for Bhavna
- [ ] Gist exists, is private, and contains the latest digest (not the placeholder)
- [ ] `/schedule` routine is registered and ran successfully at least once manually

## Adding more testers later

Append to `testers:` in `.claude/qa-tracker.config.yaml`. No other changes needed. Re-run the on-demand subagent to verify the digest now has a section per tester.
