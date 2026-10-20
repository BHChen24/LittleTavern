# Feature Specification: Personas

**Feature Branch**: `008-persona` (stacked on `007-integrated`)

**Created**: 2026-10-20

**Status**: Draft

**Input**: Owner: "I can import characters, but I cannot set up *my* role." Agreed on 2026-10-20:

- personas are managed in a `personas` folder, so the user does not rewrite them every time;
- a persona is not bound to a particular character;
- placement follows SillyTavern's approach.

## Context

Today the only thing the model knows about the user is a name, `userName` in the settings file,
which replaces `{{user}}`. It does not know who the user is in the story. SillyTavern solves this
with *personas*: a name plus a description, written once, chosen as the active one, and placed in
the prompt. This feature brings that idea to LittleTavern, using the same Markdown-in-`$EDITOR`
authoring as 007.

## Clarifications

### Session 2026-10-20

- Q: One persona or several? → A: Several, each kept as its own file in a `personas` folder.
- Q: Should a persona be bound to a character? → A: No. One persona is active at a time, for every
  chat.
- Q: Where does the persona description go in the prompt? → A: Follow SillyTavern's default
  prompt order: main instruction, then lore placed "before", then **persona description**, then
  the character description and the rest.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Write a persona once (Priority: P1)

The owner creates a persona: their editor opens a short Markdown template with Name and
Description. They save and close it, and the persona is stored as a file in
`~/.littletavern/personas/`. They can write several personas and edit any of them later.

**Why this priority**: Without a persona there is nothing to choose or inject.

**Independent Test**: Create a persona named "Traveller" with a description. A file appears in
the personas folder, and the persona list shows it.

**Acceptance Scenarios**:

1. **Given** the app, **When** the owner chooses to create a persona, **Then** their editor opens
   a template with Name and Description sections and short explanations. Saving and closing it
   creates a persona file in the personas folder.
2. **Given** a persona file, **When** the owner chooses to edit it, **Then** the same file opens in
   the editor, and changes take effect when it closes.
3. **Given** a template without a name, or unchanged, **When** closed, **Then** nothing is created,
   the reason is shown, and the draft text is not lost (as in 007).
4. **Given** the personas folder, **When** the owner adds or edits a persona file by hand, **Then**
   the app picks up the change the next time the list is shown.

---

### User Story 2 - Choose who I am (Priority: P1)

The owner opens the persona picker, sees their personas and which one is active, and selects
one. From the next request on, `{{user}}` is that persona's name and its description is part of
the prompt. The choice is remembered across launches.

**Why this priority**: This is the point of the feature: the model knows who it is talking to.

**Independent Test**: Make "Traveller" active and chat with a character whose greeting uses
`{{user}}`. The greeting says "Traveller". A dry run shows the persona description in the
request and a `persona` part in the trace.

**Acceptance Scenarios**:

1. **Given** personas exist, **When** the owner opens the persona picker, **Then** every persona
   is listed by name, the active one is marked, and the list also offers "New persona", "Edit
   active persona" and "No persona".
2. **Given** a persona is selected, **When** the next request is assembled, **Then** `{{user}}` is
   replaced by its name and its description appears in the prompt after the "before" lore and
   before the character description.
3. **Given** an active persona, **When** the app restarts, **Then** it is still active.
4. **Given** "No persona", **When** chosen, **Then** no persona description is sent and `{{user}}`
   falls back to the `userName` setting, then to "User", as today.
5. **Given** the active persona's file was deleted, **When** a request is assembled, **Then** the
   app falls back as in scenario 4 and shows a one-time notice.
6. **Given** a new chat, **When** the greeting is shown, **Then** `{{user}}` in it uses the active
   persona's name.

---

### User Story 3 - See the persona in the trace (Priority: P2)

The persona description is a normal, explainable part of the context. `/trace` and the dry run
show it as its own part with its estimated tokens.

**Why this priority**: Explainable context is LittleTavern's identity (feature 003/005). A hidden
prompt part would break that.

**Independent Test**: With a persona active, `/trace` and `dry-run` list a `persona` part, and the
request text shows the description in the right place.

**Acceptance Scenarios**:

1. **Given** an active persona, **When** a request is assembled, **Then** the trace has a
   `persona` part with its estimated tokens, between `lore-before` and `description`.
2. **Given** no persona, **When** assembled, **Then** there is no `persona` part.
3. **Given** a persona description containing `{{char}}` or `{{user}}`, **When** assembled,
   **Then** the macros are replaced like in other parts.

---

### Edge Cases

- Two persona files with the same name: both are listed. The file name tells them apart, and the
  picker shows both.
- A persona with an empty description: allowed. Only the name is used, and no persona part is
  added.
- Persona names and descriptions in any language: kept as written.
- `LITTLETAVERN_HOME` set: the personas folder lives under its import root, as in 006 and 007.
- The `userName` setting and an active persona both exist: the persona wins.
- A persona file edited by hand into an unparseable state: the picker shows it as invalid, with
  the reason, and it cannot be activated until fixed.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Personas MUST be stored one per Markdown file in `<importRoot>/personas/`
  (`~/.littletavern/personas/` by default). The folder is created at startup like the other import
  folders.
- **FR-002**: The persona file format MUST be the Markdown section format used by 007, with Name
  (required) and Description sections and HTML-comment explanations that are not part of the
  persona.
- **FR-003**: The app MUST offer a persona command that opens a picker listing all personas (with
  the active one marked) plus "New persona", "Edit active persona" and "No persona". New and Edit
  open the owner's editor, as in 007.
- **FR-004**: The active persona MUST be remembered in the settings file and apply to every chat.
  It is not bound to a character.
- **FR-005**: When a persona is active, `{{user}}` MUST be its name everywhere, including greetings,
  and its description, with macros replaced, MUST be placed in the prompt after the "before" lore
  and before the character description, following SillyTavern's default order.
- **FR-006**: Without an active persona, behaviour MUST be exactly as today: `userName` setting,
  then "User", and no persona text.
- **FR-007**: The assembly trace MUST include a `persona` part with estimated tokens whenever
  persona text is sent. The dry run and `/trace` show it like any other part.
- **FR-008**: A missing or invalid active persona MUST fall back as in FR-006, with a one-time
  notice that names the file.

### Key Entities

- **Persona**: a name and a description, from one Markdown file.
- **Active persona**: the file name stored in settings, or none.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The owner can create a persona and make it active in under 2 minutes, and never has
  to retype it in later sessions.
- **SC-002**: With a valid persona active whose description is non-empty, 100% of character-chat
  requests and dry runs contain its description in the documented position, and the trace accounts
  for it. An empty description adds no persona part, and a missing or invalid persona file falls
  back as in FR-008.
- **SC-003**: With no persona, the assembled requests are identical to the requests before this
  feature (no regression).

## Acceptance Testing

Per the constitution's testing policy:

- **Automated**:
  - persona parsing (the shared section parser);
  - the folder listing, including invalid files;
  - the persona and `userName` fallbacks;
  - the assembly position and the `persona` trace part;
  - greeting macro replacement;
  - settings persistence;
  - the picker actions with a fake `VISUAL`;
  - a regression check that the output is unchanged without a persona.
- **Manual (owner)**: create two personas, switch between them in a chat, and read `/trace`.

## Assumptions

- SillyTavern's other persona positions (in the author's note, or at a depth in the chat) are out
  of scope. Only the default position is supported.
- Persona avatars are out of scope (text only).
- Binding personas to characters or chats is out of scope (clarified).
- The persona template's headings and explanations are in English (constitution 3.1.0). The
  content can be any language.
