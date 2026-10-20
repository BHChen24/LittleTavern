# Feature Specification: Character Chat

**Feature Branch**: `004-character-chat`

**Created**: 2026-10-19

**Status**: Draft

**Input**: User description: "004-character-chat: bring 001-003 together so the owner can actually
roleplay. Choose an imported character, start a chat that opens with the character's greeting,
and every request is built by 003's prompt assembly (card fields, lore, history) instead of 001's
fixed prompt. Regenerate the last reply (required). Chats are saved as JSONL sessions. Standalone
lorebooks can be used with a character. Usage accounting from 001 keeps working."

## Context

001 gives a working chat with a model, 002 an imported library, and 003 a prompt assembly with a
trace. This feature connects them into the v1 end result: **basic roleplay in the terminal with
an imported card**. 005 then shows the trace (`--dry-run`, `/lore`) for the demo.

## Clarifications

### Session 2026-10-19

- Q: Does v1 include listing and resuming earlier chats (User Story 3), or only saving them?
  → A: Include it. Chats are saved automatically, and `/sessions` lists them so one can be
  resumed.
- Q: Should standalone lorebooks be attached to a character or to a single chat? → A: To the
  character. Every chat with that character uses them, and attachments persist per character.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Chat with an imported character (Priority: P1)

The owner picks a character from the library. A new chat starts and shows the character's
greeting. From then on, every reply comes from a request assembled from the card, its lore and
the conversation, so the model stays in character and brings up lore when the conversation
touches it.

**Why this priority**: This is the v1 goal itself: "basic roleplay".

**Independent Test**: Import the lighthouse sample card, choose it, and check that the greeting
appears. Send a message mentioning a lore keyword and confirm that a reply arrives. In an
automated test with the simulated model, the request sent contains the card's description and
the triggered lore entry.

**Acceptance Scenarios**:

1. **Given** a library with characters, **When** the owner opens the character picker, **Then**
   it lists the imported characters by name, filters as they type, and starts a chat with the
   chosen one.
2. **Given** a character is chosen by id or prefix with a command, **When** the command runs,
   **Then** the chat starts the same way as with the picker.
3. **Given** a new chat, **When** it starts, **Then** the character's first message (greeting),
   with `{{char}}` and `{{user}}` replaced, is shown as the character's first message and becomes
   part of the history. A card without a greeting starts with an empty transcript.
4. **Given** an active character chat, **When** the owner sends a message, **Then** the request is
   produced by 003's assembly from the character, its lorebooks, the user's name, the history and
   the selected model's context window, and the reply streams as in 001.
5. **Given** an active character chat, **When** the owner looks at the status bar, **Then** it
   shows the character's name along with the existing model, key and usage information.
6. **Given** no character is chosen, **When** the owner chats, **Then** the app behaves as in 001
   (plain chat with the fixed roleplay prompt).
7. **Given** a reply is interrupted with Esc or fails, **When** that happens, **Then** the
   behaviour matches 001: the partial text is kept and marked, errors are readable, and a usage
   record is written.

---

### User Story 2 - Regenerate the last reply (Priority: P1)

The owner does not like the character's last reply and asks for another one. The last reply is
replaced by a newly generated one, produced from the same conversation.

**Why this priority**: The owner listed regenerate as required for v1. Roleplay depends on
rerolling weak replies.

**Independent Test**: With the simulated model scripted to give two different replies, send a
message, regenerate, and check that the transcript shows the second reply in place of the first
and that the second request did not contain the first reply.

**Acceptance Scenarios**:

1. **Given** the last message is a reply from the character, **When** the owner regenerates,
   **Then** that reply is removed from the visible conversation and a new reply streams in its
   place, generated from the history before it.
2. **Given** a regenerated reply, **When** the chat continues, **Then** later requests contain only
   the new reply, not the replaced one.
3. **Given** the replaced reply, **When** the session file is inspected, **Then** it is still
   there as an earlier alternative. Nothing is deleted. Browsing alternatives in the app is out
   of scope.
4. **Given** the last message is from the user (for example after an error), **When** the owner
   regenerates, **Then** a reply is generated for that message.
5. **Given** a chat whose only message is the greeting, **When** the owner regenerates, **Then**
   nothing happens and a short notice explains why. The greeting is not regenerated.
6. **Given** a reply is streaming, **When** the owner regenerates, **Then** nothing happens until
   it finishes or is interrupted.
7. **Given** each regeneration, **When** it completes, **Then** it produces its own usage record,
   like any other request.

---

### User Story 3 - Chats are saved and can be resumed (Priority: P2)

Every character chat is saved automatically as it happens. The owner can list previous chats and
resume one, continuing exactly where it stopped.

**Why this priority**: Roleplay sessions span days. But a single sitting already proves the
core, so P1 comes first.

**Independent Test**: Start a chat, exchange two messages, quit, relaunch, open the chat list,
resume the chat, and check that the transcript and the next request's history match.

**Acceptance Scenarios**:

1. **Given** a character chat, **When** a message is added, a reply completes or a regeneration
   happens, **Then** the change is saved to that chat's session file immediately, one JSON
   record per line, without rewriting earlier lines.
2. **Given** saved chats, **When** the owner lists them, **Then** each shows the character's
   name, the start time, the last activity time and the number of messages, newest first.
3. **Given** a chat is chosen from the list, **When** it resumes, **Then** the visible transcript
   and the history used for the next request are exactly the current branch of that session
   (replaced replies excluded).
4. **Given** a session whose character is no longer in the library, **When** resumed, **Then** the
   app says the character is missing and does not start the chat.
5. **Given** usage records written during a character chat, **When** inspected, **Then** they
   carry the chat's session identifier, so costs can be totalled per chat later.

---

### User Story 4 - Use standalone lorebooks with a character (Priority: P2)

The owner has imported a standalone lorebook (for example a world's setting) and wants it active
when chatting with a particular character, in addition to the card's own lorebook.

**Why this priority**: Many cards rely on separate world books. The samples include two
standalone lorebooks.

**Independent Test**: Attach the Eldoria lorebook to Seraphina, start a chat, and send a message
mentioning an Eldoria keyword. The assembled request includes that entry.

**Acceptance Scenarios**:

1. **Given** a character chat, **When** the owner attaches a standalone lorebook by id or prefix,
   **Then** it is used in every following request for that character, after the card's own
   lorebook.
2. **Given** an attached lorebook, **When** the owner detaches it, **Then** it is no longer used.
3. **Given** attachments, **When** the app restarts, **Then** they persist for that character.
4. **Given** the owner lists attachments, **When** shown, **Then** the card's embedded lorebook and
   the attached ones are listed by name and entry count.
5. **Given** an attached lorebook was deleted from the library, **When** a request is assembled,
   **Then** it is skipped and a notice says so once.

---

### Edge Cases

- Switching to another character during a chat: the current chat is already saved, and a new
  chat starts with the new character.
- Starting a chat with the same character twice: two separate chats.
- Switching models in a character chat: allowed. The next request uses the new model's context
  window.
- A rejected key, network errors and quitting mid-stream behave exactly as in 001. A failed
  request leaves the user's message in the history so the owner can regenerate.
- Session files from a newer LittleTavern version with unknown record types: unknown records are
  ignored when resuming.
- A very long chat: history trimming (003 FR-015) applies, and the saved session still holds
  everything.
- The user name is "User" unless changed in the settings file (FR-016).

## Requirements *(mandatory)*

### Functional Requirements

**Starting a chat**

- **FR-001**: Users MUST be able to choose a character with an in-app picker (filter by typing)
  and with a command that takes an id or unique id prefix.
- **FR-002**: A new chat MUST show the character's greeting (`first_mes` with macros replaced) as
  its first character message, which is part of the history. Alternate greetings are not used in
  v1.
- **FR-003**: Without a chosen character, 001's plain chat MUST remain unchanged.

**Requests**

- **FR-004**: In a character chat, every request MUST be built by 003's `assemblePrompt`. Its
  inputs are:
  - the character;
  - its attached standalone lorebooks;
  - the user's name;
  - the current history;
  - the selected model's context window;
  - the settings for scan depth, lore budget and reply reserve.
- **FR-005**: The assembled instructions, history and post-history instructions MUST reach the
  model in that order, with history roles preserved (user / character).
- **FR-006**: Each request's trace MUST be kept in memory and available to 005 as "the trace of
  the last request".
- **FR-007**: Settings changed in the settings file (lore budget, scan depth, reply reserve, user
  name) MUST apply from the next request, without restarting.

**Regenerate**

- **FR-008**: Users MUST be able to regenerate with a command and with a key binding, under the
  rules in User Story 2.
- **FR-009**: Regeneration MUST NOT delete the replaced reply from the session file.

**Sessions**

- **FR-010**: Each character chat MUST be saved as its own session file in the app's data
  directory, in JSON Lines format. Records are appended, never rewritten. The file records the
  character's library id.
- **FR-011**: A session file MUST represent replaced replies so that resuming restores only the
  current branch of the conversation.
- **FR-012**: Users MUST be able to list saved chats (newest first) and resume one.
- **FR-013**: Usage records written during a character chat MUST use the chat's session
  identifier.

**Lorebooks**

- **FR-014**: Users MUST be able to attach and detach standalone lorebooks to the current
  character and list the active lorebooks. Attachments MUST persist per character.
- **FR-015**: Attached lorebooks missing from the library MUST be skipped with a one-time notice.

**Settings**

- **FR-016**: The settings file MUST accept the optional fields `userName`, `loreBudget`,
  `scanDepth` and `replyReserve`. Missing fields use 003's defaults.

### Key Entities

- **Chat session**: one conversation with one character. It has an identifier, the character's
  library id, the start time and the last activity time, and an append-only list of records
  (messages and their branching).
- **Chat message**: the role (user or character), the text, a timestamp, and its position in the
  conversation tree. Regenerated replies are siblings of the replies they replace.
- **Lorebook attachments**: for each character id, the list of attached standalone lorebook ids.
- **Last trace**: the most recent `AssemblyTrace`, held in memory for 005.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Starting from an empty library, the owner can import a sample card, start a chat
  with it and receive an in-character reply in under 3 minutes.
- **SC-002**: In automated tests with the simulated model, 100% of character-chat requests carry
  the card's main instruction and the lore entries that 003 selected.
- **SC-003**: After any number of regenerations, the next request contains exactly one reply per
  turn: the latest version.
- **SC-004**: A resumed chat's next request has the same history as it would have had without
  quitting.
- **SC-005**: Every request made in a character chat produces one usage record with that chat's
  session identifier.

## Acceptance Testing

Per the constitution's testing policy:

**Automated** (simulated model):

- Starting a chat with the greeting.
- The assembled request contents (main instruction, description, triggered lore) reaching the
  simulated model.
- The regenerate rules in User Story 2.
- Session append and resume round-trip, including the branch after a regeneration.
- Attach and detach persistence.
- The session id on usage records.

**Manual (owner)**: the picker feel, a real roleplay exchange with a sample card, and resuming
after a restart.

**Deferred**: tests judged too complex during planning are listed in the plan.

## Assumptions

- Choosing alternate greetings, browsing or swiping between regenerated alternatives, editing or
  deleting messages, and "continue" are out of scope for v1.
- Group chats and personas (beyond a user name in settings) are out of scope.
- Attachments are per character, not per chat. Every chat with that character uses them.
- Plain (no-character) chats from 001 remain unsaved.
- The trace is not displayed in this feature. That is 005.
- How the session file is structured, and whether pi's session tooling is reused, is decided in
  the plan (constitution I prefers pi's existing tooling).
