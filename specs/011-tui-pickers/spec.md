# Feature Specification: Pickers Instead of Ids

**Feature Branch**: `011-tui-pickers` (from `main`, merged through a pull request; constitution
3.2.0)

**Created**: 2026-10-20

**Status**: Draft

**Input**: Owner feedback after installing 0.1.0 from npm on macOS:

1. `/show` cannot inspect anything without an id. It should be a picker with search.
2. Overlays have no border, so the screen looks odd when one opens.
3. A `/new` command should start a new chat; users do not understand chat ids. In the app, every
   operation that takes an id should become a picker, with search.
4. Why are there both `/lorebooks` and `/attach`? `/lorebooks` should be the one place to choose
   and import lorebooks.

## Context

Several in-app commands still expect the user to type an internal id (`/show <id>`,
`/chat <id>`, `/attach <id>`, `/detach <id>`). Ids are meaningful to the program, not to a person.
The app already has pickers with a search filter (for example `/characters`, `/sessions` and
`/persona`), so this feature moves the remaining id commands onto pickers, adds `/new`, and gives
every overlay a visible border.

The command-line subcommands (`littletavern show <id>` and the others) keep their ids: a shell user
names things explicitly, often from scripts.

## Clarifications

### Session 2026-10-20

- Q: What should `/show` do? → A: It opens a picker of all library items (characters and
  lorebooks) with search. Choosing one shows its details. The in-app command takes no argument.
  `littletavern show <id>` is unchanged.
- Q: What happens to `/chat <id>`? → A: It is removed from the app; `/characters` already starts
  a chat from a picker.
- Q: What does `/new` do? → A: It starts a new chat with the current character: a new session that
  opens with the character's greeting again. The previous chat stays saved and can be resumed from
  `/sessions`. In innkeeper mode it clears the innkeeper conversation. With neither a character
  chat nor innkeeper mode, it says to choose a character with `/characters` or use `/innkeeper`.
- Q: What happens to `/attach` and `/detach`? → A: Both are removed. `/lorebooks` becomes a picker
  for the current character, in the style of `/characters` (whose first entry is "New
  character"):
  - the first entry imports a lorebook: it opens the import file browser, limited to the import
    folders exactly as `/import` is, and attaches the imported lorebook to the current character;
  - the other entries are the library's lorebooks, each marked as attached or not;
  - Enter toggles the chosen lorebook between attached and detached;
  - a lorebook embedded in the character card is listed, marked as part of the card, and cannot
    be detached;
  - it still requires a character chat.
- Q: What does `/library` show? → A: Unchanged: everything that has been imported.
- Q: Which overlays get a border? → A: Every overlay the app opens (pickers, help, trace, the file
  browser, the key and model panels, confirmations), with the overlay's title in or on the border.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Inspect an item without knowing its id (Priority: P1)

A user wants to look at what a character or lorebook contains. They type `/show`, search by name,
and choose the item. Its details appear.

**Why this priority**: today `/show` without an id only prints a usage error, so the command is
unusable for someone who does not know ids.

**Independent Test**: with a library holding a character and a lorebook, `/show`, type part of a
name, press Enter: the same details that `littletavern show <id>` prints are shown.

**Acceptance Scenarios**:

1. **Given** a library with items, **When** the user enters `/show`, **Then** a picker lists every
   library item with its name and kind, and typing filters the list.
2. **Given** the picker is open, **When** the user chooses an item, **Then** the picker closes and
   the item's details are shown.
3. **Given** the picker is open, **When** the user presses Esc, **Then** it closes and nothing else
   happens.
4. **Given** an empty library, **When** the user enters `/show`, **Then** the app shows the
   empty-library hint instead of an empty picker.
5. **Given** any text after `/show`, **When** the user submits it, **Then** the app does not look
   anything up by id; it explains that `/show` opens a picker (and that
   `littletavern show <id>` exists in the shell).

---

### User Story 2 - Choose lorebooks for a character in one place (Priority: P1)

During a chat with Alice, the user opens `/lorebooks`, sees which lorebooks are attached, turns
one on or off, or imports a new one that is attached at once.

**Why this priority**: attaching or detaching currently needs ids, and the user has two commands
for one job.

**Independent Test**: in a chat with a character that has one attached and one unattached library
lorebook plus an embedded card lorebook, `/lorebooks` shows all three with their state; toggling
the unattached one attaches it, and the next `/lorebooks` shows it attached.

**Acceptance Scenarios**:

1. **Given** a character chat, **When** the user enters `/lorebooks`, **Then** a picker opens.
   Its first entry imports a lorebook; it then lists the card's embedded lorebook (if any), marked
   as part of the card, and every library lorebook, marked attached or not attached.
2. **Given** the picker, **When** the user chooses an unattached library lorebook, **Then** it is
   attached to the current character, and the app confirms it by name.
3. **Given** the picker, **When** the user chooses an attached library lorebook, **Then** it is
   detached, and the app confirms it by name.
4. **Given** the picker, **When** the user chooses the card's embedded lorebook, **Then** nothing
   changes and the app says that it is part of the character card.
5. **Given** the picker, **When** the user chooses the import entry and picks a lorebook file in
   the import folders, **Then** the lorebook is imported and attached to the current character,
   and the app says both.
6. **Given** the import browser opened from `/lorebooks`, **When** the user picks a file that is
   not a lorebook (for example a character card), **Then** the import result is reported as with
   `/import`, and nothing is attached.
7. **Given** no character chat, **When** the user enters `/lorebooks`, **Then** the app says to
   start a character chat first, as today.
8. **Given** a change made in the picker, **When** the user sends the next message, **Then** the
   request uses the new set of lorebooks.

---

### User Story 3 - Start a new chat without ids (Priority: P1)

The user has been chatting with Alice and wants to start over. They type `/new` and get a fresh
chat that opens with Alice's greeting; the old chat is still available in `/sessions`.

**Why this priority**: today starting over means going through `/characters` again, and the
command list still offers `/chat <id>`.

**Independent Test**: in a chat with one exchange, `/new`: the transcript shows only the greeting,
the next message is sent without the old exchange, and `/sessions` lists both chats.

**Acceptance Scenarios**:

1. **Given** a character chat, **When** the user enters `/new`, **Then** a new chat with the same
   character starts and shows its greeting; the previous chat is kept and appears in `/sessions`.
2. **Given** innkeeper mode, **When** the user enters `/new`, **Then** the innkeeper conversation
   is cleared and the user stays in innkeeper mode.
3. **Given** neither a character chat nor innkeeper mode, **When** the user enters `/new`, **Then**
   the app says to choose a character with `/characters` or use `/innkeeper`.
4. **Given** a reply is still streaming, **When** the user enters `/new`, **Then** nothing changes
   and the app says to wait for the reply or press Esc to stop it.
5. **Given** any version of the app after this feature, **When** the user types `/chat`, **Then**
   it is an unknown command, and nothing in the app suggests `/chat <id>`.

---

### User Story 4 - Overlays look like panels (Priority: P2)

When a picker, help, the trace or the file browser opens, it appears as a framed panel with a
title, clearly separate from the chat behind it.

**Why this priority**: it is visual polish; behaviour does not depend on it.

**Independent Test**: open each overlay in turn and confirm a visible border and title. This is
checked manually by the owner.

**Acceptance Scenarios**:

1. **Given** any overlay, **When** it opens, **Then** it has a visible border on all sides and its
   title is shown.
2. **Given** a narrow terminal (about 60 columns), **When** an overlay opens, **Then** the border
   and contents still fit without broken lines.
3. **Given** `NO_COLOR` is set, **When** an overlay opens, **Then** the border is still visible
   (it does not rely on colour alone).

---

### User Story 5 - Help and docs match the commands (Priority: P3)

The help overlay, the README's command table and the command contract list `/show`, `/lorebooks`
and `/new` as pickers or actions without ids, and no longer list `/chat`, `/attach` or `/detach`.

**Why this priority**: documentation follows behaviour.

**Independent Test**: search the app's messages, help, README and contract for `/chat <`,
`/attach`, `/detach` and `/show <`; only the shell subcommand `littletavern show <id>` remains.

**Acceptance Scenarios**:

1. **Given** the help overlay, **When** the user reads it, **Then** it lists `/new`, `/show` and
   `/lorebooks` with their new meaning, and does not list `/chat`, `/attach` or `/detach`.
2. **Given** the README, **When** a user reads the command table, **Then** it matches the help.

---

### Edge Cases

- `/attach`, `/detach` or `/chat` typed by a user who remembers them: unknown command, with the
  normal "Use /help" message.
- `/lorebooks` when the library has no lorebooks: the picker still opens with the import entry
  (and the card's embedded lorebook, if any).
- A lorebook attached to the character but since deleted from the library: listed as attached
  and missing, so the user can detach it; choosing it detaches it.
- Importing from `/lorebooks` a lorebook that is already in the library (`already imported`): it
  is attached, not duplicated.
- Importing from `/lorebooks` a file that fails to import (damaged, too large, outside the import
  folders): the failure is reported as with `/import`; nothing is attached.
- `/new` when the current character has been deleted from the library since the chat started:
  the app says the character is no longer in the library and suggests `/characters`.
- `/new` in a resumed chat: the new chat uses the resumed chat's character.
- `/show` for an item whose stored files are damaged: the same error the shell `show` reports.
- Long names in pickers and panel titles: truncated to fit, never wrapped through the border.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `/show` MUST open a searchable picker of all library items; choosing one MUST show
  the same details as `littletavern show <id>`. The in-app `/show` MUST NOT accept or look up an
  id; text after it MUST produce a short explanation instead.
- **FR-002**: `/chat`, `/attach` and `/detach` MUST be removed from the app's commands,
  completion and help.
- **FR-003**: `/lorebooks` MUST open a picker for the current character whose first entry imports
  a lorebook and whose other entries are the card's embedded lorebook (if any) and every library
  lorebook, each showing its state (part of the card, attached, not attached, attached but
  missing).
- **FR-004**: Choosing a library lorebook in `/lorebooks` MUST toggle it between attached and
  detached for the current character and confirm the change by name; choosing the card's
  embedded lorebook MUST change nothing and say why.
- **FR-005**: The import entry of `/lorebooks` MUST use the same file browser and the same import
  rules as `/import` (limited to the import folders, regular files only, size limit), and MUST
  attach the result to the current character only when it is a lorebook that imported or was
  already imported.
- **FR-006**: Attachment changes made through `/lorebooks` MUST be saved like the existing
  attachments and MUST apply to the next request.
- **FR-007**: `/new` MUST start a new chat with the current character, showing its greeting; the
  previous chat MUST remain saved and resumable from `/sessions`. In innkeeper mode it MUST clear
  the innkeeper conversation. Otherwise it MUST point to `/characters` and `/innkeeper`.
- **FR-008**: Every overlay MUST be drawn with a visible border and its title, MUST fit the
  terminal width, and MUST stay visible without colour (`NO_COLOR`).
- **FR-009**: No message, hint, help text, README section or command contract MAY suggest typing
  an id inside the app. The shell subcommands keep their ids.
- **FR-010**: The command-line subcommands (`import`, `list`, `show`, `create`, `dry-run`) MUST
  behave exactly as before.

### Key Entities

- **Library item**: a character or lorebook in the library, with a name, a kind and an id that the
  user no longer has to type.
- **Lorebook attachment**: the per-character list of attached library lorebooks, already stored in
  settings; this feature changes how it is edited, not how it is stored.
- **Chat session**: a saved conversation with a character; `/new` creates one, `/sessions` lists
  them.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Every in-app task that used an id (inspect an item, start a chat, attach or detach a
  lorebook) can be done without typing an id.
- **SC-002**: A user can attach a newly downloaded lorebook to the current character in one
  command and at most three choices (the import entry, the file, confirmation if any).
- **SC-003**: `/new` gives a fresh chat in one command, and the previous chat is still listed in
  `/sessions` in 100% of cases.
- **SC-004**: All overlays show a border and title, checked by the owner in a 60-column and a
  normal-width terminal, with and without `NO_COLOR`.
- **SC-005**: A search of the app's messages, help, README and contracts finds no suggestion of an
  in-app id command.

## Acceptance Testing

- Unit and app-harness tests: the `/show` picker, the `/lorebooks` picker (states, toggle, the
  embedded book, a missing attached book, import and attach, a non-lorebook import), `/new` (new
  session, previous kept, innkeeper, no chat), and removed commands being unknown.
- Happy path with the simulated provider: chat with a character, attach a lorebook through
  `/lorebooks`, send a message whose keyword fires that lorebook, `/new`, and check that the next
  request has no earlier history.
- Owner, manually: the look of the bordered overlays at two widths and with `NO_COLOR`.

## Assumptions

- The existing pickers' search behaviour is reused; no new search mechanism is needed.
- Opening `/lorebooks` and toggling does not close the chat or change the session; the picker can
  stay open for several toggles or close after each one, whichever the existing picker supports
  more simply. This is a presentation detail left to the plan.
- Ids may still be shown as secondary text in pickers and details; the requirement is only that
  users never need to type them.
- The 0.1.1 release after this feature is an owner action and the first real use of staged npm
  publishing; it is not part of this feature's tasks.
- Out of scope: error handling and retries, `/prev`, the default user name, token and spend limits
  (012); the innkeeper assistant (013); keywords for non-English chat.
