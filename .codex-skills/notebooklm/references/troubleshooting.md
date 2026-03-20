# NotebookLM Troubleshooting

## Install

Install `notebooklm-py` in an isolated environment. Prefer a virtualenv or `pipx`, not the system Python managed by Homebrew.

Examples:

```bash
/absolute/path/to/skill/scripts/bootstrap_notebooklm.sh
```

or

```bash
python3 -m venv .venv
. .venv/bin/activate
python -m pip install notebooklm-py
```

or

```bash
pipx install notebooklm-py
```

After install, verify:

```bash
notebooklm --help
notebooklm --version
```

## Authentication

- Default auth file: `~/.notebooklm/storage_state.json`
- Optional inline auth: `NOTEBOOKLM_AUTH_JSON`
- Optional custom home: `NOTEBOOKLM_HOME`

If commands fail:

```bash
notebooklm login
notebooklm auth check
```

If the browser-based login is not possible in the current environment, provide `NOTEBOOKLM_AUTH_JSON` from a trusted existing session or copy a valid `storage_state.json` into the active NotebookLM home.

## Shared context hazards

`notebooklm use` writes the active notebook context into NotebookLM's home directory. That is convenient in one interactive shell, but fragile in automation or parallel-agent execution.

Use one of these mitigations:

1. Pass explicit notebook IDs to later commands.
2. Set a unique `NOTEBOOKLM_HOME` per agent or per job.
3. Avoid partial notebook IDs in scripts.

## Long-running generation

Artifact generation and research can take time or fail transiently.

Recommended pattern:

1. Start with `generate ... --json` when available.
2. Capture the returned task or artifact ID.
3. Wait with `notebooklm artifact wait <artifact_id>` or `notebooklm research wait`.
4. Download only after completion.

## Common recovery checks

```bash
notebooklm status
notebooklm auth check
notebooklm list
notebooklm artifact list
notebooklm source list
```

If `status` or `list` fails, resolve auth before debugging higher-level commands.
