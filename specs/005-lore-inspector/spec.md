# Feature Specification: Lore Inspector

**Feature Branch**: `005-lore-inspector`

**Created**: 2026-10-19

**Status**: Draft

**Input**: User description: "005-lore-inspector: show 003's trace to people. A `--dry-run` command
prints what would be sent to the model and why, without calling it. A `/trace` overlay in the app
shows the trace of the last request in a character chat: which lorebook entries fired and why,
which were left out and why, and the token cost of each part. This is the demo piece for 'the
right lore at the right time', and it can be cut if time runs out."

## Context

003 records every decision in a trace, and 004 keeps the last one in memory. Until now nobody can
*see* it. This feature makes context engineering visible, for two audiences:

- **the owner while tuning**: why did this entry not fire, and what is eating the budget?
- **an interviewer during a demo**: the clearest way to show that LittleTavern decides what the
  model sees, rather than just forwarding chat text.

Nothing here changes what is sent to the model.

## Clarifications

### Session 2026-10-19

- Q: Does v1 offer an in-app preview, assembling for a draft message before sending? → A: No. The
  inspector shows only the last request; previews use the command-line dry run. The in-app
  command is named `/trace`, because `/lore` was ambiguous next to 004's `/lorebooks`.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See a request before sending it (Priority: P1)

The owner names a character and a message on the command line and gets a readable report, with
nothing sent to a model: the assembled instructions, the history, and the trace. The trace lists
which lore entries fired with their reasons, which were left out with their reasons, and the
estimated token cost of each part. No API key is needed, and nothing costs money.

**Why this priority**: It works without the TUI, without a key and without spending anything, so
it is the fastest way to tune a lorebook and the safest thing to show live in an interview.

**Independent Test**: Import the lighthouse sample card, then dry-run it with a message containing
one of its keywords. The report shows that entry as fired with "keyword `<key>` matched in message
1", the other entry as not fired with its reason, and a token total.

**Acceptance Scenarios**:

1. **Given** an imported character and a message, **When** the owner runs the dry run, **Then** the
   output shows, in order:
   1. a summary line (character, model, total estimated tokens, lore used against the budget);
   2. the parts table: each included part and its estimated tokens;
   3. lore fired: each entry with its lorebook, name, reason and tokens;
   4. lore not fired: each entry with its lorebook, name and reason;
   5. notes and ignored features;
   6. the full assembled request text.
2. **Given** no message is given, **When** the dry run runs, **Then** it assembles the opening of a
   new chat (greeting only) and says so.
3. **Given** a saved chat, **When** the owner dry-runs with that chat and a new message, **Then**
   the chat's current history is used, as if the message were sent next.
4. **Given** lorebooks attached to the character (004), **When** dry-run, **Then** they are
   included just as in a real chat.
5. **Given** the settings (user name, lore budget, scan depth, reply reserve, model), **When**
   dry-run, **Then** they are applied exactly as for a real request, so changing a setting and
   dry-running again shows the effect.
6. **Given** a machine-readable flag, **When** dry-run, **Then** the trace and the assembled prompt
   are printed as JSON instead.
7. **Given** an unknown or ambiguous character id, **When** dry-run, **Then** a clear message is
   printed and the command exits with a non-zero code.

---

### User Story 2 - See why the last reply knew what it knew (Priority: P1)

While chatting with a character, the owner opens an inspector overlay that shows the trace of the
request that produced the last reply: what fired, what did not, and the cost of each part. They
close it and keep chatting.

**Why this priority**: It ties the trace to a real conversation in progress. This is the live
version of the demo.

**Independent Test**: In a character chat with the simulated model, send a message containing a
lore keyword, then open the inspector. It lists that entry as fired with the right message number,
and the budget line matches the trace.

**Acceptance Scenarios**:

1. **Given** a character chat with at least one request sent, **When** the owner opens the
   inspector, **Then** it shows the same sections as the dry run except the full request text,
   for the last request.
2. **Given** the inspector is open, **When** the owner presses Esc, **Then** it closes and the chat
   continues.
3. **Given** more entries than fit on the screen, **When** the inspector is open, **Then** the owner
   can scroll through the whole content.
4. **Given** no request has been sent yet in this chat, **When** the inspector opens, **Then** it
   says so and suggests sending a message or using the dry run.
5. **Given** a plain (no-character) chat, **When** the inspector command is used, **Then** it says
   the inspector works in character chats.
6. **Given** a regenerated reply, **When** the inspector opens, **Then** it shows the trace of the
   regeneration request.

---

### User Story 3 - Read it at a glance (Priority: P2)

The report is easy to scan: fired and not-fired entries are clearly separated, the most important
numbers (total tokens, lore used against the budget, messages left out) sit at the top, long
contents are cut short, and the reasons read as plain sentences.

**Why this priority**: The data is already correct after User Stories 1 and 2. This story makes it
presentable for a demo.

**Independent Test**: For a lorebook with 30 entries, the report's first screen shows the summary
and every fired entry, and the not-fired entries are grouped by reason with a count per group.

**Acceptance Scenarios**:

1. **Given** any report, **When** shown, **Then** the first line summarises it, for example: total
   estimated tokens, lore tokens used against the budget, and history messages included and left
   out.
2. **Given** many not-fired entries, **When** shown, **Then** they are grouped by reason (disabled,
   no keyword in the last N messages, no keywords, budget), with a count per group.
3. **Given** an entry, **When** listed, **Then** its line shows the lorebook, its name (or "entry
   #n" when unnamed), the reason as a short sentence, and the estimated tokens.
4. **Given** token numbers, **When** shown, **Then** they are labelled as estimates.

---

### Edge Cases

- A character with no lorebooks: the lore sections say "no lorebooks", and the rest is shown.
- A trace with notes (for example "request exceeds the context window"): the notes appear right
  under the summary.
- Entries using ignored features: those features are listed per entry, so simplifications stay
  visible.
- A dry run with a session file whose character is missing: the same error as resuming in 004.
- Very long assembled text in the dry run: printed in full. The terminal or a pager handles
  scrolling.
- The dry run needs no API key and never makes a network request, even if a key is configured.
- Chinese entry names and keys: displayed correctly and aligned by display width.

## Requirements *(mandatory)*

### Functional Requirements

**Dry run**

- **FR-001**: The command line MUST offer a dry run that takes a character (id or unique prefix),
  an optional message, an optional saved chat, and an optional JSON flag. It prints the report
  and exits without starting the full-screen app.
- **FR-002**: The dry run MUST build its input exactly as a real character-chat request would:
  - the settings;
  - the attached lorebooks;
  - the selected model's context window;
  - the greeting for a new chat;
  - the current branch for a saved chat.

  It MUST then call the same assembly.
- **FR-003**: The dry run MUST NOT contact any provider or require a key.
- **FR-004**: With the JSON flag, the output MUST be one JSON document containing the assembled
  prompt and the trace, as produced by the assembly.

**Inspector**

- **FR-005**: The app MUST offer a `/trace` command that opens an inspector overlay for the last
  request of the current character chat. The overlay is scrollable and closes with Esc.
- **FR-006**: The inspector MUST read the trace kept by 004. It MUST NOT re-run the assembly.

**Presentation (shared)**

- **FR-007**: The dry run and the inspector MUST use one shared formatter, so the same trace looks
  the same in both. The dry run adds the full request text at the end.
- **FR-008**: The report MUST start with a summary line, then the notes, then the parts table,
  then the fired entries, then the not-fired entries grouped by reason with counts.
- **FR-009**: Every reason MUST be rendered as a short sentence. Examples: "always on", "keyword
  `灯塔` in message 3", "disabled", "no keyword in the last 2 messages", "no keywords defined",
  "over budget".
- **FR-010**: Token figures MUST be labelled as estimates.

### Key Entities

- **Report**: the lines produced from one assembly trace (and, for the dry run, the assembled
  prompt).
- **Dry-run input**: character, optional message, optional saved chat, flags.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For any trace, every lorebook entry considered appears in the report exactly once,
  either as fired or inside a not-fired group.
- **SC-002**: A dry run of a sample card completes in under one second, with no network access.
- **SC-003**: For the same character, settings, history and message, the dry run and the inspector
  show the same trace content.
- **SC-004**: In a demo, the owner can answer "why did the model know X?" by pointing at one line
  of the inspector within 10 seconds.

## Acceptance Testing

Per the constitution's testing policy:

- **Automated**:
  - formatter tests on synthetic traces: the order, grouping, counts, reason sentences, and the
    "every entry exactly once" property;
  - dry-run tests in-process: text output, JSON output, a new chat versus a saved chat, an unknown
    id, and a check that no provider is contacted, using the simulated setup and no key.
- **Manual (owner)**: the inspector overlay look and scrolling, and a demo run-through with a
  sample card.
- **Deferred**: tests judged too complex during planning are listed in the plan.

## Assumptions

- This feature only displays. It never changes the assembly or what is sent.
- Plain chats from 001 have no trace, so the inspector is for character chats only.
- Colours and styling follow whatever 001's theme provides. Further visual polish belongs to the
  post-v1 polish pass.
- A live, always-visible side panel is out of scope. The overlay on demand is enough for v1.
- Choosing the message for the dry run from inside the app (a preview before sending) is out of
  scope. The command-line dry run covers it.
