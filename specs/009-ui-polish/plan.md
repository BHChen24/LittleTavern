# Implementation Plan: UI Polish

**Branch**: `009-ui-polish` (stacked on the finished `008-persona`) | **Date**: 2026-10-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/009-ui-polish/spec.md`

## Summary

The visual layer changes; behaviour does not:

- **Full screen**: switch to pi-tui's full-screen `TuiAltScreen`, with the mouse on and app-owned
  copy-on-select.
- **Home screen**: a logo.
- **Messages**: a `MessageView` (equal-weight coloured labels, a left bar, dialogue colouring).
- **Errors**: an error notice style.
- **Feedback while waiting**: a `Loader` waiting indicator, and an `InputBox` placeholder
  wrapper.
- **Key first**: the status bar hides the model until a key exists, and `/apikey` chains into the
  model picker.
- **P3 items**: the status split, a maximum text width, `NO_COLOR`, and Ctrl+O to compose in
  `$EDITOR`.

**Must start after 008 is finished**, because both features edit `app.ts`. The branch is created
from 008's final commit (research R1–R7).

## Technical Context

**Language/Version**: TypeScript 7, Node 26

**Primary Dependencies**: none new. From `@earendil-works/pi-tui@1.3.0`:

- `TuiAltScreen`;
- `ScrollView`, through the alt screen's primary scroll view;
- `Loader`;
- `getNativeClipboard`;
- `Markdown`, `Text`, `Editor`;
- `queryTerminalColors` (optional).

**Storage**: `settings.json` gains `mouse?: boolean`, default `true`.

**Testing**: Vitest. Components are tested with `render` and `handleInput`. App-level tests run
through the existing harness, with stub terminals that are given the alt-screen methods if
needed.

**Constraints**:

- `stripControls` runs before any styling.
- Meaning never depends on colour alone.
- All 001–008 tests, and the 19 automated acceptance checks, stay green.

**Scale/Scope**: about 4 new components, plus edits to `app.ts`, `theme.ts`, `status-bar.ts`,
`home-screen.ts` and `settings.ts`.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

Checked against constitution 3.1.0.

| Principle | Status | How |
|---|---|---|
| I. Build on pi, own the context | Pass | Full screen, scrolling, selection, copy, search, the loader and the clipboard all come from pi-tui. Our code adds only the styling and the wrappers pi lacks (placeholder) |
| II. Wrap pi behind our types | Pass | `tui` only |
| III. Mechanism, not policy | Pass | — |
| IV. Lossless ecosystem data | Pass | Display only |
| V. SDD development usage accounting | Pass | Recorded in `specs/009-ui-polish/development-usage.md` |
| VI. MVP first | Pass | P3 items are kept only where cheap (research R7) |
| VII. Understandable over clever | Pass | One component per visual concern; `colourDialogue` is a small pure function |
| Language (3.1.0) | Pass | English strings; the logo is ASCII |
| Testing policy | Pass | See the Test Plan below |

## Project Structure

```text
packages/data/src/settings.ts                  # + mouse?: boolean
packages/engine/src/clipboard.ts                # copyText: adapter over pi coding-agent's copyToClipboard (R1)
packages/tui/src/theme.ts                       # named styles and palette (R3); NO_COLOR removes colours only
packages/tui/src/dialogue.ts                    # colourDialogue (R3)
packages/tui/src/components/message-view.ts     # label + bar + body, max width (R3, R7b)
packages/tui/src/components/input-box.ts        # placeholder wrapper around Editor (R5)
packages/tui/src/components/home-screen.ts      # + logo and fallback (R2)
packages/tui/src/components/status-bar.ts       # no-key form; top/bottom split (R6, R7a)
packages/tui/src/app.ts                         # TuiAltScreen, MessageView, Loader, error notices, /apikey → model picker, Ctrl+O
```

## Test Plan (complexity-assessed)

| # | Test | Complexity | Decision |
|---|---|---|---|
| T-a | `colourDialogue`: the three quote styles, unclosed quote stops at the paragraph, nothing outside quotes changes, and it is applied after `stripControls` | low | **write** |
| T-b | `MessageView`: equal-weight labels, bar on every body line, no blank line after the label, width capped at 100 | low | **write** |
| T-c | Home screen: logo at width ≥ logo + 4, plain title below | low | **write** |
| T-d | `InputBox` placeholder in the three states; disappears when typing | low | **write** |
| T-e | Status bar: no-key form hides the model; top/bottom split content | low | **write** |
| T-f | Error notices carry `Error:` | low | **write** |
| T-g | Waiting indicator with a delayed simulated reply: shown before the first delta, removed after; removed on Esc and on error | medium | **write** (the simulated reply factory can await) |
| T-h | `/apikey` → model picker opens after a key is saved or set for the session | low–medium | **write** through the app harness |
| T-i1 | Theme under `NO_COLOR`: no colour codes; `bold`, `italic` and `dim` kept | low | **write** (with T001) |
| T-i2 | Rendered under `NO_COLOR`: labels, bars, `Error:` and the status still present, with no colour codes | low | **write** (after messages and status exist, with T010) |
| T-k | Tiny terminal: home screen, a message and the status render at 30 columns with no line wider than the width, and no throw at 8 rows | low | **write** (with T010); the full check is manual (T-j) |
| T-j | Full-screen mode, wheel, selection and copy, and a terminal smaller than 40×10 | high (terminal emulation) | **manual** by the owner. pi-tui's own tests cover these mechanisms |

## Complexity Tracking

No violations.
