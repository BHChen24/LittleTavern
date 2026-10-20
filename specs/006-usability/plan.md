# Implementation Plan: Usability Pass

**Branch**: `006-usability` (stacked on `005-lore-inspector`) | **Date**: 2026-10-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/006-usability/spec.md`

## Summary

This feature makes v1 discoverable and pleasant without adding capabilities:

- **Command suggestions**: one `COMMANDS` table feeds pi-tui's `CombinedAutocompleteProvider`,
  including argument suggestions for characters, lorebooks and paths, and also generates `/help`.
- **Import browser**: `/import` with no argument opens a file browser at the import root
  (`~/.littletavern/{characters,lorebooks}`).
- **Home screen**: the app now opens on a home screen.
- **API key**: the key is entered only through `/apikey` (OpenRouter only, "this session only" by
  default). A message sent without a key is intercepted instead of triggering a startup prompt.
- **Polish**: the earlier layout and style notes.
- **Language rule**: a test enforces the English-only rule of constitution 3.1.0.

## Technical Context

**Language/Version**: TypeScript 7, Node 26

**Primary Dependencies**: no new ones. From `@earendil-works/pi-tui@1.3.0` this feature uses
`CombinedAutocompleteProvider`, `SlashCommand`, `Editor.setAutocompleteProvider`, and the
existing `ListPicker` built on `SelectList` and `Input`.

**Storage**: none new. The import folders are created at startup (research R2).

**Testing**: Vitest, using the component-level `render` and `handleInput` tests and the app
harness used in 004 and 005.

**Target Platform**: Linux and WSL

**Project Type**: TUI changes in `tui`, plus one paths change in `data`

**Constraints**:

- The automated v1 acceptance checks keep passing (SC-005).
- Tests never touch the real `~/.littletavern`, because `LITTLETAVERN_HOME` redirects the import
  root.

**Scale/Scope**: about 5 new or changed components and a significant `app.ts` refactor
(command table, home screen, key flow).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

Checked against constitution 3.1.0.

| Principle | Status | How |
|---|---|---|
| I. Build on pi, own the context | Pass | Suggestions use pi-tui's provider and `SlashCommand`. The browser reuses pi-tui widgets through `ListPicker` |
| II. Wrap pi behind our types | Pass | Only `tui` touches pi-tui, which is allowed |
| III. Mechanism, not policy | Pass | — |
| IV. Lossless ecosystem data | Pass | Import goes through the unchanged `importFile`, and files are left in place |
| V. SDD development usage accounting | Pass | Recorded in `specs/006-usability/development-usage.md` |
| VI. MVP first | Pass | Only what the owner asked for; character creation is 007 |
| VII. Understandable over clever | Pass | One command table instead of scattered strings. `app.ts` dispatch becomes table-driven, which makes it shorter |
| Language (3.1.0) | Pass | Enforced by a new test (research R6) |
| Testing policy | Pass | See the Test Plan below |

Re-checked after Phase 1 design: unchanged, all pass.

## Project Structure

```text
packages/data/src/paths.ts                    # + importRoot, importCharactersDir, importLorebooksDir; ensureImportFolders
packages/tui/src/commands.ts                  # COMMANDS table, argument completions, helpText()
packages/tui/src/components/file-browser.ts   # import browser (R2)
packages/tui/src/components/home-screen.ts    # home screen (R3)
packages/tui/src/components/key-prompt.ts     # session-only default, provider step (R4)
packages/tui/src/app.ts                       # wire suggestions, browser, home screen, /apikey, interception, polish
packages/tui/src/theme.ts                     # message label styles (R5)
packages/tui/src/language.test.ts             # English-only rule (R6)
../acceptance/run-v1-acceptance.sh            # outside the repo: update the guided steps to the new flows (owner-side, see T014)
```

## Test Plan (complexity-assessed)

| # | Test | Complexity | Decision |
|---|---|---|---|
| T-a | `COMMANDS` generates the `/help` text; every command appears in both; `/key` and `/forget-key` are absent | low | **write** |
| T-b | Argument completions: `/chat` lists only characters; `/attach` only lorebooks; `/detach` only attached lorebooks; `/import` lists sub-folders and `.json`/`.png` files under the import root | low | **write** |
| T-c | `ensureImportFolders` creates both folders under `LITTLETAVERN_HOME/import`, leaves existing files alone, and returns a notice when the root is a file | low | **write** |
| T-d | `FileBrowser`: listing order, the `..` entry, the extension filter, typing narrows the list, entering a folder, selecting a file calls `onSelect`, the empty-folder message, Esc | low | **write** |
| T-e | `HomeScreen` content with and without a key, with an empty library; Enter in the app switches to the chat view | low–medium | **write** |
| T-f | Interception: with no key, `submit("hello")` sends nothing, shows the `/apikey` notice and restores the input; the same for `/regenerate` | low | **write** |
| T-g | `/apikey` flow: provider list contains only OpenRouter; the default choice is session only and writes no credentials file; Save writes it with mode 0600; Forget appears only when a saved key exists | medium | **write** |
| T-h | Status bar is the last rendered line of the chat view; labels `You:`, `<name>:` and the notice prefix are present | low | **write** |
| T-i | Language test (R6) | low | **write** |
| T-j | Suggestion popup behaviour inside the real editor (typing `/` opens it, Tab accepts it) | medium-high | **try** through the app harness; defer if it needs more than about 60 lines, since pi-tui owns the popup |

## Complexity Tracking

No constitution violations need justifying.
