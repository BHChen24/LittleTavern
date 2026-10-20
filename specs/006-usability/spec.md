# Feature Specification: Usability Pass

**Feature Branch**: `006-usability` (stacked on `005-lore-inspector`)

**Created**: 2026-10-20

**Status**: Draft

**Input**: Owner feedback after trying v1: "Not pleasant to use.

1. `/` commands need autocompletion; they cannot depend on `/help` alone.
2. `/import` with no argument should open a default location and let the user choose a file.
   The default location is `~/.littletavern/`, with a folder for lorebooks and one for
   characters.
3. Interface polish: add a home screen that says to press Enter to enter the app. Do not show a
   dedicated API-key screen; intercept a message sent without a key and point to `/apikey`.
   `/apikey` offers OpenRouter as its only option."

## Context

v1 works, but it is only discoverable through `/help`, and importing requires typing full file
paths. This feature makes the existing functions easy to find and use. It does not add new
capabilities.

- Creating characters is a separate feature, 007.
- Release preparation follows as 008.

## Clarifications

### Session 2026-10-20

- Q: Where does `/import` with no argument open? → A: In `~/.littletavern/`, which holds two
  folders where the owner drops files to import: `characters/` and `lorebooks/`. The owner
  suggested "worldlore". `lorebooks` was chosen to match the app's existing terms (`/lorebooks`,
  `/attach`) and the wider ecosystem.
- Q: How should the API key be entered? → A: No dedicated key screen at startup. Sending a
  message without a key is blocked with a hint to use `/apikey`. `/apikey` lists OpenRouter as
  its only provider. Keeping the key for this session only is the default, and saving to disk is
  an explicit choice, per the owner's preference to avoid long-term storage.
- Q: Which interface polish belongs here? → A: The main tasks are the home screen and the key
  flow above. The earlier polish notes are included as lower priority (User Story 5).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Commands suggest themselves (Priority: P1)

As soon as the owner types `/` in the input, a list of matching commands appears, each with a
one-line description. The list narrows as they type, and a command can be completed without
typing it in full. For commands that take an argument, suggestions continue after the space: for
example, character names after `/chat `, lorebooks after `/attach `, and file paths after
`/import `.

**Why this priority**: The owner's first complaint. Without it, every feature is hidden behind
`/help`.

**Independent Test**: Type `/` and check that all commands are listed with descriptions. Type
`/cha`, accept the suggestion, then press space and check that the imported characters are
suggested.

**Acceptance Scenarios**:

1. **Given** an empty input, **When** the owner types `/`, **Then** every available command is
   suggested with a short description.
2. **Given** `/im`, **When** suggestions are shown, **Then** `/import` is among them and can be
   accepted with Tab or Enter without typing the rest.
3. **Given** `/chat ` or `/show `, **When** suggestions are shown, **Then** they list the matching
   library items by name, and accepting one inserts its id.
4. **Given** `/attach ` or `/detach `, **When** suggestions are shown, **Then** only lorebooks are
   listed: all of them for `/attach`, and only the currently attached ones for `/detach`.
5. **Given** `/import ` followed by part of a path, **When** suggestions are shown, **Then** they
   complete file and folder names.
6. **Given** ordinary chat text that does not start with `/`, **When** typed, **Then** no command
   suggestions appear.
7. **Given** suggestions are open, **When** the owner presses Esc, **Then** the suggestions close
   and the typed text stays.

---

### User Story 2 - Import by choosing a file (Priority: P1)

The owner drops downloaded cards into `~/.littletavern/characters/` and lorebooks into
`~/.littletavern/lorebooks/`. They type `/import` with nothing after it. A file browser opens at
`~/.littletavern/` showing the two folders. They open a folder, pick a file, and see the same
import report as before.

**Why this priority**: The owner's second complaint. Typing absolute paths in a terminal is the
biggest obstacle to importing.

**Independent Test**: Put a sample card in `~/.littletavern/characters/`, then run `/import`,
open `characters`, select the card and check that the import report appears and the card is in
the library.

**Acceptance Scenarios**:

1. **Given** the app starts and `~/.littletavern/characters/` or `~/.littletavern/lorebooks/`
   does not exist, **When** it starts, **Then** the missing folders are created (and nothing else
   in them is touched).
2. **Given** `/import` with no argument, **When** run, **Then** a file browser opens at
   `~/.littletavern/`, listing `characters/` and `lorebooks/`.
3. **Given** the browser, **When** the owner enters a folder, **Then** it lists the sub-folders
   and the files that can be imported (`.json` and `.png`), with folders first. A "go up" entry
   returns to the parent folder.
4. **Given** the browser, **When** the owner types, **Then** the list narrows to matching names.
5. **Given** a file is selected, **When** confirmed, **Then** it is imported and the usual report
   (imported, already imported, or the rejection reason) is shown. The file stays where it was.
6. **Given** an empty folder, **When** opened, **Then** the browser says so and shows the folder's
   full path, so the owner knows where to put files.
7. **Given** the browser is open, **When** the owner presses Esc, **Then** it closes and nothing
   is imported.
8. **Given** `/import <path>`, **When** run, **Then** it works exactly as before.

---

### User Story 3 - A home screen to start from (Priority: P1)

Launching LittleTavern shows a home screen: the product name and version, a short line about what
it is, the next steps (press Enter to start; type `/` for commands), and whether an API key is
set. Pressing Enter opens the chat view.

**Why this priority**: The owner asked for it explicitly. It gives the app a clear starting point
instead of an empty transcript.

**Independent Test**: Launch the app and check the home screen content. Press Enter and check
that the chat view with the input appears.

**Acceptance Scenarios**:

1. **Given** the app is launched, **When** it opens, **Then** the home screen shows "LittleTavern"
   with the version, a one-line description, "Press Enter to start", a hint to type `/` for
   commands, and the key status ("No API key yet — use /apikey" or "API key: <source>").
2. **Given** the home screen, **When** the owner presses Enter, **Then** the chat view opens with
   the input focused.
3. **Given** the home screen, **When** the owner presses Ctrl+C, **Then** the app quits cleanly.
4. **Given** the home screen, **When** the library is empty, **Then** it also shows where to put
   files to import (`~/.littletavern/characters/`, `~/.littletavern/lorebooks/`).

---

### User Story 4 - Enter the API key only when needed, with `/apikey` (Priority: P1)

The app no longer asks for a key at startup. Everything that needs no key works without one:
browsing, importing, dry runs, `/trace` and settings. When the owner sends a message without a
key, the message is not sent, and a notice explains how to add a key with `/apikey`. `/apikey`
shows the providers, which is just OpenRouter for now. After choosing it, the owner enters the
key, masked. By default the key is kept for this session only; saving it to disk is an explicit
option, which shows where the key would be stored.

**Why this priority**: The owner asked for it explicitly. A key screen at startup is a wall
before the user has seen anything.

**Independent Test**: With no key configured, launch the app, enter the chat and send a message.
The message is blocked with the `/apikey` hint. Run `/apikey`, pick OpenRouter, paste a key and
keep the default (session only). Send again and check that it works, then restart and check that
the key is gone.

**Acceptance Scenarios**:

1. **Given** no key from the environment or a saved file, **When** the app starts, **Then** no key
   prompt appears.
2. **Given** no key, **When** the owner sends a chat message or regenerates, **Then** nothing is
   sent and a notice reads, in substance: "No API key yet. Type /apikey to add your OpenRouter
   key." The typed message is kept in the input so it is not lost.
3. **Given** `/apikey`, **When** run, **Then** a list of providers appears containing only
   "OpenRouter". Choosing it opens a masked key input.
4. **Given** a key is entered, **When** confirmed, **Then** the owner chooses between "Use for
   this session only" (selected by default) and "Save to <full path> (readable only by you)".
5. **Given** "this session only", **When** the app exits, **Then** nothing about the key was
   written to disk.
6. **Given** a key is already active, **When** `/apikey` is run, **Then** OpenRouter shows where
   the active key comes from (environment, saved or session), and offers "Replace" and, when a
   saved key exists, "Forget saved key".
7. **Given** a key is rejected by OpenRouter, **When** the error is shown, **Then** it points to
   `/apikey` instead of opening a prompt by itself.
8. **Given** the old commands `/key` and `/forget-key`, **When** typed, **Then** they say they are
   replaced by `/apikey`. They are no longer listed in help or suggestions.

---

### User Story 5 - Earlier polish notes (Priority: P3)

The owner's earlier notes on the chat view are addressed:

- the status bar sits on the last line;
- no large empty gap between the transcript and the input;
- user messages, character messages and notices are visually distinguishable;
- a separator line is not drawn twice.

**Why this priority**: Noted on 2026-10-19 as "works but is rough", to be fixed after v1. These
are lower priority than the owner's explicit requests above.

**Independent Test**: The owner looks at a chat with a few messages and a notice.

**Acceptance Scenarios**:

1. **Given** the chat view, **When** shown, **Then** the status bar is the last line of the
   screen.
2. **Given** a chat, **When** shown, **Then** user messages, character messages and app notices
   use visibly different styles, for example a label or colour. Meaning MUST NOT depend on colour
   alone.
3. **Given** the chat view, **When** shown, **Then** there is no doubled separator line and no
   blank region larger than the content needs.

---

### Edge Cases

- `~/.littletavern/` exists but is a file, or cannot be written: the app starts anyway, and
  `/import` explains the problem and still accepts `/import <path>`.
- `LITTLETAVERN_HOME` is set (tests, experiments): the import folders live inside it rather than
  in `~/.littletavern/`, so tests never touch the real home folder.
- A folder with hundreds of files: the browser lists them and filtering by typing works.
- Files with non-Latin names, and folders that are symlinks: they are shown and opened normally.
- The environment key is present and the owner runs `/apikey` → "Replace": the new key is used for
  this run. The environment variable still wins on the next launch, and the owner is told so.
- Typing `/` in the middle of a message (not at the start): no command suggestions.

## Requirements *(mandatory)*

### Functional Requirements

**Command suggestions**

- **FR-001**: Typing `/` at the start of the input MUST show the available commands with
  one-line descriptions, narrowing as the owner types. Suggestions MUST be acceptable with
  Tab or Enter.
- **FR-002**: Argument suggestions MUST be offered for:
  - `/chat`: characters;
  - `/show`: any item;
  - `/attach`: lorebooks;
  - `/detach`: attached lorebooks;
  - `/import`: file paths.

  The library-based suggestions show names and insert ids.
- **FR-003**: The command list for suggestions and for `/help` MUST come from one definition, so
  they cannot disagree.

**Import folders and browser**

- **FR-004**: The app MUST ensure that `~/.littletavern/characters/` and
  `~/.littletavern/lorebooks/` exist, or `<LITTLETAVERN_HOME>/import/…` when `LITTLETAVERN_HOME`
  is set. It MUST NOT modify existing files in them.
- **FR-005**: `/import` without an argument MUST open a file browser at the import root, which
  lists sub-folders first and then `.json` and `.png` files, can be filtered by typing, has a "go
  up" entry, and closes with Esc.
- **FR-006**: Selecting a file MUST import it exactly like `/import <path>` and show the same
  report. Imported files are left in place.

**Home screen**

- **FR-007**: The app MUST open on a home screen showing the name and version, a one-line
  description, "Press Enter to start", the `/` hint and the key status. When the library is
  empty, it also shows the import folders' locations.
- **FR-008**: Enter on the home screen MUST open the chat view. Ctrl+C MUST quit.

**API key**

- **FR-009**: The app MUST NOT prompt for a key at startup or when a request fails. Key entry
  happens only through `/apikey`.
- **FR-010**: Sending a message or regenerating without a key MUST be blocked with a notice that
  names `/apikey`. The typed text MUST stay in the input.
- **FR-011**: `/apikey` MUST list the supported providers, which is only OpenRouter. Choosing it
  MUST show the active key's source if there is one, and offer "Replace", plus "Forget saved key"
  when a saved key exists. Entering a key uses masked input.
- **FR-012**: After a key is entered, "Use for this session only" MUST be the default choice.
  "Save to <full path> (readable only by you)" MUST be an explicit alternative. Nothing is written
  unless "Save" is chosen.
- **FR-013**: `/key` and `/forget-key` MUST respond that they are replaced by `/apikey`. They MUST
  NOT appear in suggestions or help.
- **FR-014**: The existing key rules still apply:
  - environment first;
  - blank counts as absent;
  - masking;
  - owner-only file permissions;
  - the key never appears in logs, the ledger or session files.

**Polish (P3)**

- **FR-015**: The status bar MUST be the last line of the chat view. User messages, character
  messages and notices MUST be distinguishable without relying on colour alone. There MUST be no
  doubled separators or oversized blank regions.

### Key Entities

- **Command definition**: name, one-line description, optional argument suggestions. It is the
  single source for suggestions and `/help`.
- **Import root**: `~/.littletavern/` with `characters/` and `lorebooks/`, or the equivalent under
  `LITTLETAVERN_HOME`.
- **Provider**: an entry in the `/apikey` list. For now only OpenRouter.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A first-time user can discover every command without opening `/help`. Typing `/`
  lists 100% of them.
- **SC-002**: Importing a file placed in an import folder takes at most 4 key presses after
  typing `/import`: open the folder, select the file, confirm.
- **SC-003**: Without any key configured, the owner can import, browse, dry-run and inspect,
  and is never shown a key prompt they did not ask for.
- **SC-004**: With the default `/apikey` choice, no key material exists on disk after the app
  exits. This is checked by the existing leak scan.
- **SC-005**: The 19 automated v1 acceptance checks still pass, and the guided acceptance
  checklist is updated to the new flows.

## Acceptance Testing

Per the constitution's testing policy:

- **Automated**:
  - the command definitions feed both help and suggestions;
  - the argument suggestion sources (characters, lorebooks, attached lorebooks);
  - the import root creation (with `LITTLETAVERN_HOME`);
  - the file browser's listing, filtering, going up and selecting (component level);
  - the key interception;
  - the `/apikey` flow with "session only" as the default writes nothing;
  - the `/key` and `/forget-key` replacement notices;
  - the home screen content, and that Enter switches to the chat view.
- **Manual (owner)**: the feel of suggestions and the browser, the home screen and the polish
  items, through the updated guided acceptance script.
- **Deferred**: any test judged too complex during planning is listed in the plan.

## Assumptions

- The import folders are drop boxes only. The library storage location does not change.
- Moving or deleting files after import is out of scope; files stay where the owner put them.
- Provider choice in `/apikey` is a list so that more providers can be added later. Only
  OpenRouter is supported now (unchanged from 001).
- Creating characters is feature 007 and is not part of this feature.
