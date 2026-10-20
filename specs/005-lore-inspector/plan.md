# Implementation Plan: Lore Inspector

**Branch**: `005-lore-inspector` (stacked on `004-character-chat`) | **Date**: 2026-10-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/005-lore-inspector/spec.md`

## Summary

This feature makes 003's trace visible in two ways:

1. **Dry run.** `littletavern dry-run <character> [--message] [--session] [--json]` builds the
   assembly input with the same code that 004 uses for a real request, then prints a report and
   the assembled request. It has no provider, no key and no file writes.
2. **`/trace` overlay.** It shows 004's `lastTrace` for the current character chat in a small
   scrollable window.

Both use one formatter. The report puts the summary first, then the parts, the fired entries, and
the not-fired entries grouped by reason.

## Technical Context

**Language/Version**: TypeScript 7, Node 26

**Primary Dependencies**: none new. `@earendil-works/pi-tui@1.3.0` provides the overlay,
`visibleWidth` and `truncateToWidth`.

**Storage**: none. It reads the library, settings and sessions, and writes nothing.

**Testing**: Vitest. The formatter is tested on synthetic traces. The dry run is tested in-process
through `runCli`, with a temporary library and no key.

**Target Platform**: Linux and WSL

**Project Type**: workspace feature. One refactor in `engine` (`assembleForCharacter`); the rest is
in `tui`.

**Performance Goals**: a dry run of a sample card finishes in under 1 s (SC-002). This is easily
met.

**Constraints**:

- The dry run never constructs a `ChatSession`, `Agent` or `SessionManager.create`.
- The overlay never re-runs the assembly (FR-006).

**Scale/Scope**: about 4 source files plus small edits to `character-chat.ts`, `cli.ts` and
`app.ts`.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

Checked against constitution 3.0.0.

| Principle | Status | How |
|---|---|---|
| I. Build on pi, own the context | Pass, one exception | pi-tui's overlay and width utilities are used. Scrolling is a small windowed component instead of pi's `ScrollView` (see Complexity Tracking) |
| II. Wrap pi behind our types | Pass | `assembleForCharacter` returns our own types. tui uses pi-tui directly, which the constitution allows |
| III. Mechanism, not policy | Pass | It only displays what the trace says. No interpretation is added |
| IV. Lossless ecosystem data | Pass | Read-only |
| V. SDD development usage accounting | Pass | Recorded in `specs/005-lore-inspector/development-usage.md` |
| VI. MVP first | Pass | No in-app preview and no side panel (clarified) |
| VII. Understandable over clever | Pass | One formatter returning `string[]`, a reason-sentence table, and a windowed list of about 40 lines |
| Testing policy | Pass | See the Test Plan below |

Re-checked after Phase 1 design: unchanged, all pass.

## Project Structure

### Documentation (this feature)

```text
specs/005-lore-inspector/
├── spec.md, plan.md, research.md, data-model.md, quickstart.md
├── contracts/cli-and-overlay.md
├── checklists/requirements.md
└── tasks.md
```

### Source Code

```text
packages/engine/src/character-chat.ts     # extract assembleForCharacter (research R1); send() calls it
packages/engine/src/dry-run.ts            # dryRun({ paths, characterId, message?, session? }) → { prompt, trace, item }
packages/engine/src/dry-run.test.ts
packages/tui/src/trace-format.ts          # formatTraceReport, formatAssembledPrompt (R2–R4)
packages/tui/src/trace-format.test.ts
packages/tui/src/components/trace-overlay.ts  # windowed scrolling overlay (R5)
packages/tui/src/cli.ts                   # + dry-run subcommand (R6)
packages/tui/src/app.ts                   # + /trace
```

**Structure Decision**: The data path (`assembleForCharacter`, `dryRun`) goes in `engine`, so the
dry run and the chat cannot drift apart. Presentation goes in `tui`.

## Test Plan (complexity-assessed)

| # | Test | Complexity | Decision |
|---|---|---|---|
| T-a | Formatter: summary line content; the notes line appears only when notes exist; the parts table; fired lines with reason sentences; not-fired groups with counts; "No lorebooks."; ignored features suffix; invariant "every entry exactly once" | low | **write** |
| T-b | Formatter: CJK names are aligned and truncated by display width | low | **write** |
| T-c | `assembleForCharacter` refactor: 004's character-chat tests still pass unchanged | low | **existing tests** |
| T-d | `dryRun`, new chat: history is the greeting plus the message; no session files are created; `trace.lore` covers every entry | low | **write** |
| T-e | `dryRun`, saved chat: uses the current branch after a regeneration; an unknown session gives an error | medium | **write** |
| T-f | SC-003: for the same character, settings and history, the trace from `dryRun` deep-equals the `lastTrace` from a simulated `CharacterChat.send` | medium | **write** |
| T-g | CLI: text output contains the report and `── Request ──`; `--json` parses and has `prompt` and `trace`; an unknown id exits with 1; no key in the environment | low | **write** (in-process `runCli`) |
| T-h | `TraceOverlay`: renders a window and a footer; the arrow keys and PgDn move the offset within bounds; Esc calls `onClose` | low | **write** (call `render(width)` and `handleInput` directly) |
| T-i | `/trace` in the app: notice without a character or without a request; the overlay opens after a simulated send | medium | **try** with 001's app test harness. Defer it if the harness needs more than about 60 lines |

## Complexity Tracking

| Exception | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| Our own windowed `TraceOverlay` instead of pi-tui's `ScrollView` (constitution I) | Scrolling a fixed-height overlay | `ScrollView` learns its viewport from pi's layout pass (`updateLayout`). Wiring that into an overlay is more code and harder to explain than about 40 lines of offset arithmetic. If the implementer finds `ScrollView` simpler in practice, it is preferred (research R5) |
