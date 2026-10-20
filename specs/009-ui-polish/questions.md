# Implementation Notes: UI Polish

## Resolved implementation details

- Phase 1: `colourDialogue` scans each paragraph for the three opening delimiters, then
  styles through the matching close or paragraph end. No Markdown parser is duplicated.
- Phase 1: theme format types come from Node's `styleText` signature. The `NO_COLOR` branch
  removes colours before calling `styleText` with stream validation disabled, as R3 requires.
- Setup: dependencies were absent in this worktree. Installed the locked versions from the
  local cache with install scripts disabled; no dependency or lockfile changes.
- Plan's dependency list still mentions `getNativeClipboard`; the explicit updated R1 and
  T004 decision is to use the engine adapter over `copyToClipboard`.

- Phase 2: pi's full-screen layout uses a zero-basis primary ScrollView and fixed siblings.
  Existing app integration tests inspect the complete mounted document through `tui.children`
  instead of `tui.render`, which renders the layout root and gives a zero-basis scroll region
  no document height outside a terminal frame. Assertions still cover the same app content.
- Phase 2: wheel, native selection/copy, resize and restore on each exit path remain owner
  manual checks (T-j); the adapter's success/error contract has a small injected-function test.

## Open behaviour questions

None at the end of Phase 1.
