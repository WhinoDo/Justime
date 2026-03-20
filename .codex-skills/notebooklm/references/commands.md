# NotebookLM Command Recipes

## Core commands

```bash
notebooklm login
notebooklm auth check
notebooklm list
notebooklm create "Research Notebook"
notebooklm status
```

## Source ingestion

```bash
notebooklm source add "https://example.com/article"
notebooklm source add ./paper.pdf
notebooklm source add "https://www.youtube.com/watch?v=VIDEO_ID"
notebooklm source add-research "state of edge AI in 2026"
notebooklm source list
notebooklm source wait <source_id>
notebooklm source fulltext <source_id> --json
```

## Grounded chat

```bash
notebooklm ask "Summarize the key claims."
notebooklm ask "Compare source A and B." --json
notebooklm ask "Answer only from these sources." -s <source_id> -s <source_id>
notebooklm history
notebooklm history --save --note-title "Research log"
```

## Notes

```bash
notebooklm note list
notebooklm note create "Saved note body" -t "Title"
notebooklm note get <note_id>
notebooklm note save <note_id> --content "Updated note body" --title "Title"
```

## Artifact generation

```bash
notebooklm generate audio "Focus on tradeoffs and open questions"
notebooklm generate slide-deck
notebooklm generate report --format study-guide
notebooklm generate quiz --difficulty medium
notebooklm generate flashcards --quantity more
notebooklm generate infographic --orientation portrait
notebooklm generate video "Make this executive-friendly"
notebooklm generate mind-map
notebooklm generate data-table "List companies, products, and launch dates"
```

## Artifact lifecycle

```bash
notebooklm artifact list
notebooklm artifact wait <artifact_id>
notebooklm download audio ./overview.mp3
notebooklm download slide-deck ./slides.pdf
notebooklm download slide-deck ./slides.pptx --format pptx
notebooklm download report ./report.md
notebooklm download quiz ./quiz.md --format markdown
notebooklm download flashcards ./cards.html --format html
notebooklm download data-table ./table.csv
notebooklm download mind-map ./map.json
```

## Parallel-safe patterns

- Prefer explicit notebook IDs over `notebooklm use`.
- For commands that accept a notebook override, pass `--notebook <uuid>` or the command-specific shorthand.
- Keep `NOTEBOOKLM_HOME` isolated per agent if two agents may act at once.
- Prefer `--json` for machine-readable chaining.

## Task mapping

- "Create a NotebookLM notebook and load these files": `create`, then `source add`
- "Summarize these links with citations": `source add`, `source wait`, then `ask --json`
- "Turn this notebook into a podcast": `generate audio`, then `artifact wait`, then `download audio`
- "Make a study guide and quiz": `generate report --format study-guide`, then `generate quiz`
- "Export editable slides": `generate slide-deck`, `artifact wait`, `download slide-deck --format pptx`
