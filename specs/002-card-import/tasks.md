---
description: "Task list for 002-card-import"
---

# Tasks: Card and Lorebook Import

**Input**: Design documents from `specs/002-card-import/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/cli-and-library.md,
quickstart.md

**Tests**: These come from the spec's "Acceptance Testing" section and plan.md's Test Plan (T-a
to T-h). Keep them lightweight.

**Read before starting**:
- `research.md`: detection order, the mapping tables, the library layout and the real-sample
  table.
- The existing 001 code: `packages/tui/src/cli.ts` (`runCli`), the command `if`-chain in
  `packages/tui/src/app.ts` (`notice(...)` prints a transcript notice), and
  `packages/data/src/paths.ts` (`resolveAppPaths`, `AppPaths.dataDir`).

## Rules for this run (unattended)

- **Stay on branch `002-card-import`.** Never commit to `main`, and never switch, merge or rebase
  branches.
- **Do not stop to ask.** If something is unclear, write it to `specs/002-card-import/questions.md`
  (what, where, what you chose), take the most conservative option, and continue.
- **If a test is too complex to write**, record it under "Deferred tests" in the report and move on.
- **Never** read, print or use `.env`, **never** run `pnpm test:live`, and **never** add a dependency.
- **Constitution V**: record your tool invocations and the run's platform-reported total tokens (or
  "unknown") in `specs/002-card-import/development-usage.md`.
- **After each phase**: run `pnpm build && pnpm lint && pnpm test`, then commit with an English
  conventional message and mark the finished tasks `[X]` in the same commit.
- **Keep the code explainable**: small functions, plain names, and `raw` is never mutated.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup

- [X] T001 Create `packages/data/src/cards/types.ts` with the types from data-model.md, copied verbatim:
  - `FormatLabel`, the six exact strings;
  - `Character`;
  - `Lorebook`;
  - `LorebookEntry`, where `source` is the entry object verbatim;
  - `LibraryItem` with `v: 1`;
  - `ImportReport`, the ok/failed union.
- [X] T002 Create `packages/data/src/cards/fixtures.ts` with the test-only builders below. Tests import them; nothing else does.
  - `makeV3Card(overrides)` and `makeV2Card(overrides)` return JSON objects.
  - `makePng(chunks: Record<string,string>)` returns bytes: the signature, a minimal `IHDR`, one `tEXt` chunk per entry with a base64 value, and `IEND`, with CRCs from `zlib.crc32`.
  - `makeWorldInfo(entries)` builds a SillyTavern world-info object.
  - `makeZip(fileName)` writes a local-file-header `PK\x03\x04` that contains the given name.

**Checkpoint**: checks pass. Commit.

---

## Phase 2: Foundational (parsing; blocks all stories)

- [ ] T003 [P] Implement `readPngTextChunks(bytes): Map<string,string>` in `packages/data/src/cards/png.ts` per research R1. Check the signature, walk the chunks, split each `tEXt` at the first `\0` and decode as Latin-1. Do not verify the CRC and do not read `zTXt` or `iTXt`. Throw a typed error when the signature is not PNG. Write tests T-a in `packages/data/src/cards/png.test.ts`
- [ ] T004 [P] Implement `toCharacter(data)` and `toLorebook(raw, fallbackName)` in `packages/data/src/cards/normalize.ts`, both returning `{ value, warnings }`, using research R4's tables verbatim.
  - **Defaults for a missing field or a wrong type**: `""`, `[]`, `null`, `true` for `enabled`, `false` for `constant`, `0` for `insertionOrder`. Each wrong type adds a warning in the form `field "<name>" ... ignored`.
  - **Entry order**: world-info entries are sorted by numeric key; card-format entries keep array order.
  - **Lorebook name**: when `name` is missing or blank, use `fallbackName`.
  - **Preserved, not used**: `preservedUnusedFields(raw)` lists the keys under `raw.data` that R4 does not map, plus `extensions.<key>` for each extension key.

  Write tests T-c in `packages/data/src/cards/normalize.test.ts`.
- [ ] T005 Implement `detectFile(bytes, fileName)` in `packages/data/src/cards/detect.ts` per research R2, in that order, using bytes only and never the extension. It returns either `{ kind: "character", format, raw }`, `{ kind: "lorebook", format, raw }`, or `{ rejected: true, detected, reason }`.
  - **Rejection messages** use the wording in `contracts/cli-and-library.md`, for example "V1 character cards are not supported in this version" and "PNG image without a character card".
  - **Damaged JSON**: the reason is `damaged JSON: <the JSON.parse message>`.
  - **Missing name**: a card whose name is missing or blank is rejected with "a character must have a name".

  Write tests T-b in `packages/data/src/cards/detect.test.ts`.

**Checkpoint**: checks pass. Commit.

---

## Phase 3: User Story 1 - Import a character card (P1) 🎯 MVP

**Goal**: V3/V2 JSON and PNG cards are imported into the library and reported.

**Independent Test**: T-d passes for character cards.

- [ ] T006 [US1] Implement `importFile(paths, filePath): ImportReport` in `packages/data/src/library.ts` per research R5.
  - **Order of work**: read the bytes, run `detectFile`, normalize, compute `sha256` and `id = sha256.slice(0, 12)`.
  - **Already imported**: if `<dataDir>/library/<characters|lorebooks>/<id>/` exists, return `already-imported` with the existing item.
  - **Writing**: otherwise write `original.<png|json>` (the exact bytes) and `item.json` (a `LibraryItem` with `raw`, the normalized value, `warnings`, `preservedUnused` and `sourceFileName`) into `<library>/.tmp-<random>/`, then `rename` that folder to the final one.
  - **Errors**: a path that is missing or unreadable returns `ok: false` with "file not found or not readable". Nothing is written before validation passes.
- [ ] T007 [US1] Write the library tests T-d in `packages/data/src/library.test.ts`, using a temporary `LITTLETAVERN_HOME`:
  - The original is byte-identical to the source (compare with `Buffer.equals`).
  - Every key path in the source JSON, recursively, exists in `item.raw` (SC-003).
  - A PNG with both chunks gets `"Character card V3 (PNG)"`, and `raw` is the V3 object.
  - A second import of the same bytes gives `already-imported`.
  - Different bytes with the same name produce a new item.
- [ ] T008 [US1] Export the card types and `importFile` from `packages/data/src/index.ts`, and re-export them from the `@littletavern/data` block in `packages/engine/src/index.ts`. The tui reaches data only through the engine barrel, as 001 does.

**Checkpoint**: checks pass. Commit.

---

## Phase 4: User Story 2 - Reject what is not supported, clearly (P1)

**Goal**: Each unsupported or damaged input gets its specific message, and the library stays unchanged.

**Independent Test**: the rejection cases in T-b, plus the "library unchanged" assertion below.

- [ ] T009 [US2] Extend `packages/data/src/library.test.ts`. For each rejection case in spec User Story 2 (V1, CharX, BYAF, YAML, a plain PNG, damaged JSON, an undecodable PNG chunk, a missing name, a missing path), assert `ok: false`, the expected `detected` and `reason`, and that the library directory listing is identical before and after (FR-006). A leftover `.tmp-*` folder is ignored by `listLibrary`, which is tested in T012

**Checkpoint**: checks pass. Commit.

---

## Phase 5: User Story 3 - Import a standalone lorebook (P1)

**Goal**: Lorebooks in world-info and card format are imported as lorebooks.

- [ ] T010 [US3] Make sure `importFile` handles the lorebook results from `detectFile`. Lorebooks go to `library/lorebooks/<id>/`; the name falls back to the file's base name without extension. Extend `packages/data/src/library.test.ts`:
  - a world-info file imports as `"Lorebook (SillyTavern world info)"` with the right entry count, and a disabled entry is kept with `enabled: false`;
  - a card-format lorebook imports as `"Lorebook (card format)"`;
  - a file with no name uses the file-name fallback.

**Checkpoint**: checks pass. Commit.

---

## Phase 6: User Story 4 - Browse and inspect the library (P2)

**Goal**: list and show work from the CLI and the app, with identical output.

- [ ] T011 [US4] Implement `listLibrary(paths): LibraryItem[]` and `getItem(paths, idOrPrefix): LibraryItem | "ambiguous" | null` in `packages/data/src/library.ts`.
  - `listLibrary` reads every `item.json` under `characters/` and `lorebooks/`, skips `.tmp-*` folders and unreadable items, and sorts by `importedAt`.
  - `getItem` matches by exact id or by a unique prefix.

  Re-export both from the engine barrel.
- [ ] T012 [US4] Extend `packages/data/src/library.test.ts`: listing ignores `.tmp-*` folders, a prefix lookup works, and an ambiguous prefix is reported
- [ ] T013 [P] [US4] Implement `formatImportReport(report)`, `formatLibraryList(items)` and `formatItemDetails(item)` in `packages/tui/src/library-format.ts`, returning `string[]` exactly as in `contracts/cli-and-library.md`:
  - report lines start with `✓`, `•` or `✗`;
  - the list has two groups and shows the empty-library hint when there is nothing;
  - details cut long text to 200 characters plus `…`, and show one line per entry in the form `[on|off] [const] order=<n> keys=<…> — <first 60 characters>`.

  Write tests T-e in `packages/tui/src/library-format.test.ts`.
- [ ] T014 [US4] In `packages/tui/src/cli.ts`, add the subcommands `import <file…>`, `list` and `show <id>`, which print the formatter lines via `out` without starting the TUI. `import` returns 1 if any file failed, and `show` returns 1 when the item is not found or the prefix is ambiguous. Add the three subcommands to `CLI_HELP`. Write tests T-f in `packages/tui/src/cli.test.ts`, calling `runCli` in process with a temporary `LITTLETAVERN_HOME`
- [ ] T015 [US4] In `packages/tui/src/app.ts`, add `/import <path>`, `/library` and `/show <id>`. Print each line via `notice(...)`, or one notice joined with `\n`. **Put these handlers before the `if (needsKey) return;` line**, because importing must work without an API key. Add the three commands to `APP_HELP`

**Checkpoint**: checks pass. Commit.

---

## Phase 7: Polish & Cross-Cutting

- [ ] T016 [P] Add the real-sample test T-g in `packages/data/src/cards/samples.local.test.ts`. The directory is `process.env.LITTLETAVERN_TEST_CARDS ?? path.resolve(<repo root>, "../test-cards")`; skip the suite with `describe.skipIf(!existsSync(dir))`. Import all nine files from research R7's table into a temporary library and assert each label, name and entry count. Never copy the sample files into the repository
- [ ] T017 Run `pnpm build && pnpm lint && pnpm test` and the automated part of quickstart. Fix any failures
- [ ] T018 Write `specs/002-card-import/report.md` with the same sections as `specs/001-tui-chat/report.md`, including a "Development tool and token usage" section. Commit

---

## Dependencies & Execution Order

The phases run in order: Setup → Foundational → US1 → US2 → US3 → US4 → Polish. Several of them
edit `library.ts` and its test, so do not run the stories in parallel.

**Parallel**: T003 and T004 can run together in Phase 2; T013 can run alongside T011 and T012.

## Implementation Strategy

1. **MVP** = Setup + Foundational + US1: cards import losslessly.
2. **US2 and US3** complete the format coverage.
3. **US4** makes the result visible to the owner, in the CLI and the app.
4. **Polish**: the real-sample check and the report.
