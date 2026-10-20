# Feature Specification: Character Creator

**Feature Branch**: `007-character-creator` (stacked on `006-usability`)

**Created**: 2026-10-20

**Status**: Draft

**Input**: Owner: "Users should be able to create a simple character." Clarified on 2026-10-20:
the owner writes it in their own `$EDITOR`, from a Markdown template.

## Context

Until now LittleTavern could only import characters made elsewhere. This feature lets the owner
write a simple character from inside the app:

1. A Markdown template opens in their editor.
2. When they save and close it, the character is created.
3. The character is added to the library like any import, so chat, dry run and `/trace` work
   with it immediately.

## Clarifications

### Session 2026-10-20

- Q: Where is a new character edited? → A: In the owner's own editor (`$VISUAL` or `$EDITOR`),
  not in an in-app form.
- Q: What format is the template? → A: Markdown, with one section per field.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Write a character in the editor (Priority: P1)

The owner runs a command to create a character. Their editor opens a Markdown template with
sections for the name, description, personality, scenario, first message and example dialogue.
Each section has a short explanation. They fill it in, save and close the editor. LittleTavern
returns, reports that the character was created, and it is now in the library.

**Why this priority**: This is the feature.

**Independent Test**: Run the command, fill in the name and first message, save and quit the
editor. The import report shows the new character, and `/chat` with it shows the first message
as the greeting.

**Acceptance Scenarios**:

1. **Given** the app, **When** the owner runs the create command, **Then** the terminal is handed
   to their editor with the template open, and the app resumes when the editor exits.
2. **Given** a template with at least a name, **When** saved and closed, **Then** a character is
   created and added to the library. The report states its name and id, and that it was created
   in LittleTavern.
3. **Given** the created character, **When** used in `/chat`, `dry-run` or `/trace`, **Then** it
   behaves exactly like an imported card.
4. **Given** the explanations in the template, **When** the character is created, **Then** none of
   that guidance text ends up in the character's fields.
5. **Given** fields written in any language, **When** created, **Then** the text is kept exactly
   as written (macros such as `{{user}}` included).

---

### User Story 2 - Nothing is lost when something goes wrong (Priority: P1)

If the owner closes the editor without a name, or the file cannot be understood, LittleTavern
says what is wrong and keeps the draft. Running the command again reopens the same draft.

**Why this priority**: Losing a half-written character to a missing name would make the feature
unusable.

**Independent Test**: Fill in the description but no name, then save and quit. The app reports
"a character needs a name" and keeps the draft. Run the command again: the same text reopens.

**Acceptance Scenarios**:

1. **Given** a draft without a name, **When** the editor closes, **Then** no character is created,
   the message names the problem, and the draft file is kept.
2. **Given** an unchanged template (the owner just closed the editor), **When** the editor closes,
   **Then** nothing is created and the app says "Cancelled — the template was not changed".
3. **Given** a kept draft, **When** the create command is run again, **Then** the app offers to
   continue the draft or start a new one.
4. **Given** no editor can be started, **When** the command runs, **Then** the app says which
   editor it tried and how to set `$EDITOR`, and stays usable.
5. **Given** a successfully created character, **When** done, **Then** its draft is removed, and
   the generated card file is kept (User Story 3).

---

### User Story 3 - The created character is a normal card file (Priority: P2)

The created character is also saved as a standard character card file (V3 JSON) in
`~/.littletavern/characters/`. The owner can share it with other tools, back it up, or re-import
it.

**Why this priority**: It keeps LittleTavern's promise of standard formats. Without it, created
characters would be locked inside the app.

**Independent Test**: After creating a character, open `~/.littletavern/characters/` and check
that the new card file is there and that its name and fields match.

**Acceptance Scenarios**:

1. **Given** a created character, **When** the owner looks in the characters import folder,
   **Then** a V3 JSON card named after the character is there.
2. **Given** that file, **When** imported again, **Then** it is reported as already imported.
3. **Given** a character with the same name already in that folder, **When** created, **Then** the
   new file gets a distinct name and nothing is overwritten.

---

### User Story 4 - Simple lore while creating (Priority: P3)

The template has an optional lorebook section. The owner can add entries, each with a title,
trigger keywords, whether it is always on, and its content. These become the character's
embedded lorebook.

**Why this priority**: Lore is the heart of the product, but a character without lore is already
useful.

**Independent Test**: Add two entries, one with keywords and one always on. Create the character,
then dry-run it with a keyword: the trace shows one entry as always on and the other firing.

**Acceptance Scenarios**:

1. **Given** lore entries in the template, **When** created, **Then** the character's lorebook
   contains them with the given keywords, always-on flag and content.
2. **Given** an entry without keywords and not always on, **When** created, **Then** it is kept,
   and the report warns that it will never fire.

---

### Edge Cases

- Very long fields (thousands of characters): kept in full.
- The owner deletes a section heading: that field is empty, and a warning names it.
- Unknown sections: ignored, with a warning that names them.
- A name that is not a valid file name (slashes, emoji): the card file name is made safe, but the
  character's name is kept exactly.
- `LITTLETAVERN_HOME` is set: drafts and card files live under its import folder (006).
- The editor command contains arguments (for example `code --wait`): it is supported.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The app MUST offer a command that opens a Markdown character template in the
  owner's editor: `$VISUAL`, then `$EDITOR`, then a platform default. The app is suspended while
  the editor runs and resumes afterwards.
- **FR-002**: The template MUST have one section per field (name, description, personality,
  scenario, first message, example dialogue, and an optional system prompt), plus an optional
  lorebook section. Each section has a short explanation that is never copied into the
  character.
- **FR-003**: On save, the text MUST be turned into a character with each field exactly as
  written, after removing the explanations. A name is required.
- **FR-004**: The character MUST be saved as a standard V3 JSON card in the characters import
  folder, under a safe, unique file name. It MUST then be imported through the normal import, so
  it appears in the library with the same guarantees as any import.
- **FR-005**: The card MUST record, in its extension data, that it was created with LittleTavern.
- **FR-006**: Drafts MUST be kept in a drafts folder under the import root until a character is
  created from them. An unchanged template creates nothing.
- **FR-007**: Errors (no name, editor not found, unreadable file) MUST be reported with the
  specific cause, and MUST never discard the draft.
- **FR-008**: The same creation MUST be possible from the command line, given an existing
  Markdown file, for testing and scripting.

### Key Entities

- **Template**: the Markdown file with sections and explanations.
- **Draft**: a template being edited, kept until a character is created from it.
- **Created card**: the V3 JSON card generated from a draft, saved in the characters folder and
  imported.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The owner can create a character with a name, description and first message, and
  start chatting with it, in under 3 minutes.
- **SC-002**: 100% of the text typed into a section ends up in the matching field, and 0% of the
  explanation text does.
- **SC-003**: No draft is ever lost: every failure path leaves the draft file in place.
- **SC-004**: Every created card re-imports as "already imported" and passes the same import
  checks as external cards.

## Acceptance Testing

Per the constitution's testing policy:

- **Automated**:
  - template parsing: every field, explanations removed, missing name, unchanged template,
    unknown sections, lorebook entries;
  - card generation and safe, unique file names;
  - create-then-import round trip;
  - the command-line path;
  - the editor launch, using a fake editor command (a small script that writes text into the
    file);
  - the draft kept on failure.
- **Manual (owner)**: creating a character with their real editor, then chatting with it.

## Assumptions

- Editing an existing character is out of scope. v1 imports only, and this feature only adds
  creation.
- The template's explanations and section headings are in English (constitution 3.1.0). The
  owner can write the content in any language.
- Avatars and images are out of scope (text-only terminal).
