---
name: notebooklm
description: Use the notebooklm-py CLI to work with Google NotebookLM from Codex. Trigger when the user wants to create or manage NotebookLM notebooks, add URLs/files/YouTube/research sources, ask grounded questions, save notes, generate artifacts such as audio overviews, slide decks, reports, quizzes, flashcards, infographics, videos, mind maps, or download NotebookLM outputs.
---

# NotebookLM

Use the local `notebooklm` CLI as the primary interface. Prefer exact CLI commands over browser-only workflows.

## Quick Start

1. Run `scripts/check_notebooklm_env.sh`.
2. If the CLI is missing, run `scripts/bootstrap_notebooklm.sh` from the target workspace to create a local virtualenv and install `notebooklm-py`.
3. If authentication is missing or stale, run `notebooklm login`, then `notebooklm auth check`.
4. Before mutating notebook context, run `notebooklm status`.
5. For parallel or multi-agent work, avoid `notebooklm use`; prefer explicit notebook IDs.

## Working Rules

- Treat `notebooklm status`, `notebooklm auth check`, `notebooklm list`, `notebooklm source list`, `notebooklm artifact list`, and `notebooklm language get/list` as safe read operations.
- Treat `delete`, `download`, `generate`, `history --save`, and `ask --save-as-note` as write or long-running operations. Confirm before running them unless the user was already explicit.
- Prefer `--json` whenever output will be parsed or chained into another command.
- If a workflow may run concurrently with another agent, pass explicit notebook IDs instead of relying on shared context files in `~/.notebooklm`.
- Use full UUIDs when automating. Partial IDs are convenient interactively but can become ambiguous.

## Standard Workflow

### 1. Verify environment

Run `scripts/check_notebooklm_env.sh` first. If more detail is needed, read [references/troubleshooting.md](./references/troubleshooting.md).

### 2. Establish notebook target

- To inspect existing notebooks: `notebooklm list`
- To create a notebook: `notebooklm create "Title"`
- To work inside one notebook in a single-agent session: `notebooklm use <notebook_id>`
- To stay parallel-safe: keep the notebook ID and pass it explicitly to later commands

### 3. Add or inspect sources

Use:

- `notebooklm source add "<url-or-path>"`
- `notebooklm source add-research "query"`
- `notebooklm source list`
- `notebooklm source wait <source_id>`
- `notebooklm source fulltext <source_id> --json`

If the task is source-heavy or artifact-heavy, read [references/commands.md](./references/commands.md).

### 4. Ask or save knowledge

Use:

- `notebooklm ask "question"`
- `notebooklm ask "question" --json`
- `notebooklm ask "question" -s <source_id>`
- `notebooklm history`
- `notebooklm note create "content" -t "Title"`
- `notebooklm note save <note_id> --content "Updated content"`

Prefer `ask --json` when the user wants references, downstream parsing, or structured output.

### 5. Generate artifacts

Use the `generate` family for NotebookLM outputs:

- `notebooklm generate audio`
- `notebooklm generate slide-deck`
- `notebooklm generate report`
- `notebooklm generate quiz`
- `notebooklm generate flashcards`
- `notebooklm generate infographic`
- `notebooklm generate video`
- `notebooklm generate mind-map`
- `notebooklm generate data-table`

Then inspect or wait with:

- `notebooklm artifact list`
- `notebooklm artifact wait <artifact_id>`

Download only after confirming target path and format with the user.

## References

- Read [references/commands.md](./references/commands.md) for command recipes and common task mappings.
- Read [references/troubleshooting.md](./references/troubleshooting.md) for install, auth, shared-context, and recovery guidance.
- Use [scripts/check_notebooklm_env.sh](./scripts/check_notebooklm_env.sh) before first use in a session.
- Use [scripts/bootstrap_notebooklm.sh](./scripts/bootstrap_notebooklm.sh) when `notebooklm` is not installed in the current workspace.
