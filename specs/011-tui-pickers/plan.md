# Implementation Plan: Pickers Instead of Ids

**Branch**: `011-tui-pickers` (from `main` at `827e8ef`; merged by pull request) | **Date**:
2026-10-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/011-tui-pickers/spec.md`

## Summary

Remove every typed id from the app:

- `/show` becomes a searchable picker;
- `/lorebooks` becomes a picker that toggles attachments and can import and attach a lorebook;
- `/new` starts a new chat;
- `/chat`, `/attach` and `/detach` are removed;
- every overlay is drawn inside a box frame;
- push-triggered CI runs only on `main`.

The work reuses `ListPicker`, `FileBrowser` and the existing attachment storage. It adds two small
engine methods and one TUI component.

## Technical Context

**Language/Version**: TypeScript 7 with `tsc -b`; Node.js `>=22.19.0`.

**Primary Dependencies**: pi 1.3.0 (`pi-tui` for `fuzzyFilter`, `visibleWidth` and
`truncateToWidth`). No new dependency.

**Storage**: unchanged (settings `lorebookAttachments`, library, session files).

**Testing**: Vitest. Unit tests for `Frame`. App-harness tests for the commands. The happy path
uses the simulated provider.

**Target Platform**: terminals on Linux, macOS and Windows.

**Project Type**: pnpm workspace (`data`, `engine`, `tui`).

**Constraints**: English only. No new dependency. Build only what `tasks.md` asks for.

**Scale/Scope**: one new component, about 6 edited source files, and docs.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

Checked against constitution 3.2.0.

| Principle | Status | How |
|---|---|---|
| I. Build on pi, own the context | Pass | Pickers reuse pi-tui `fuzzyFilter`, `SelectList` and `Input` through `ListPicker`. `Frame` exists because pi-tui 1.3.0 has no bordered container (R1); it is about 40 lines |
| II. Wrap pi behind our types | Pass | The TUI calls engine methods (`attachedLorebookIds`, `clearConversation`), not pi-agent-core |
| III. Mechanism, not policy | Pass | No content rules change |
| IV. Lossless ecosystem data | Pass | No data format changes |
| V. SDD development usage accounting | Pass | Recorded in `specs/011-tui-pickers/development-usage.md` |
| VI. MVP first | Pass | The `/lorebooks` picker closes after each choice instead of live-refreshing (R2); titles stay inside the frame (R1) |
| VII. Understandable over clever | Pass | One wrapper (`showPanel`) for every overlay; one shared import function (`importSelected`) |
| Workflow (3.2.0) | Pass | Branch from `main`; the owner merges the pull request |
| Testing policy | Pass | Unit tests for our code; the happy path uses the faux provider; the look is checked manually |

## Project Structure

### Documentation (this feature)

```text
specs/011-tui-pickers/
├── spec.md
├── plan.md               # this file
├── research.md           # R1–R8
├── data-model.md         # picker entries and transitions (no storage change)
├── contracts/
│   └── commands.md       # commands, messages, frame
├── quickstart.md
└── tasks.md              # $speckit-tasks output
```

### Source Code (repository root)

```text
.github/workflows/ci.yml                     # push only on main (R7)
packages/engine/src/character-chat.ts        # + attachedLorebookIds()
packages/engine/src/chat-session.ts          # + clearConversation()
packages/tui/src/theme.ts                    # export the frame border style
packages/tui/src/components/frame.ts         # new: Frame (R1)
packages/tui/src/commands.ts                 # remove chat/attach/detach; show without argument; add new
packages/tui/src/app.ts                      # showPanel, importSelected, /show, /lorebooks, /new, streaming message
specs/006-usability/contracts/commands.md    # rows marked "changed by 011"
README.md                                    # command table
```

**Structure Decision**: keep the three-package workspace. Picker building stays in `app.ts`, next
to the existing pickers, so all pickers read the same way.

## Test Plan (complexity-assessed)

| # | Test | Complexity | Decision |
|---|---|---|---|
| T-a | `Frame`: the border surrounds the child at the given widths (80 and 40); child lines wider than the inner width are truncated; a line with a wide character (CJK) keeps the right border aligned; a `ListPicker` with a title longer than the inner width renders the title on several lines, all inside the border; with `NO_COLOR` the box characters are present; `focused` and `handleInput` reach the child | low | **write** |
| T-b | `COMMANDS()`: no `chat`, `attach` or `detach`; `show` has no argument hint or completion; `new` exists | low | **write** (update the existing command tests) |
| T-c | App `/show`: opens a picker listing the library items; choosing one shows `formatItemDetails`; `/show x` shows the contract message and looks nothing up; an empty library shows `EMPTY_LIBRARY_HINT`. (Damaged items are skipped by `listLibrary`, already covered by its tests; no new test) | low | **write** |
| T-d | App `/lorebooks`: entry order and states (import, card, attached, not attached, missing); toggle attach and detach with the messages; the card entry changes nothing; a missing entry detaches; a library with no lorebooks still shows the import entry (and the card entry when the card has one); no chat gives the existing message; settings reflect each change | low–medium | **write** |
| T-e | App `/lorebooks` import: a lorebook file in the import folders is imported and attached; importing it again (`already imported`) attaches it once, with no duplicate in the library or the attachment list; a character file is reported and not attached; a damaged lorebook file is reported as with `/import` and nothing is attached; a file outside the root (link) is refused with the existing message | low–medium | **write** |
| T-f | App `/new`: a character chat gets a new session with the greeting, and the old session file still exists; `/new` in a chat resumed from `/sessions` starts a new chat with that chat's character; a deleted character gives its message; innkeeper mode clears the conversation (the next request has no earlier innkeeper messages); with no chat, the message; while streaming, the message and nothing changes | medium | **write** |
| T-g | Removed commands: `/chat x`, `/attach x` and `/detach x` give "Unknown command. Use /help." | low | **write** |
| T-h | **Happy path** (faux provider): a chat with a synthetic character; attach a synthetic lorebook through `/lorebooks`; send a message whose keyword fires it and check the trace includes the entry; `/new`; the next request contains only the greeting and the new message | medium | **write** |
| T-i | Existing `/import` tests still pass after the `importSelected` refactor | low | **run** |
| T-j | CI change (FR-011): `ci.yml` parses as YAML, with `push.branches == ["main"]` and `pull_request` present | low | **run**: a short node check, recorded in the report |
| — | Look of the frames at two widths and with `NO_COLOR` | — | **owner, manual** (quickstart step 7) |

## Notes for the owner

- The guided steps of `../acceptance/run-v1-acceptance.sh` (step 12) use `/chat` and `/attach`.
  That script is outside the repository; Claude updates it, not the implementer.
- `/innkeeper` still keeps earlier innkeeper turns in the engine while clearing the screen
  (research R6). That is unchanged here and noted for 013.

## Complexity Tracking

| Item | Why needed | Simpler alternative rejected because |
|---|---|---|
| New `Frame` component | FR-008; pi-tui 1.3.0 has no bordered container | Drawing borders inside each of 8 overlay components duplicates the same code |
