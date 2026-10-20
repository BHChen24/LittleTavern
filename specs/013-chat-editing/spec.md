# Feature Specification: Chat Editing

**Feature Branch**: `013-chat-editing` (from `main` at 15a64b5, merged through a pull request;
constitution 3.2.0)

**Created**: 2026-10-20

**Status**: Draft

**Input**: The owner's acceptance of 0.1.1 on 2026-10-20: a chat cannot be corrected. The only
correction today is `/regenerate`, which replaces the character's last reply. A typo in the
player's own message, or a reply the player wants to fix by hand, can only be dealt with by
starting over with `/new`. The owner called this a basic feature.

## Context

A character chat is saved as a session file. Every message is kept there, and the file already
records branches: when `/regenerate` replaces a reply, the old reply stays in the file next to
the new one, and the app shows only the current branch. `/prev` (012) swaps the last reply with
the one the latest regenerate replaced.

There is no way to take back a message or to change the text of an earlier one. The innkeeper,
which is redesigned in 014, is not a saved character chat.

## Clarifications

### Session 2026-10-20

- Q: What does `/undo` take back? → A: The last turn: the player's last message and the
  character's reply to it. The player's text goes back into the input, so they can change it and
  send it again. If the player's last message has no reply (the request failed), only that
  message is taken back, and its text goes back into the input. The greeting cannot be undone.
- Q: Which messages can `/edit` change? → A: Any message in the current chat, the player's or the
  character's, except the greeting. The chat restarts from the edited message: every later
  message is dropped from the chat.
- Q: What happens after an edit is saved? → A: An edited player message is sent, and the
  character replies, as with a normal send (including the spend limit check). An edited
  character message is only saved; the player continues from it.
- Q: Where is the text edited? → A: In the input at the bottom of the screen. Choosing a message
  in the `/edit` picker puts its text there. Enter saves; Esc cancels and leaves the chat as it
  was. There is no external editor.
- Q: What happens to the dropped messages? → A: They stay in the saved session file as an earlier
  branch; nothing is deleted. The app does not show them and offers no way back to them. After a
  restart, the chat continues from the undo or the edit.
- Q: Where do the commands work? → A: In character chats only. The innkeeper and the screen
  without a chat get a short message, as `/prev` does. While a reply streams, they get the
  existing wait message.
- Q: How do they interact with `/prev`? → A: After `/undo` or a saved `/edit`, `/prev` has
  nothing to bring back.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Take back the last turn (Priority: P1)

The player sends a message with a typo, or regrets it after reading the reply. They type
`/undo`: their message and the reply disappear, and their text is back in the input. They fix
it and press Enter.

**Why this priority**: it is the most common correction, and today it requires starting the
whole chat again.

**Independent Test**: in a chat with two turns, `/undo` leaves one turn on screen, puts the
second player message back in the input, and the next request contains only the first turn.
After a restart, the chat still shows one turn.

**Acceptance Scenarios**:

1. **Given** a chat whose last message is a character reply, **When** the player enters `/undo`,
   **Then** that reply and the player message before it disappear from the transcript, and the
   player message's text is in the input.
2. **Given** the player's text is back in the input, **When** they press Enter, **Then** it is
   sent as a new message, and the character replies to it.
3. **Given** a chat whose last message is a player message without a reply (a failed request),
   **When** the player enters `/undo`, **Then** only that message disappears, and its text is in
   the input.
4. **Given** a chat that shows only the greeting, **When** the player enters `/undo`, **Then** the
   app says there is nothing to undo, and nothing changes.
5. **Given** an undo, **When** the player quits and resumes the chat from `/sessions`, **Then**
   the chat shows the turns that remained after the undo, and the next request contains only
   those.
6. **Given** an undo, **When** the player enters `/undo` again, **Then** the turn before is taken
   back, and the input holds that turn's player text.

---

### User Story 2 - Edit a message and continue from it (Priority: P1)

The player wants to change something said earlier, their own words or the character's. They type
`/edit`, pick the message in a searchable list, change the text in the input and press Enter.
The chat continues from that message.

**Why this priority**: it covers what `/undo` cannot: fixing a character's reply by hand, and
going back further than one turn.

**Independent Test**: in a chat with three turns, edit the player message of turn 2: turns 2 and
3 are replaced by the edited message and a new reply, and the next request contains turn 1, the
edited message and the new reply. Edit a character reply: it shows the new text, nothing is sent,
and the next request contains the edited text.

**Acceptance Scenarios**:

1. **Given** a character chat with messages after the greeting, **When** the player enters
   `/edit`, **Then** a list of the chat's messages opens, newest first, each showing who said it
   and the start of its text. Typing filters the list. The greeting is not listed.
2. **Given** the list, **When** the player chooses a message, **Then** the list closes, the
   message's full text is in the input, and the screen shows that a message is being edited and
   how to save or cancel.
3. **Given** a player message being edited, **When** the player presses Enter, **Then** every
   message after it disappears, the edited text replaces it, and it is sent; the character
   replies.
4. **Given** a character message being edited, **When** the player presses Enter, **Then** every
   message after it disappears, and the edited text replaces it. Nothing is sent.
5. **Given** a message being edited, **When** the player presses Esc, **Then** the input is
   cleared, the editing state ends, and the chat is unchanged.
6. **Given** a saved edit, **When** the player quits and resumes the chat, **Then** it shows the
   edited message and nothing that came after it before the edit.
7. **Given** a chat that shows only the greeting, **When** the player enters `/edit`, **Then** the
   app says there are no messages to edit, and no list opens.
8. **Given** the run's spend has reached its cap, **When** the player saves an edited player
   message, **Then** the app asks `Continue` or `Stop`, as for a send. `Stop` leaves the chat
   unchanged and keeps the edited text in the input, still being edited.

---

### User Story 3 - Clear limits on where the commands work (Priority: P2)

The commands only make sense in a saved character chat, and never while a reply is arriving.

**Why this priority**: it prevents edits that would race a streaming reply or apply to a
conversation that is not saved.

**Independent Test**: `/undo` and `/edit` in the innkeeper, without a chat, and while a reply
streams each show their message and change nothing.

**Acceptance Scenarios**:

1. **Given** the innkeeper or no chat, **When** the player enters `/undo` or `/edit`, **Then** the
   app says they work in character chats, and nothing changes.
2. **Given** a reply is streaming, **When** the player enters `/undo` or `/edit`, **Then** the
   app shows the existing message to wait for the reply or press Esc, and nothing changes.
3. **Given** a regenerate in this run, **When** the player uses `/undo` or saves an `/edit`,
   **Then** a following `/prev` says there is nothing to bring back.

---

### Edge Cases

- Saving an edited player message whose text is unchanged: it still restarts the chat from that
  message and sends it again. This is a way to continue from an earlier point.
- Saving an edited character message whose text is unchanged: nothing changes.
- Saving an empty edit (only spaces): refused with a short message; the editing state stays.
- While a message is being edited, Enter saves the input as the message's new text, even if it
  starts with `/`. Commands and Ctrl+R are not run; Esc ends the editing first.
- An edited player message whose reply fails: the edited message stays, later messages are gone,
  and the 012 failure notice appears; Ctrl+R retries it, as after a failed send.
- Editing an interrupted reply (stopped with Esc): the saved text is the edited text, and it is no
  longer marked as interrupted.
- Undoing or editing back to the start, then quitting: the chat file remains, and resuming it
  shows the greeting and whatever was kept.
- Quitting while a message is being edited: the edit is discarded, and the chat is unchanged.
- Costs: requests whose turns were undone or dropped were paid for. They still count toward the
  run's spend, the usage ledger and the status bar.
- `/trace` after an undo or a character-message edit still shows the last request that was sent.
- `/regenerate` after an edited character message replaces that message, and `/prev` brings the
  edited text back, as with any regenerate.
- The `/sessions` list counts the messages of every branch in the file. This was already true
  after regenerates; after undo and edit, the count can be higher than what the chat shows. Out
  of scope here.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `/undo` MUST take back the last turn of the current character chat: the last
  player message and the reply to it, or only the last player message when it has no reply. It
  MUST put that player message's text into the input.
- **FR-002**: `/undo` MUST NOT take back the greeting. With nothing to undo, it MUST say so and
  change nothing.
- **FR-003**: `/edit` MUST open a searchable list of the current chat's messages, newest first,
  showing for each who said it and the start of its text. The greeting MUST NOT be listed. With
  no messages, it MUST say so and open nothing.
- **FR-004**: Choosing a message MUST put its full text into the input and enter an editing
  state that the screen makes visible, with how to save (Enter) and cancel (Esc).
- **FR-005**: Saving an edit MUST replace the chosen message with the edited text and drop every
  later message from the chat. An edited player message MUST then be sent, as with a normal
  send, including the spend limit check. An edited character message MUST NOT trigger a request.
- **FR-006**: Cancelling an edit MUST leave the chat unchanged and clear the input.
- **FR-007**: An empty edit MUST be refused with a short message, keeping the editing state.
- **FR-008**: Messages taken back or dropped MUST remain in the saved session file. Nothing is
  deleted from it.
- **FR-009**: After an undo or a saved edit, the transcript, the chat history used for the next
  request, and the chat shown after a restart MUST all match: no taken-back or dropped message
  appears in any of them.
- **FR-010**: `/undo` and `/edit` MUST work only in character chats. Elsewhere they MUST say so;
  while a reply streams, they MUST show the existing wait message. In both cases nothing
  changes.
- **FR-011**: After `/undo` or a saved `/edit`, `/prev` MUST have nothing to bring back.
- **FR-012**: Help, the command contract and the README MUST describe `/undo` and `/edit`.

### Key Entities

- **Turn**: a player message and the character's reply to it. The last turn may lack the reply.
- **Editing state**: in memory; which message is being edited. It ends on save, cancel or quit.
- **Branch**: the session file's record of earlier versions. Undo and edit start a new branch;
  the old one stays in the file, hidden.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A player can fix a typo in their last message with one command, a change and Enter,
  without starting a new chat.
- **SC-002**: A player can change any earlier message in a chat, theirs or the character's, in
  under a minute, and the chat continues from it.
- **SC-003**: After an undo or an edit, what the player sees, what the next request contains and
  what a resumed chat shows agree in every case in the acceptance scenarios.
- **SC-004**: No undo or edit deletes anything from a saved chat file.

## Acceptance Testing

- Unit tests with the simulated provider for the chat: undo of a full turn, of a reply-less
  message, with only the greeting, twice in a row; edit of a player message (sent and replied),
  of a character message (not sent), unchanged, empty, after a failure; persistence across
  reopening the file for both; `/prev` cleared by both.
- App tests: the `/edit` list (order, search, greeting absent), the editing state (Enter, Esc,
  text starting with `/`, Ctrl+R ignored), the input holding the undone text, the messages for
  the innkeeper, no chat and streaming, and the spend limit prompt on an edited player message.
- Happy path: chat with Alice, `/undo`, fix the text, send; `/edit` an earlier reply, save;
  restart, resume from `/sessions`, and the chat shows the edited state.
- Owner, manually: the look of the list and the editing state.

## Assumptions

- The session file's existing branch mechanism (used by `/regenerate`) can hold undo and edit
  without a new file format. How the current point survives a restart is a plan detail; 012
  found that a reload resumes from the last entry in the file.
- The input at the bottom of the screen can hold multi-line text, so long character replies can
  be edited there.
- Out of scope: browsing or restoring dropped branches; editing the greeting; an external editor
  for edits; a keyboard shortcut for undo; deleting a single message without dropping what
  follows; fixing the `/sessions` message count; the innkeeper (014).
