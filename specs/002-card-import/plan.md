# Implementation Plan: Card and Lorebook Import

**Branch**: `002-card-import` (stacked on `001-tui-chat`) | **Date**: 2026-10-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/002-card-import/spec.md`

## Summary

Import V2/V3 character cards (JSON or PNG) and lorebooks (embedded, SillyTavern world info, or
card format) into a library under the app's data directory, one folder per item. Each item keeps
the original file byte for byte, plus an `item.json` that holds the untouched decoded source
(`raw`) and a normalized view for 003 and 004. File types are detected from content, and every
rejection happens before anything is written. Import, list and show work the same from the CLI
and from in-app commands, because both use one shared formatter.

## Technical Context

**Language/Version**: TypeScript 7 and Node 26. The feature uses `crypto` (SHA-256) and
`fs.rename`; the tests also use `zlib.crc32`.

**Primary Dependencies**: no new dependencies, only Node built-ins. This feature uses **no pi
APIs**.

**Storage**: `<dataDir>/library/{characters,lorebooks}/<id>/{original.*, item.json}`, where
`dataDir` comes from 001's `resolveAppPaths` (`packages/data/src/paths.ts`).

**Testing**: Vitest. Fixtures are synthetic and built in code, PNGs included. The real-sample test
runs only when `../test-cards/` exists (research R7).

**Target Platform**: Linux and WSL, as in 001.

**Project Type**: pnpm workspace. Parsing and the library go in `data`; formatting and commands
go in `tui`.

**Performance Goals**: importing a card under 1 MB takes less than 1 s (SC-005). This is easily
met.

**Constraints**:
- A failed import writes nothing.
- `raw` is never modified.
- Extension data is never executed.

**Scale/Scope**: a personal library of tens to hundreds of items. About 10 source files.

**Depends on 001**: `resolveAppPaths` (`dataDir`), `runCli` (subcommand dispatch) and the app's
slash-command handling. If 001 named any of these differently, adapt to 001's actual code and
note the difference in the report.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

Checked against constitution 2.0.0 (the version on `001-tui-chat`).

| Principle | Status | How |
|---|---|---|
| I. Build on pi, own the context | Pass | pi has no card or lorebook parsing. This is ecosystem-format code we own, and nothing pi provides is reimplemented |
| II. Wrap pi behind our types | N/A | No pi imports |
| III. Mechanism, not policy | Pass | A field with the wrong type gets a default and a warning; there are no repair heuristics. Unsupported input is rejected plainly |
| IV. Lossless ecosystem data | Pass | The original is kept byte for byte, `raw` is untouched, and each entry keeps its `source` verbatim. Committed tests use synthetic fixtures; real samples stay in `../test-cards/` |
| V. SDD development usage accounting | Pass | The implementing agent records its tool calls and the run's platform-reported tokens (or "unknown") in `specs/002-card-import/development-usage.md` and in the report |
| VI. MVP first | Pass | Import only, as clarified: no export, editing or in-app delete |
| VII. Understandable over clever | Pass | A hand-written PNG reader of about 30 lines; no index file; one formatter for both surfaces |
| Testing policy | Pass | See the Test Plan below |

Re-check after Phase 1 design: unchanged, all pass.

## Project Structure

### Documentation (this feature)

```text
specs/002-card-import/
├── spec.md, plan.md, research.md, data-model.md, quickstart.md
├── contracts/cli-and-library.md
├── checklists/requirements.md
└── tasks.md             # created by /speckit-tasks
```

### Source Code

```text
packages/data/src/cards/
├── png.ts               # readPngTextChunks(bytes): Map<string,string>   (research R1)
├── detect.ts            # detectFile(bytes, fileName): Detected | Rejected (research R2)
├── normalize.ts         # toCharacter(data) / toLorebook(raw, fallbackName) + warnings (R4)
├── types.ts             # Character, Lorebook, LorebookEntry, FormatLabel, LibraryItem, ImportReport
├── png.test.ts, detect.test.ts, normalize.test.ts
├── fixtures.ts          # test helpers: makeV2Card, makeV3Card, makePng(chunks), makeWorldInfo
└── samples.local.test.ts  # real samples, skipped without ../test-cards (R7)
packages/data/src/library.ts       # importFile, listLibrary, getItem (research R5)
packages/data/src/library.test.ts

packages/tui/src/library-format.ts # formatImportReport / formatLibraryList / formatItemDetails -> string[]
packages/tui/src/library-format.test.ts
packages/tui/src/cli.ts            # + import / list / show subcommands
packages/tui/src/app.ts            # + /import, /library, /show
```

**Structure Decision**: Card logic goes in `data`, because it is about file formats and storage,
and 003 and 004 import the types from there. Text formatting is presentation, so it goes in
`tui`. `engine` does not change.

## Test Plan (complexity-assessed)

| # | Test | Complexity | Decision |
|---|---|---|---|
| T-a | PNG reader finds `tEXt` keywords and values, and rejects a file without the PNG signature | low | **write** |
| T-b | Detection cases (listed below) | low | **write** |
| T-c | Normalization cases (listed below) | low | **write** |
| T-d | Library cases (listed below) | low to medium | **write** |
| T-e | Formatter: report, list and details lines for one character and one lorebook; the empty-library hint | low | **write** |
| T-f | CLI: `import` exits with code 1 when any file fails; `list` and `show` print the formatter output | low | **write** (call `runCli` in-process, as 001 does) |
| T-g | Real samples (R7): label, name and entry count for all nine files | low | **write**, skipped when the directory is absent |
| T-h | In-app `/import`, `/library` and `/show` render as notices | medium | **manual**: they share T-e's formatter, so a manual look is enough |

**T-b detection cases**:
- V3 JSON and V2 JSON.
- PNG with both chunks → V3; PNG with only the V2 chunk.
- Plain PNG with no card.
- ZIP containing `card.json` → CharX; ZIP containing `manifest.json` → BYAF.
- YAML-looking text.
- V1 card; unknown `spec` value.
- BOM at the start of a JSON file.
- Damaged JSON, reported with line and column.
- PNG whose chunk is not valid base64 JSON.
- The extension is ignored: PNG bytes named `.json` still detect as PNG.

**T-c normalization cases**:
- Every Character field, from both V2 and V3.
- A field with the wrong type gives the default plus a warning.
- `character_book: null`.
- Both lorebook shapes.
- A disabled entry is kept.
- World-info entries are ordered by numeric key.
- The lorebook name falls back to the file name.

**T-d library cases**:
- Import writes a byte-identical `original.*` and an `item.json`.
- Every key path in the source exists in `raw` (SC-003).
- Re-importing gives `already-imported`.
- A rejected file leaves the library unchanged (FR-006).
- `listLibrary` ignores `.tmp-*` folders.
- `getItem` works with an id prefix.

## Complexity Tracking

No constitution violations need justifying.
