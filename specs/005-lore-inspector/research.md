# Research: Lore Inspector

Verified on 2026-10-19 against `../pi` at `v1.3.0` and the planned 003 and 004 code (the 003 and
004 tasks).

## R1. The dry run takes the same path as a real request (FR-002)

- **Decision**: In 004's `CharacterChat.send`, the steps from "re-read the settings" to "call
  `assemblePrompt`" are moved into one exported engine function:

  ```text
  assembleForCharacter({ paths, item, history, modelId }) → { prompt, trace, notices }
  ```

  `send` and the dry run both call it. This is a small refactor of 004 code, and it is the only
  way to guarantee SC-003 (the dry run and `/trace` show the same thing).
- **Dry-run history**:
  - New chat: the greeting, if it is non-empty, followed by the message, if one is given.
  - Saved chat: the current branch, read with `SessionManager.open(path, sessionDir)` (read-only,
    nothing is appended), followed by the message.
- **No network, no key**:
  - The context window comes from `findAllowedModel(settings.model ?? DEFAULT_MODEL_ID)`, which
    reads pi's offline catalogue.
  - Nothing builds a `ChatSession` or `Agent`.
  - No `SessionManager.create` is called, so the dry run writes no files.

## R2. One formatter, two surfaces

- **Decision**: `formatTraceReport(trace, meta)` and `formatAssembledPrompt(prompt)` live in
  `packages/tui/src/trace-format.ts` and return `string[]`. This is the same pattern as 002's
  `library-format.ts`.
  - `meta` is `{ characterName, modelId, loreBudget }`.
  - The dry run prints the report lines, then a `── Request ──` separator, then
    `formatAssembledPrompt`.
  - `/trace` shows only the report lines.
- **Width-aware alignment**: use pi-tui's `visibleWidth` and `truncateToWidth`, so Chinese names
  line up and are cut by display width rather than by character count.

## R3. Reason sentences (FR-009)

| `reason.kind` | Sentence |
|---|---|
| `constant` | `always on` |
| `keyword` | ``keyword `<key>` in message <n>`` |
| `disabled` | `disabled` |
| `no-match` | `no keyword in the last <depth> messages` |
| `no-keywords` | `no keywords defined` |
| `budget` | `over budget` |

When an entry has no name, it is shown as `entry #<index + 1>`. Ignored features are appended to
the entry's line as `(ignored: secondary keys, probability)`.

## R4. Report layout (FR-008)

```text
<character> · <model> · ~<total> tokens (estimate) · lore ~<used>/<budget> · history <kept> kept, <left> left out
Notes: <note>; <note>                       (only when there are notes)
Parts (estimated tokens)
  main          ~120
  lore-before   ~340   2 entries
  description   ~410
  ...
Lore fired (<n>)
  <lorebook> · <entry>   keyword `灯塔` in message 3   ~180
Lore not fired (<n>)
  no keyword in the last 2 messages (5): <entry>, <entry>, …
  over budget (1): <entry>
  disabled (2): <entry>, <entry>
```

When there are no lorebooks, both lore sections are replaced by `No lorebooks.`

## R5. Scrolling inside the overlay

- **Decision**: a small `TraceOverlay` component in `packages/tui/src/components/trace-overlay.ts`.
  - It holds the report lines and an `offset`, and renders `height` lines starting at `offset`.
  - Up/Down move one line, PgUp/PgDn move one page and Home/End jump to either end.
  - Esc calls `onClose`, and a footer line shows `lines a–b of n · Esc to close`.
  - The height is the overlay's maximum height minus the footer.
- **Rationale**: pi-tui's `ScrollView` relies on pi's layout pass (`updateLayout(contentHeight,
  viewportHeight, …)`) to learn its viewport. Wiring that into a fixed overlay costs more code and
  is harder to explain than a windowed list of about 40 lines. This is recorded as a constitution I
  exception in plan.md's Complexity Tracking.
- **Fallback**: if the implementer finds that `ScrollView` works in an overlay with less code, use
  it and note this in the report.

## R6. Command-line syntax

`littletavern dry-run <character-id> [--message <text>] [--session <id-or-path>] [--json]`

- `--session` takes a session id prefix, which is looked up in `listChats(paths)` from 004, or a
  file path.
- `--json` prints `JSON.stringify({ prompt, trace }, null, 2)`.
- The exit code is 0 on success, and 1 for an unknown or ambiguous id, an unknown session, or a
  missing character.
