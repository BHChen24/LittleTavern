# Feature Specification: UI Polish

**Feature Branch**: `009-ui-polish` (to be stacked on the finished `008-persona`)

**Created**: 2026-10-20

**Status**: Draft (plan and tasks are written after 008 is merged, because both edit `app.ts`)

**Input**: Owner feedback after using 001–007:

1. "You" and the character's name are hard to tell apart; the names should use the same weight.
2. The home screen is bare: decorate it with ASCII art, and push the earlier terminal output away
   or use a full-screen mode.
3. The model is shown even without a key. It should appear only once a key is set, and become a
   picker later.

Agreed on 2026-10-20:

- use full screen;
- no launcher menu on the home screen, only a logo;
- include dialogue colouring, a waiting indicator, an immersive input placeholder ("Talk to …",
  not "Message"), and distinct error styling;
- consider the status bar split, a maximum text width, `NO_COLOR` and light/dark support, and
  writing long messages in `$EDITOR` if the effort is reasonable;
- reuse pi features wherever possible.

## Context

001–008 work, but the interface still looks like a prototype. This feature changes no behaviour.
It improves how the app looks and reads, so that a first-time user, such as an interviewer, sees
a finished product.

## Clarifications

### Session 2026-10-20

- Q: Full-screen or inline? → A: Full screen by default, and the terminal is restored on exit.
  **Mouse is on by default** (owner, 2026-10-20). Wheel scrolling works, and text selection and
  copy are handled by the app: copied on release. A setting can turn the mouse off.
- Q: Should the home screen become a launcher menu? → A: No. Most actions happen through `/`
  commands after entering. The home screen only gains a logo.
- Q: Input placeholder wording? → A: Immersive, not "Message": "Talk to <character>… (/ for
  commands)".
- Q: Which optional items are in scope? → A: The dialogue colouring, the waiting indicator, the
  placeholder and the error styling are required. The status bar split, the maximum width,
  `NO_COLOR` with light/dark support, and `$EDITOR` for long messages depend on effort, and pi's
  own features are preferred.

### Session 2026-10-20 (owner acceptance feedback)

- Q: How should the logo sit on the home screen? → A: The block-letter "little TAVERN" logo,
  left-aligned, with no repeated name below it: the next line is the version and the tagline.
- Q: What happens when Enter is pressed on the home screen? → A: The chat opens and the character
  picker opens on top of it, so a first-time user lands in roleplay, not in plain chat. Plain chat
  and `/plain` stay as they are; their future role (an in-app assistant) is a separate, undecided
  feature.
- Q: Where does creating a character live? → A: Inside `/characters`, as a "New character" entry,
  like "New persona" in `/persona`. The separate `/new-character` command is removed.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A full-screen app (Priority: P1)

Launching LittleTavern takes over the whole terminal window, like a full-screen program. Earlier
shell output is gone from view. The conversation can be scrolled with the keyboard. Quitting
restores the terminal exactly as it was.

**Why this priority**: The owner's choice, and the basis for the home screen and the layout.

**Independent Test**: Run `littletavern` after some shell output. The screen is clean, showing
only LittleTavern. After a long conversation, the earlier messages can be scrolled back. Quit,
and the previous shell output is back.

**Acceptance Scenarios**:

1. **Given** a terminal with earlier output, **When** the app starts, **Then** it fills the window
   and none of the earlier output is visible.
2. **Given** a conversation longer than the window, **When** the owner presses PgUp, PgDn, Home or
   End (or uses the documented keys), **Then** the transcript scrolls while the input and the
   status bar stay in place.
3. **Given** the app quits normally, by Ctrl+C or because of an error, **When** it exits, **Then**
   the terminal shows its previous content and works normally.
4. **Given** the default settings, **When** the owner scrolls the mouse wheel, **Then** the
   transcript scrolls. **When** they drag to select text, **Then** the text is selected and copied
   to the clipboard on release.
5. **Given** the mouse setting is turned off, **When** the owner drags, **Then** the terminal's own
   selection works.

---

### User Story 2 - A home screen with a logo (Priority: P1)

The home screen shows an ASCII-art LittleTavern logo above the existing information (version,
description, "Press Enter to start", the `/` hint and the key status).

**Why this priority**: It is the first thing anyone sees.

**Independent Test**: Launch the app in an 80-column terminal and check that the logo appears.
Launch it in a 50-column terminal and check that a plain title appears instead, with nothing
broken or wrapped.

**Acceptance Scenarios**:

1. **Given** a terminal at least as wide as the logo, **When** the home screen shows, **Then** the
   logo appears, styled with the theme's accent, above the existing lines, and is roughly
   centred.
2. **Given** a narrower terminal, **When** the home screen shows, **Then** a plain one-line title
   replaces the logo.
3. **Given** the logo, **When** inspected, **Then** it uses only ASCII or box-drawing characters,
   so it renders the same everywhere.

---

### User Story 3 - Messages that read like a story (Priority: P1)

The user's and the character's messages are equally easy to identify. Both names have the same
weight, they differ in colour, and each message has a coloured bar on its left. Spoken dialogue
inside quotes stands out from narration, and `*actions*` stay italic. Errors look different from
ordinary notices.

**Why this priority**: The owner's first complaint, and the core of the reading experience in
roleplay.

**Independent Test**: In a chat where the reply contains narration, `"quoted speech"`,
`「CJK quoted speech」` and `*an action*`, check that:

- both names are bold;
- the speech is coloured;
- the action is italic;
- the bars on the left distinguish who is speaking.

Trigger a provider error and check that it is styled as an error.

**Acceptance Scenarios**:

1. **Given** a chat, **When** messages are shown, **Then** the user's label and the character's
   label have the same font weight, use different colours, and each message carries a
   left-side bar in its speaker's colour. The text starts on the line right after the label,
   with no blank line, and one blank line separates messages.
2. **Given** text inside `"…"`, `“…”` or `「…」`, **When** shown, **Then** it uses a dialogue colour.
   Text inside `*…*` remains italic.
3. **Given** a provider error or a failed command, **When** shown, **Then** it uses an error style
   (colour plus an `Error:` prefix) that differs from ordinary notices.
4. **Given** colour is disabled, **When** messages are shown, **Then** the labels, the bars and the
   `Error:` prefix still distinguish everything.

---

### User Story 4 - The app shows that it is working (Priority: P1)

After the owner sends a message, a line such as "Seraphina is writing…" with a small animation
appears until the first words arrive.

**Why this priority**: Without it, the pause after sending looks like a freeze.

**Independent Test**: With a simulated model that delays its first token, send a message. The
indicator shows during the delay and disappears when text arrives. Esc still interrupts.

**Acceptance Scenarios**:

1. **Given** a message is sent, **When** no text has arrived yet, **Then** a waiting indicator
   naming the character (or "Assistant" in plain chat) is shown.
2. **Given** the first text arrives, **When** it renders, **Then** the indicator disappears.
3. **Given** the indicator is shown, **When** the owner presses Esc or an error occurs, **Then** it
   disappears, and the usual interruption or error handling applies.

---

### User Story 5 - An input that invites the story (Priority: P1)

The empty input shows an immersive placeholder: "Talk to Seraphina… (/ for commands)" in a
character chat, and "Talk… (/ for commands)" in plain chat. Without a key it reads "Add your key
with /apikey to start talking".

**Why this priority**: Agreed on 2026-10-20. Cheap, and it doubles as guidance.

**Independent Test**: Check the placeholder in plain chat, in a character chat and without a key.

**Acceptance Scenarios**:

1. **Given** each of the three states, **When** the input is empty, **Then** the matching
   placeholder is shown, dimmed.
2. **Given** the owner types, **When** text is present, **Then** the placeholder disappears.

---

### User Story 6 - Key first, then the model (Priority: P1)

Before a key is set, the status bar does not show a model. It shows "No API key — /apikey". Once
a key is added with `/apikey`, the model picker opens straight away, so first-time setup is a
single flow. After that, the status bar shows the model as it does now.

**Why this priority**: The owner's third point. It removes a confusing detail and prepares the
model picker as part of setup.

**Independent Test**: Start without a key and check that the status bar shows no model. Add a
key and check that the model picker opens. Pick a model and check that the status bar shows it.

**Acceptance Scenarios**:

1. **Given** no key, **When** the status bar shows, **Then** it contains "No API key — /apikey"
   and no model name.
2. **Given** a key was just added through `/apikey`, **When** the flow finishes, **Then** the
   model picker opens with the current model preselected. Esc keeps the current model.
3. **Given** a key from the environment, **When** the app starts, **Then** the model is shown as
   now, and no picker opens by itself.

---

### User Story 7 - Optional refinements (Priority: P3, effort-dependent)

Each of these is included only if the plan finds it cheap, preferably by using an existing pi
capability. Otherwise it is listed as deferred in the plan:

- **a.** The status information split into a top line (character, persona, model) and a bottom
  line (tokens, cache, cost).
- **b.** The message text limited to a comfortable maximum width (about 100 columns) on wide
  terminals.
- **c.** `NO_COLOR` respected, and colours chosen for light or dark terminal backgrounds.
- **d.** Long messages composed in `$EDITOR` from the input (for example Ctrl+G).

## Edge Cases

- A very small terminal (less than 40 columns or 10 rows): the app still works, with plain
  fallbacks and no crash.
- Resizing during streaming: the layout reflows, and the indicator and scroll position stay
  sensible.
- A quote that is never closed in a message: colouring stops at the end of that paragraph, and
  nothing bleeds into the next message.
- Messages containing terminal control sequences are still sanitised (`stripControls`) before any
  styling.
- The app crashes in full-screen mode: the terminal is still restored (as in 001's guarantee).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The app MUST run full-screen by default, using pi-tui's full-screen mode, and MUST
  restore the terminal on every exit path.
- **FR-002**: The transcript MUST be scrollable with the keyboard and the mouse wheel while the
  input and the status stay fixed. Mouse capture MUST be on by default, with app-owned selection
  that copies on release, and MUST be possible to turn off with a setting.
- **FR-003**: The home screen MUST show an ASCII or box-drawing logo when it fits, and a plain
  title otherwise.
- **FR-004**: The user's and the character's labels MUST have equal weight and different colours,
  each message MUST have a speaker-coloured left bar, and spacing MUST follow User Story 3,
  scenario 1.
- **FR-005**: Quoted dialogue (`"…"`, `“…”`, `「…」`) MUST be coloured, and `*…*` MUST stay italic.
  Styling is applied after `stripControls`.
- **FR-006**: Errors MUST be shown with an `Error:` prefix and an error style distinct from
  notices.
- **FR-007**: A waiting indicator MUST be shown from sending until the first text, an error or an
  interruption.
- **FR-008**: The empty input MUST show the immersive placeholders in User Story 5.
- **FR-009**: Without a key, the status bar MUST NOT show a model. Adding a key through `/apikey`
  MUST open the model picker.
- **FR-010**: Every distinction MUST remain visible when colour is unavailable (labels, bars and
  prefixes carry the meaning).
- **FR-011**: The home screen MUST show the logo left-aligned and MUST NOT repeat the product name
  below it; the version appears once, with the tagline.
- **FR-012**: Pressing Enter on the home screen MUST open the chat with the character picker shown.
  Cancelling the picker leaves the user in plain chat, as before.
- **FR-013**: The character picker MUST offer "New character", which starts 007's creation flow
  (including continuing a draft). The `/new-character` command MUST be removed.

### Key Entities

- **Theme**: named styles for user, character, notice, error, dialogue, accent and muted text.
- **Display setting**: mouse capture on or off (default on).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In a chat screenshot, the owner can tell who said each message at a glance, and the
  two labels have the same weight.
- **SC-002**: A first-time user launching the app sees a clean full-screen home screen with the
  logo and no leftover shell output.
- **SC-003**: The interval between sending and the first text is never shown as an empty screen.
- **SC-004**: All automated tests from 001–008 still pass, and so do the 19 automated v1
  acceptance checks.

## Acceptance Testing

Per the constitution's testing policy:

- **Automated**:
  - the logo and its narrow fallback;
  - the message rendering (labels, bars, spacing);
  - the dialogue colouring, including unclosed quotes and CJK quotes;
  - the error prefix;
  - the waiting indicator's lifecycle with a delayed simulated model;
  - the placeholders in each state;
  - the status bar with no key;
  - the model picker opening after `/apikey`;
  - the meaning that remains with colour disabled.
- **Manual (owner)**: the overall look in the owner's terminal, full-screen scrolling, resizing,
  and the terminal restore on exit.

## Assumptions

- Images and avatars stay out of scope (text only).
- Thinking/reasoning display stays out of scope.
- The exact colours belong to the plan. They must work on dark backgrounds, and on light
  backgrounds if item 7c is included.
