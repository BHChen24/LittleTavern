# Research: UI Polish

Verified on 2026-10-20 against `../pi` at `v1.3.0` and branch `007-integrated`, with 008's design
in mind.

## R1. Full screen: pi-tui `TuiAltScreen`, mouse on

- **Decision**: replace `new TuiMainScreen(terminal)` with
  `new TuiAltScreen(terminal, undefined, undefined, { mouse: settings.mouse !== false, copyOnSelect: true, copySelection })`
  (`packages/tui/src/tui-alt-screen.ts:168-200,255`).
- **Clipboard**: reuse pi coding-agent's own copy logic, `copyToClipboard(text)`, which
  `@earendil-works/pi-coding-agent` exports (`src/index.ts:491`) and its full-screen mode passes
  as `copySelection` (`tui-renderer.ts:39-46`). It covers macOS, Windows, Wayland (`wl-copy`),
  X11 (`xclip`/`xsel`), WSL (OSC 52 in Windows Terminal, otherwise the Windows clipboard) and
  SSH (OSC 52), and throws a readable message when nothing works.
  - Wrap it in the engine, which already depends on pi-coding-agent (constitution II): a small
    adapter `packages/engine/src/clipboard.ts` exporting `copyText(text): Promise<true | string>`,
    `true` on success and the error message otherwise. The `tui` package passes
    `copySelection: copyText` to `TuiAltScreen`, and pi shows the message on failure.
  - Do **not** use pi-tui's `getNativeClipboard()`: its `setText` is optional and absent on Linux
    (`native-platform.ts:16`), and it needs `DISPLAY`. Found by Codex's analysis on 2026-10-20.
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
- **Palette** (the 16 standard ANSI colours, so the terminal's own theme adapts them; tuned for
  dark backgrounds):

  | Style | Formats | Used for |
  |---|---|---|
  | `user` | `green` (label also `bold`) | the user's label and bar |
  | `character` | `magenta` (label also `bold`) | the character's label and bar |
  | `dialogue` | `yellow` | quoted speech |
  | `notice` | `dim`, `italic` | ordinary notices |
  | `error` | `red` (the `Error:` prefix also `bold`) | error notices |
  | `accent` | `cyan` | logo, Markdown headings and links (as today) |
  | `muted` | `dim` | placeholder, borders, secondary status text |

  The optional light palette (T012) changes only `dialogue` to `blue` and `muted` to the default
  foreground; it exists only if T012 is done.
- **`NO_COLOR`** (non-empty, per no-color.org) removes **colours only**. Text attributes stay:
  `bold`, `italic`, `dim`. So labels stay bold, `*actions*` stay italic and `Error:` stays.
  - Checked on Node 26.7: `styleText` honours `NO_COLOR` but strips **every** format, including
    `italic`, which would break FR-005. So the theme filters the colour formats out itself when
    `NO_COLOR` is set, and only then calls `styleText(rest, text, { validateStream: false })`,
    still returning plain text when `process.stdout.isTTY` is false (as `styleText` does today,
    which keeps existing tests stable). Without `NO_COLOR`, `styleText` is called as today.
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
| c. `NO_COLOR` and light/dark | `NO_COLOR` is low (rule in R3: colours removed, attributes kept); light/dark is medium (pi-tui `TUI.queryTerminalColors()` plus the light palette in R3) | **include `NO_COLOR`; light/dark only if time allows, otherwise defer** |
| d. `$EDITOR` for long messages | low: 007's `openInEditor` plus **Ctrl+O**, which edits the current input text in the editor. Ctrl+E is pi-tui's end-of-line key and Ctrl+G is pi's search navigation; Ctrl+O is unbound | **include** |
