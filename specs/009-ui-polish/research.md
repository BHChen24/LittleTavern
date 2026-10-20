# Research: UI Polish

Verified on 2026-10-20 against `../pi` at `v1.3.0` and branch `007-integrated`, with 008's design
in mind.

## R1. Full screen: pi-tui `TuiAltScreen`, mouse on

- **Decision**: replace `new TuiMainScreen(terminal)` with
  `new TuiAltScreen(terminal, undefined, undefined, { mouse: settings.mouse !== false, copyOnSelect: true, copySelection })`
  (`packages/tui/src/tui-alt-screen.ts:168-200,255`).
- **Clipboard**: `copySelection` uses pi-tui's exported `getNativeClipboard()`. If no native
  clipboard is available, it returns an error message, and pi shows it.
- **Reference implementation**: pi coding-agent runs in this mode. See
  `../pi/packages/coding-agent/src/modes/interactive/tui-renderer.ts:26` and the interactive mode
  layout around it. Copy its structure: the transcript inside the primary `ScrollView`, with the
  input and status outside it.
- **Free features**: keyboard and wheel scrolling of the primary scroll view, app-owned selection
  with copy-on-release, and transcript search (`ctrl+shift+f`, `keybindings.ts:192`). Mention
  search in `/help`.
- **Mouse setting**: `settings.json` gains `mouse?: boolean`, read once at startup. When it is
  `false`, mouse capture is off and the terminal's own selection works.
- **Restore on exit**: keep 001's `tui.stop()` on every exit path. Verify by hand that the alt
  screen is left on Ctrl+C, `/quit`, and a thrown error.

## R2. Logo

- An ASCII or box-drawing logo kept as a constant in `components/home-screen.ts`, at most 60
  columns wide and 6 lines tall, styled with the accent colour.
- The logo is shown when `width >= logoWidth + 4`, and a plain `LittleTavern` title otherwise.
  It is centred by padding.
- The logo text is original artwork; it is not copied from figlet fonts that carry their own
  licences.

## R3. Message rendering

- **Label and bar**: one `MessageView` component in `components/message-view.ts` renders a
  bold label in the speaker colour, then the Markdown body indented by two columns with a `│ `
  bar in the speaker colour. There is no blank line between the label and the body, and the
  transcript adds one blank line between messages.
- **Colours**: user and character share the same weight and differ only in colour.
- **Dialogue colouring**: a pure function `colourDialogue(text)` wraps `"…"`, `“…”` and `「…」`
  spans in the dialogue style. It never crosses a blank line (paragraph), so an unclosed quote
  stops at the paragraph end. It runs **after** `stripControls`, and on the text before it is
  handed to pi-tui `Markdown`. `*…*` italics are left to Markdown.
- **Errors**: `notice(text, { kind: "error" })` renders an `Error: ` prefix with the error style.
  Every place that reports a provider error or a failed command uses it.

## R4. Waiting indicator

- **Component**: pi-tui `Loader` (`components/loader.ts`; constructor, `start`, `stop`,
  `setMessage`), the same one used in pi's `chat-simple.ts`.
- **Lifecycle**:
  - inserted where the reply will appear when a request starts;
  - removed on the first delta, on finish, on error, and on Esc;
  - the message is `"<name> is writing…"`.

## R5. Input placeholder

- pi-tui's `Editor` has no placeholder.
- **Decision**: `InputBox` in `components/input-box.ts` wraps the editor. When the text is empty,
  it renders the placeholder line (muted) in place of the empty editor content, keeping the
  editor's border and cursor. Everything else is delegated to the editor.
- **Placeholder by state**: `Talk to <name>… (/ for commands)`, `Talk… (/ for commands)`, or
  `Add your key with /apikey to start talking`.

## R6. Key first, then model

- The status bar receives `keySource`. When it is `"none"`, the bar renders
  `No API key — /apikey` and omits the model.
- After a successful `/apikey` entry, the app opens the existing `ModelPicker` with the current
  model preselected. Esc keeps the current model.

## R7. Optional items (P3), assessed

| Item | Effort | Decision |
|---|---|---|
| a. status split (top line: character, persona, model; bottom line: tokens, cache, cost) | low: a second `StatusBar`-like line above the transcript | **include** |
| b. maximum text width of about 100 columns | low: `MessageView` renders at `min(width, 100)` | **include** |
| c. `NO_COLOR` and light/dark | `NO_COLOR` is low (check whether `node:util` `styleText` already honours it, otherwise gate the theme); light/dark is medium (pi-tui `TUI.queryTerminalColors()` plus a second palette) | **include `NO_COLOR`; light/dark only if time allows, otherwise defer** |
| d. `$EDITOR` for long messages | low: 007's `openInEditor` plus **Ctrl+O**, which edits the current input text in the editor. Ctrl+E is pi-tui's end-of-line key and Ctrl+G is pi's search navigation; Ctrl+O is unbound | **include** |
