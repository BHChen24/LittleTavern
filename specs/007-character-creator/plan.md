# Implementation Plan: Character Creator

**Branch**: `007-character-creator` (stacked on `006-usability`) | **Date**: 2026-10-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/007-character-creator/spec.md`

## Summary

`/new-character` writes a Markdown template into a drafts folder and hands the terminal to the
owner's editor. When the editor closes, the app parses the draft, builds a V3 JSON card, saves it
in the characters import folder, and imports it through the existing `importFile`. Failures keep
the draft. `littletavern create <file.md>` does the same from the command line.

## Technical Context

**Language/Version**: TypeScript 7, Node 26

**Primary Dependencies**: none new. The editor is launched with `node:child_process`
`spawnSync`, because pi's helper is not exported (research R1).

**Storage**: drafts in `<importRoot>/drafts/`, created cards in `<importRoot>/characters/`, and
the library unchanged. The import root comes from 006.

**Testing**: Vitest. The editor is a fake Node script set through `VISUAL`.

**Project Type**: `data` (template parser and card builder) and `tui` (editor launch, command,
CLI).

**Constraints**:

- Created cards go through `importFile`, never around it.
- Drafts are never deleted on failure.
- Template text is in English (constitution 3.1.0).

**Scale/Scope**: about 4 source files.

**Depends on 006**: `paths.importRoot` and `importCharactersDir`, the `COMMANDS` table, and the
home screen and chat flow. If 006 named something differently, adapt to 006's actual code and
note it in the report.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

Checked against constitution 3.1.0.

| Principle | Status | How |
|---|---|---|
| I. Build on pi, own the context | Pass, one exception | pi's editor helper is not exported, so a small one is written (Complexity Tracking) |
| II. Wrap pi behind our types | Pass | No pi types are involved |
| III. Mechanism, not policy | Pass | The template is parsed literally. Unknown sections give warnings, and nothing is guessed |
| IV. Lossless ecosystem data | Pass | The output is a standard V3 card, imported through the normal path |
| V. SDD development usage accounting | Pass | Recorded in `specs/007-character-creator/development-usage.md` |
| VI. MVP first | Pass | Creation only, no editing of existing characters |
| VII. Understandable over clever | Pass | A parser of about 60 lines with no Markdown library |
| Language (3.1.0) | Pass | Template headings and explanations are in English |
| Testing policy | Pass | See the Test Plan below |

## Project Structure

```text
packages/data/src/cards/template.ts        # CHARACTER_TEMPLATE, parseCharacterTemplate, buildV3Card, safeCardFileName (R2, R3)
packages/data/src/cards/template.test.ts
packages/data/src/create-character.ts      # createCharacterFromDraft(paths, draftPath) → ImportReport | error; keeps or removes the draft
packages/data/src/create-character.test.ts
packages/tui/src/editor-launch.ts          # openInEditor (R1)
packages/tui/src/editor-launch.test.ts     # fake VISUAL script
packages/tui/src/commands.ts               # + /new-character
packages/tui/src/app.ts                    # draft picker, tui.stop/start around the editor, report notice
packages/tui/src/cli.ts                    # + create <file.md>
```

## Test Plan (complexity-assessed)

| # | Test | Complexity | Decision |
|---|---|---|---|
| T-a | Parser: every field; explanations removed; inner text exact (CJK, `{{user}}`); missing name → error; unknown section and deleted section → warnings; lorebook entries with keys and always-on; an entry without keys or always-on → warning | low | **write** |
| T-b | `buildV3Card` matches `contracts/template.md`, including `extensions.littletavern` | low | **write** |
| T-c | `safeCardFileName`: slashes, emoji, empty name, the `-2` suffix when taken | low | **write** |
| T-d | `createCharacterFromDraft`: success writes the card, imports it and deletes the draft; a re-import reports already imported; failure keeps the draft; an unchanged template → cancelled | low | **write** |
| T-e | `openInEditor` with a fake `VISUAL` script edits the file; a missing program → `{ ok: false }` naming it | medium | **write** |
| T-f | CLI `create <file.md>`: success, and exit code 1 without a name | low | **write** |
| T-g | App `/new-character` with a fake `VISUAL`: the character appears in `/library`; a second run with a kept draft offers to continue | medium | **try**; defer if the harness needs more than about 60 lines |
| T-h | Dry run of a created character with lore (User Story 4) | low | **write** (through `dryRun`) |

## Complexity Tracking

| Exception | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| Our own `openInEditor` (constitution I) | Hand the terminal to `$EDITOR` and keep the file | pi's `editInExternalEditor` is not exported from `@earendil-works/pi-coding-agent`, and it deletes its temporary file, while drafts must survive failures |
