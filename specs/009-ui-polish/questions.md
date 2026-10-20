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

- Phase 4: `InputBox` contains the original Editor and uses pi's exported cursor helpers for
  its empty line; focus and editing still target the Editor. The placeholder keeps one cursor
  cell and truncates the hint to the remaining width.
- Phase 4: the status exposes top and bottom components from one `StatusInfo`. Top carries
  character/persona/model/key; bottom carries usage only after a request, with the compact
  form when the labelled form cannot fit. Persona names are read fresh on status updates.
- Phase 4: the existing simulated reply factory was synchronous in our adapter even though
  pi supports asynchronous factories. It now accepts a promise so the planned delayed-response
  lifecycle tests can use the real faux provider without timers or a network.

- Phase 5: Ctrl+O is active when the chat Editor has focus. It round-trips the current input
  through a private temporary `message.md`, uses the existing VISUAL/EDITOR launcher, and
  removes the temporary directory afterward. A failed editor leaves the input unchanged and
  shows an error. The terminal restarts in a `finally` block.
- Phase 5: T012's explicitly permitted deferral is recorded in the report; no palette-detection
  policy or asynchronous theme state was introduced.

- Phase 7: the later owner-feedback requirements FR-011–FR-014 and tasks T016–T020
  supersede the older centred-logo, plain-chat naming and startup descriptions in the
  original plan/research. The explicit logo fits at 35 columns. The picker uses
  `CharacterItem | "new"`, following the existing persona picker convention.
- Phase 7 setup: `.specify/feature.json` still points at 007. Prerequisites and convergence
  were run with an explicit absolute `SPECIFY_FEATURE_DIRECTORY` for 009 and persistence
  disabled; branch and stored feature state were left unchanged. Existing ignore rules
  already cover this private TypeScript workspace and its build/editor artifacts.

- Phase 8 owner follow-up overrides FR-012/T017: Enter opens only the chat layout.
  The original specification is retained for the design side; the later owner instructions
  are recorded as tasks T021–T023.
- Phase 8 owner-confirmed configuration rule: valid saved models and environment/saved API
  keys count as configured; a character (including a resumed chat) or Innkeeper must be
  explicitly selected in each app run. Picker cancellation never supplies a missing choice.
- Phase 8 implementation: the existing engine default remains an internal initialization
  value. A separate `modelSelected` flag prevents requests until a saved or newly selected
  model is valid; `chat` and `innkeeperSelected` track the current run’s explicit mode.
  The guard is shared by sending and regeneration; setup/offline commands stay available.

- Phase 9: setup requirements are current UI state, not historical notices. One reusable
  pi `Text` component is refreshed from `setupSteps` on entry, blocked attempts and status
  changes. Removing/reinserting only that component preserves ordinary transcript content
  and safely handles the existing transcript clear/rebuild paths.

## Open behaviour questions

None.
