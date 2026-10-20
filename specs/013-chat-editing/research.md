# Research: Chat Editing

Facts were read from the code at `main` 15a64b5 and from `../pi` at tag `v1.3.0`. Paths under
`session-manager.ts` mean `../pi/packages/coding-agent/src/core/session-manager.ts`; paths under
`editor.ts` and `tui.ts` mean `../pi/packages/tui/src/components/editor.ts` and
`../pi/packages/tui/src/tui.ts`.

## R1. How the current point of a chat is stored

- **Facts**:
  - `branch(id)` only moves the in-memory leaf pointer and writes nothing
    (`session-manager.ts:1579–1584`). `resetLeaf()` sets it to null, so the next entry becomes a
    new root (`session-manager.ts:1591–1593`).
  - Every append (`appendMessage`, `appendCustomEntry`) adds the entry as a child of the leaf,
    makes it the new leaf and writes it to the file (`session-manager.ts:1191–1196`, `:1204–1215`,
    `:1290–1300`).
  - When a file is loaded, the leaf becomes the last entry in the file (`session-manager.ts:1103–1112`,
    `_buildIndex`).
  - The file is first written once it contains a user or assistant message; after that every
    entry is appended (`session-manager.ts:1166–1190`).
  - `CharacterChat` writes only two kinds of entries: custom entries (`littletavern.character`
    and `littletavern.greeting`, `character-chat.ts:203`, `:206`) and messages
    (`character-chat.ts:246`, `:287`, `:366`). The character entry is the root.
  - `history()` follows `getBranch()` from the leaf (`character-chat.ts:240`).
  - `regenerateTarget()`, `regenerate()` and `prev()` all read the leaf directly and expect it to
    be the last visible message (`character-chat.ts:254–273`, `:276–290`, `:293–299`).
- **Consequence**: whatever undo and edit do, the last entry in the file must be the last item
  the chat shows. Otherwise a restart shows something else (spec FR-009), and regenerate and
  `/prev` act on the wrong entry.

## R2. Undo: branch, then append a copy of the entry before the undone message

- **Decision**: `CharacterChat.undo()`:
  1. Find the last user message on the current branch (`getBranch()`, scanning backwards). If
     there is none, return `"nothing-to-undo"`.
  2. Let `before` be the entry just before it on the branch (its parent). It is the previous
     reply, an earlier user message without a reply, the greeting, or the character entry.
  3. Move the leaf to `before`'s parent with `branch()`, or `resetLeaf()` when `before` is the
     root.
  4. Append a copy of `before`: `appendMessage(before.message)` for a message, or
     `appendCustomEntry(before.customType, before.data)` for a custom entry.
  5. Clear `replaced` and return the undone user message's text.
- **Rationale**: it is the same move as `/prev` (012 research R6): branch, then append a copy so
  the current point is the last entry in the file. The leaf stays a visible item, so
  `regenerateTarget()`, `regenerate()` and `prev()` need no change. For example, after undoing
  turn 2, the leaf is a copy of reply 1, and Ctrl+R regenerates reply 1, as it would have before
  turn 2 was sent.
- **Alternatives considered**:
  - *A marker entry* (`appendCustomEntry("littletavern.undo")` right after `branch()`): it
    persists, but the leaf becomes an invisible entry. `regenerateTarget()`, `regenerate()` and
    `prev()` would all need to skip it. Rejected: more changes, with a regression risk in three
    places.
  - *pi's context edits* (`appendContextEdit(targetId, null)`, `session-manager.ts:1360–1398`,
    projected in `buildSessionProjection`, `session-manager.ts:543–575`): they hide a message
    without branching. But `historyFromEntries` reads `getBranch()` and ignores `context_edit`
    entries (`character-chat.ts:104–131`), so it would need a new projection step. They also do
    not express "restart from here". Rejected for this feature.
- **Note**: the copy duplicates an entry in the file. This is the same trade-off as `/prev`. The
  `/sessions` message count already counts every branch (spec, out of scope).

## R3. Edit: branch before the edited message, then append the new version

- **Decision**:
  - `ChatHistoryItem` gains `entryId?: string`, set for message entries. The greeting has none,
    so the `/edit` picker cannot list it (spec FR-003).
  - `CharacterChat.resendFrom(entryId, text)`: the entry must be a user message on the current
    branch; otherwise it throws. It calls `branch(entry.parentId)`, then `send(text)`, which
    clears `replaced`, appends the user message and generates (`character-chat.ts:243–248`).
  - `CharacterChat.editReply(entryId, text)`: the entry must be an assistant message on the
    current branch; otherwise it throws. It calls `branch(entry.parentId)`, then appends
    `{ ...entry.message, content: [{ type: "text", text }], stopReason: "stop" }`, and clears
    `replaced`. `stopReason: "stop"` removes the interrupted mark (`historyFromEntries` marks
    `"aborted"`, `character-chat.ts:121–125`; spec edge case).
  - Both put the new version last in the file, so R1's rule holds without a copy.
- **Alternative considered**: context edits (R2). Rejected: the owner chose "restart from here",
  which is a branch.
- **Fact**: the edited message's parent is never null, because the character entry is the root
  (R1).

## R4. Where the edited text is typed

- **Facts**:
  - The pi editor clears itself before calling `onSubmit`, and passes the trimmed text
    (`editor.ts:1364–1377`).
  - `submit()` returns early on empty text (`app.ts:887–888`), and parses `/` commands before
    sending (`app.ts:1125–1140`).
  - `editor.setText()` cancels the autocomplete menu (`editor.ts:1115–1116`). Typing `/` at the
    start of a line opens it again (`editor.ts:1229–1233`).
  - The editor supports multi-line text (`tui.input.newLine`, `editor.ts:890–905`), so long
    replies can be edited in it.
  - App input listeners run before the focused component and can consume a key
    (`tui.ts:1063–1077`). The app's listener handles Ctrl+C, Ctrl+O, Ctrl+R and Esc
    (`app.ts:1152–1180`).
  - `InputBox` renders the editor and, when it is empty, a placeholder
    (`components/input-box.ts`).
- **Decision**:
  - The app keeps `editing: { entryId, role, text } | null`.
  - `submit()` checks `editing` first, before the empty-text return and the command parsing. An
    empty value shows the contract message and keeps editing; anything else is the new text,
    even if it starts with `/` (spec edge case).
  - The input listener, while `editing` is set and the editor is focused:
    - Esc cancels the edit (contract), unless the editor's autocomplete menu is showing
      (`editor.isShowingAutocomplete()`, `editor.ts:2465`). In that case the Esc goes to the
      editor and closes the menu.
    - Ctrl+R is consumed with the contract message.
    - Ctrl+O (compose in `$EDITOR`, `app.ts:834–857`) and Ctrl+C keep working. Ctrl+O only
      changes the input's text, and Ctrl+C quits, which discards the edit (spec edge case).
  - `InputBox` gets an optional banner callback. While editing, it renders one muted line above
    the editor with the contract text. This makes the editing state visible (spec FR-004).

## R5. The commands in the app

- **Facts**:
  - Handlers live in the `handlers` map inside `submit()` (`/prev` at `app.ts:1105–1110`). `/prev` is
    the model: no chat → message; otherwise call the engine and `renderHistory(chat.history())`.
  - While streaming, `submit()` returns early and the input listener shows the wait message for
    `/new` and `/prev` (`app.ts:889–893`, `:1153–1161`).
  - `regenerate()` shows the model for re-rendering before a stream: render the history without
    what is being replaced, then `stream(...)` (`app.ts:668–672`).
  - `allowSpend(value)` asks Continue or Stop. Stop restores `value` into the editor
    (`app.ts:775–803`).
  - The transcript labels the player "You" and the character by name (`app.ts:406–407`).
- **Decision**:
  - `/undo` and `/edit` join `/new` and `/prev` in both wait-message lists.
  - `/undo`: no chat → contract message. `"nothing-to-undo"` → contract message. Otherwise
    `renderHistory(chat.history())` and `editor.setText(text)`.
  - `/edit`: no chat → contract message. No item with an `entryId` → contract message. Otherwise
    open a `ListPicker` of those items, newest first. The label is "You" or the character's name,
    the description is the first line of the text (clipped by the picker), and the search is the
    full text. Selecting sets `editing`, closes the picker and calls `editor.setText(text)`.
  - Saving a user message: first `interceptIncompleteSetup(value)` (`app.ts:377–383`), as a send
    does. For example, the key may have been cleared by a rejected-key failure. When it
    intercepts, `editing` stays and the text is back in the input. The player presses Esc,
    fixes the setup and edits again. Then `allowSpend(value)`. On Stop, `editing` stays and the
    text is back in the input. On go, clear `editing` and `retries`, render the history up to the edited
    message, add the edited message to the transcript, then
    `stream(() => chat.resendFrom(entryId, value))`.
  - Saving a character message: if the text equals the original (trimmed), clear `editing` and
    show the contract message. Otherwise `chat.editReply(entryId, value)` and render the history.

## R6. Tests

- `character-chat.test.ts` already reopens session files and uses the simulated provider. The
  undo and edit cases reopen the file with `CharacterChat.resume` to check persistence.
- `app-safeguards.test.ts` and `app-pickers.test.ts` drive the app through `submit()` and the
  editor, and read the transcript. The new app tests follow them, in a new file
  `app-editing.test.ts`.
