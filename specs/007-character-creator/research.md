# Research: Character Creator

Verified on 2026-10-20 against `../pi` at `v1.3.0` and the `006-usability` design.

## R1. Launching the editor

- **pi's helper is not reusable as is.** pi coding-agent has `editInExternalEditor`
  (`modes/interactive/external-editor.ts`), but it is **not exported** from the package. It also
  writes to a temporary file and deletes it, while we must keep drafts (FR-006).
- **Decision**: write our own `openInEditor(filePath, command)` in
  `packages/tui/src/editor-launch.ts`, following pi's approach:
  - the command is `$VISUAL || $EDITOR || (win32 ? "notepad" : "nano")`, split on spaces into a
    program and arguments, so `code --wait` works;
  - it calls `spawnSync(program, [...args, filePath], { stdio: "inherit" })`;
  - it returns `{ ok: true }`, or `{ ok: false, reason }` when the program is not found
    (`ENOENT`) or exits with a non-zero code.
- **Around the call**: `tui.stop()` before and `tui.start(); tui.requestRender(true)` after, in a
  `finally` block. This is exactly what pi does in `extension-editor.ts:127-137`.
- **Tests**: set `VISUAL` to a small Node script that appends filled-in text to the file and exits
  with 0. No real editor is needed.

## R2. Parsing the Markdown template

- **Decision**: a small hand-written parser, `parseCharacterTemplate(text)`, in
  `packages/data/src/cards/template.ts`. It returns
  `{ fields, entries, warnings } | { error }`.
  1. Remove HTML comments with `/<!--[\s\S]*?-->/g`.
  2. Split at lines that start with `## `. The heading text, lower-cased and trimmed, names the
     field.
  3. Inside `## Lorebook`, split at `### ` lines. In each block, read the `Keys:` and
     `Always on:` lines, case-insensitive. The rest is the content.
  4. Trim leading and trailing blank lines in every section. Keep inner text exactly.
- **Rationale**: the format is ours and tiny, so about 60 lines of explainable code beat a
  Markdown library. No new dependency is needed.
- **Unchanged template**: compare the file contents against the original template string. If
  they are equal, report "cancelled".

## R3. Generating and importing the card

- **Generation**: `buildV3Card(fields, entries, version)` returns the V3 JSON described in
  `contracts/template.md`.
- **File name**: lower-case the name, replace every character outside `[\p{L}\p{N}_-]` with `-`,
  collapse repeated `-`, trim to 60 characters, and fall back to `character` when nothing is
  left. Append `-2`, `-3`, … if the name is taken.
- **Saving and importing**: write the card into `importCharactersDir`, then call 002's unchanged
  `importFile`. Every import guarantee (byte-identical original, raw kept, the duplicate check)
  therefore holds automatically (SC-004).
- **Drafts**: drafts go in `<importRoot>/drafts/`. If the import succeeds, the draft is deleted.
  On any failure it is kept. `/new-character` lists any existing drafts first, with a picker
  offering "Continue <draft>" and "Start a new character".
