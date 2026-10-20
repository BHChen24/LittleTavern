# Research: Pickers Instead of Ids

Verified on 2026-10-20 against `main` at `827e8ef` (branch `011-tui-pickers`) and pi `v1.3.0`.

## R1. Overlay borders

- **Facts**:
  - pi-tui's `showOverlay(component, options)` takes sizing, anchoring, margin and visibility
    options, but nothing that draws a border.
  - pi-tui's `Box` adds padding and a background, and no border.
  - pi-coding-agent's `DynamicBorder` draws a single horizontal line; it is not a frame and is not
    a pi-tui export.
  - The app opens 11 overlays in `app.ts`, all through `tui.showOverlay`:
    - the key prompt;
    - the API-key actions and provider pickers;
    - the character, session, persona and model pickers;
    - the persona actions;
    - the file browser;
    - the trace;
    - help.
  - None of our overlay components implements `handleMouse`.
  - Several of them forward `focused` to an inner input, so the terminal cursor and IME position
    are right.
- **Decision**: add one small component, `Frame` in `packages/tui/src/components/frame.ts`.
  - It wraps a child component and draws `┌─┐`, `│ │` and `└─┘` around it.
  - The child renders at `width - 4`: a border and one space on each side.
  - Each child line is padded or truncated to fit, with pi-tui's `visibleWidth` and
    `truncateToWidth`, so wide characters and ANSI styles never push the right border.
  - The border uses the same `dim` style that the input editor's border already uses
    (`editorTheme.borderColor` in `theme.ts`, exported for this purpose). Under `NO_COLOR` the
    style may disappear, but the box-drawing characters stay.
  - `Frame` forwards `handleInput`, `invalidate` and the `focused` getter and setter to the child.
  - The child keeps its own title line inside the frame (for example "Choose a character (Enter
    starts a chat, Esc cancels)"), which meets the spec's "border and title" without moving
    titles. `ListPicker` renders its title with pi-tui's `Text`, which **wraps**. Because the child
    renders at the inner width, a long title wraps onto further lines inside the frame. Entries
    are truncated by pi-tui's `SelectList`. The frame's own truncation is only a safety net for
    child lines that come out wider than the inner width.
  - Every `tui.showOverlay(x, options)` call in `app.ts` goes through one helper,
    `showPanel(x, options)`, which wraps `x` in a `Frame`. No other call opens an overlay.
- **Alternatives**:
  - Draw the border inside each component: 8 places to change, and they would drift apart.
  - Put the title inside the top border: nicer, but every component would need its title
    removed. It can be done later.

## R2. Pickers

- **Facts**:
  - `ListPicker<T>(title, items, placeholder)` filters with pi-tui's `fuzzyFilter` on each item's
    `search` text.
  - Choosing an item calls `onSelect(value)`; Esc calls `onCancel`.
  - The list is rebuilt whenever the filter text changes, and it shows "(nothing here yet)" when
    it has no items.
  - `/characters` already puts a special first entry ("New character") before the library items.
- **Decision**: reuse `ListPicker` unchanged for `/show` and `/lorebooks`.
  - The `/lorebooks` picker **closes after each choice** and the app confirms the change; the user
    reopens `/lorebooks` to change another one.
  - Keeping it open would mean refreshing labels inside `ListPicker` while keeping the selection,
    which it does not support. The spec leaves this to the plan.

## R3. Command dispatch

- **Facts**:
  - `submit()` returns at once when `session.isStreaming` is true. The text stays in the editor,
    and nothing is shown.
  - A command without `argumentHint` that has extra text is "Unknown command", except `import`,
    which 010 special-cased.
  - `COMMANDS()` is the single definition used by completion, dispatch and help.
- **Decisions**:
  - Remove `chat`, `attach` and `detach` from `COMMANDS()` and from the handler table. Typing
    them gives the existing "Unknown command. Use /help."
  - `show` loses its `argumentHint` and completion. In dispatch, `show` joins `import` in the
    special case: any text after it shows the contract message and looks nothing up.
  - `/new` is added to `COMMANDS()` with no argument.
  - **Streaming**: before the early `isStreaming` return in `submit()`, if the trimmed text is
    `/new`, show the contract message. Other input keeps today's behaviour (the spec only asks
    this of `/new`).

## R4. Lorebook attachments

- **Facts**:
  - `CharacterChat.attachLorebook(id)` resolves the id with `getItem`, accepting a prefix, and
    appends it to `settings.lorebookAttachments[<character id>]` without duplicates.
  - `detachLorebook(id)` removes entries **starting with** `id` and returns whether anything was
    removed.
  - `activeLorebooks()` returns the card's embedded book, then the attached ids that still resolve
    to a library lorebook. **Attached ids that no longer resolve are skipped silently.**
- **Decision**: add `CharacterChat.attachedLorebookIds(): string[]`, which returns the raw stored
  ids. The picker is built in the TUI from:
  - the card's embedded book (`chat.character.lorebook`), marked "part of the card", which cannot
    be toggled;
  - every library lorebook (`listLibrary`), marked attached or not attached by membership in
    `attachedLorebookIds()`;
  - every attached id with no library lorebook, marked "attached, missing from the library"
    (choosing it detaches it).

  Toggling calls `attachLorebook(item.id)` or `detachLorebook(id)` with the full id, so the prefix
  behaviour never matters. Storage does not change.

## R5. Importing from `/lorebooks`

- **Facts**:
  - `/import` opens `FileBrowser(paths.importRoot, paths.importRoot)`.
  - On selection it checks that the real path is inside the real import root, then calls
    `showImportReport(file)`, which runs `importFile` and prints `formatImportReport`.
  - `ImportReport` includes the `LibraryItem` on success (`imported` and `already-imported`).
- **Decision**:
  - Move the selection check and the import into one function, `importSelected(selected):
    ImportReport | null`. It returns `null` when the file was refused as outside the import
    folders, after showing that message; otherwise it shows the report and returns it.
  - `/import` uses it unchanged in behaviour.
  - The `/lorebooks` import entry opens `FileBrowser(paths.importLorebooksDir, paths.importRoot)`:
    it starts in the lorebooks folder, and the root is the whole import root, as for `/import`.
    It calls `importSelected`, and when the report is ok and the item is a lorebook, it calls
    `chat.attachLorebook(item.id)` and confirms with `Attached <name>.`
  - A non-lorebook result is reported and nothing is attached.

## R6. `/new`

- **Facts**:
  - `startChat(item)` always calls `CharacterChat.start`, which creates a new session file with
    the character entry and greeting. Older sessions are untouched and listed by `/sessions`.
  - `CharacterChat` exposes `libraryId`.
  - **Innkeeper mode**: the innkeeper conversation lives in `ChatSession`'s agent messages.
    `/innkeeper` clears only the on-screen transcript, so the agent still holds earlier innkeeper
    turns.
- **Decisions**:
  - In a character chat, `/new` looks up `getItem(paths, chat.libraryId)`. If it is missing or no
    longer a character, it shows the contract's "no longer in the library" message. Otherwise it
    calls `startChat(item)`, which also covers resumed chats.
  - In innkeeper mode, `/new` calls a new `ChatSession.clearConversation()`, which sets
    `this.agent.state.messages = []`, the same mechanism `generate()` already uses to restore
    messages. It also clears the transcript and shows the contract message.
  - Changing `/innkeeper`'s own behaviour (that it keeps earlier innkeeper turns) is **out of
    scope**; it is noted for 013.

## R7. CI duplicates

- **Fact**: `ci.yml` runs `on: [push, pull_request]`, so a branch with an open pull request runs
  every job twice.
- **Decision** (spec FR-011): `on: { push: { branches: [main] }, pull_request: {} }`. Pull requests and `main`
  are checked; tags are covered by `release.yml`'s own checks.

## R8. Documentation

- The help overlay is generated from `COMMANDS()`, so it follows automatically.
- `README.md` command table rows: remove `/chat <id>` and `/attach <id>, /detach <id>`; add
  `/new`; change `/lorebooks` and `/library, /show`.
- `specs/006-usability/contracts/commands.md`, the active table "Commands (suggested and listed by
  `/help`)":
  - the `/chat <id>`, `/attach <id>` and `/detach <id>` rows are **removed**;
  - the `/lorebooks` and `/show` rows are rewritten to the 011 meaning, ending "(changed by 011)";
  - a `/new` row is added, ending "(added by 011)";
  - under the table, next to the existing notes, add the line
    `` `/chat`, `/attach`, `/detach`: removed by 011 (use `/characters` and `/lorebooks`). ``
- The only id suggestion inside `app.ts` today is "No lorebooks. Attach one with /attach <id>.";
  it disappears with the old `/lorebooks` listing.
