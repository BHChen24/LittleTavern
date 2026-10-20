# Feature Specification: Prompt Assembly with Lore Trace

**Feature Branch**: `003-prompt-assembly`

**Created**: 2026-10-19

**Status**: Draft (simple first version; the owner plans to refine it)

**Input**: User description: "003-prompt-assembly: a simple first version of prompt assembly,
based on how SillyTavern does it, so that imported card content and lorebook entries reach the
model. Card fields go into the system prompt in a fixed order. Lorebook entries activate by
primary-keyword substring match within the most recent messages (scan depth), constant entries
are always on, entries are ordered by insertion order, and the lore stays within a token budget.
Only {{char}} and {{user}} macros. The lore trace data is built in from the start: every request
comes with a record of what was included, which entries activated and why, which were left out
and why, and the token cost of each part. Display of the trace (--dry-run, /lore) is feature
005."

## Context

This is the engine's core: it decides what the model sees. It takes an imported character (from
002), its lorebooks, the user's name and the conversation so far, and produces the ordered
messages for one request, together with a **trace** that explains every decision. 004 sends these
messages to the model; 005 shows the trace to the owner. This feature has no user interface of
its own.

It is deliberately a simple first version. It borrows the shape of SillyTavern's default
behaviour, not its full feature set, and the owner will refine it later. Each simplification is
listed so that refining it later is a conscious choice.

## User Scenarios & Testing *(mandatory)*

The "user" of this feature is the owner, judging the assembled request through tests now and
through 004 and 005 later.

### User Story 1 - The character definition reaches the model (Priority: P1)

Given an imported character and a conversation, the assembled request starts with instructions
built from the card: the main instruction, description, personality, scenario and example
dialogue, in a fixed order. The conversation follows, and the card's post-history instructions
come last. `{{char}}` and `{{user}}` are replaced by the character's and the user's names
everywhere.

**Why this priority**: Without it, an imported card has no effect on the conversation, and v1
cannot do basic roleplay.

**Independent Test**: Assemble a request for a test card with two turns of history. The output
contains the card's fields in the documented order, then the two turns, then the post-history
instructions, with the macros replaced.

**Acceptance Scenarios**:

1. **Given** a card with a system prompt, **When** assembled, **Then** the card's system prompt is
   the main instruction. **Given** a card without one, **Then** the default main instruction is
   used: "Write {{char}}'s next reply in a fictional chat between {{char}} and {{user}}."
2. **Given** a card with description, personality, scenario and example messages, **When**
   assembled, **Then** they appear after the main instruction in exactly that order, and empty
   fields are left out entirely (no empty headings).
3. **Given** history messages, **When** assembled, **Then** they appear in chronological order
   with their original roles (user or character).
4. **Given** a card with post-history instructions, **When** assembled, **Then** they come after
   the last history message.
5. **Given** text containing `{{char}}`, `{{user}}`, `{{Char}}` or `{{USER}}`, **When** assembled,
   **Then** each is replaced by the character's or user's name. Any other `{{...}}` text is left
   unchanged.
6. **Given** the same inputs twice, **When** assembled, **Then** the output and the trace are
   identical.

---

### User Story 2 - Lore appears when the conversation calls for it (Priority: P1)

Lorebook entries are added to the request only when the recent conversation mentions one of
their keywords, except entries marked always-on (constant), which are always added. Disabled
entries are never added.

**Why this priority**: "The right lore at the right time" is the reason LittleTavern exists.

**Independent Test**: A lorebook with one constant entry, one entry keyed `lighthouse`, one keyed
`harbor` and one disabled entry. The conversation mentions "the old lighthouse". The request
contains the constant and lighthouse entries only.

**Acceptance Scenarios**:

1. **Given** an entry whose keyword appears in one of the most recent messages within the scan
   depth (default: the last 2 messages), **When** assembled, **Then** the entry is included.
2. **Given** an entry whose keyword appears only in older messages beyond the scan depth, **When**
   assembled, **Then** it is not included.
3. **Given** matching, **When** keywords are compared, **Then** they match as case-insensitive
   substrings, which works the same for Chinese, Japanese and Latin text.
4. **Given** a constant entry, **When** assembled, **Then** it is included whether or not any
   keyword matches.
5. **Given** a disabled entry, **When** assembled, **Then** it is never included, even if a
   keyword matches.
6. **Given** several included entries, **When** placed, **Then** entries whose source position is
   "before the character definition" go just before the description, all others go just after
   the scenario. Within each group, entries appear in ascending insertion order.
7. **Given** a keyword written with macros (for example `{{char}}`), **When** matched, **Then** it
   is matched after macro replacement.

---

### User Story 3 - Lore stays within a budget (Priority: P2)

The total size of included lore is limited by a token budget. When too many entries match,
higher-priority entries win, and the rest are left out and recorded as such.

**Why this priority**: Without a limit, a large lorebook can crowd out the conversation or raise
costs. But small test lorebooks work without it, so P1 comes first.

**Independent Test**: With the budget set low enough that only two of three matching entries
fit, the two entries with the highest insertion order are included and the third is recorded as
"left out: budget".

**Acceptance Scenarios**:

1. **Given** matching entries whose total size exceeds the lore budget, **When** assembled,
   **Then** entries are admitted in descending insertion order (ties broken by their order in the
   lorebook) until the next one would exceed the budget. That entry and every later candidate are
   left out with the reason "budget".
2. **Given** constant entries, **When** the budget is applied, **Then** they compete for the
   budget like any other entry.
3. **Given** no budget is configured, **When** assembled, **Then** the default budget applies.

---

### User Story 4 - Every request explains itself (Priority: P1)

Each assembled request comes with a trace: which parts were included and their estimated token
counts, which lorebook entries were included and why, and which were left out and why. The trace
comes out of the same steps that build the request, so it is always accurate.

**Why this priority**: The owner and the tests need to see why the context looks the way it does.
It also powers the demo in 005. Adding it later would mean reworking every step (agreed on
2026-10-19).

**Independent Test**: For the User Story 2 scenario, the trace lists the constant entry
("always on"), the lighthouse entry ("keyword `lighthouse` in message 4"), the harbor entry
("no keyword in the last 2 messages") and the disabled entry ("disabled"), with a token estimate
for every included part.

**Acceptance Scenarios**:

1. **Given** any assembly, **When** it completes, **Then** the trace lists every included part
   (main instruction, each card field, each lore entry, history as one block with its message
   count, post-history instructions) with an estimated token count, plus the estimated total.
2. **Given** an included lore entry, **When** traced, **Then** its reason is either "always on"
   or "keyword `<key>` matched in message <n>", naming the first match found.
3. **Given** a lore entry that was not included, **When** traced, **Then** its reason is one of:
   "disabled", "no keyword in the last <depth> messages", "no keywords defined", or "budget".
4. **Given** a lore entry using a feature this version does not support (secondary keys, regex
   keys, a placement other than before or after the character definition, probability), **When**
   traced, **Then** the trace notes which feature was ignored, so the simplification is visible
   rather than silent.
5. **Given** the trace, **When** read by tests or by 005, **Then** it is structured data, not
   preformatted text.

---

### Edge Cases

- No lorebook at all: the request contains only card parts and history, and the lore section of
  the trace is empty.
- Empty history (first message of a chat): the request still contains the card parts, and the
  scan finds no keywords, so only constant entries apply.
- An entry with no keywords and not constant: never included; the reason is "no keywords
  defined".
- An empty-string keyword is ignored, so it does not match everything.
- The same entry matching several keywords is included once, and the first match is reported.
- Two lorebooks (embedded plus one standalone) contain entries with the same keyword: both
  entries are evaluated independently.
- Very long history: in this version, history is included in full. Trimming to the model's
  context window is not done (see Assumptions).
- A card field consisting only of whitespace is treated as empty.

## Requirements *(mandatory)*

### Functional Requirements

**Inputs and output**

- **FR-001**: The assembly MUST take as input: a character (as imported by 002), zero or more
  lorebooks, the user's display name, the conversation history (ordered messages, each from the
  user or the character), and settings (scan depth and lore budget, with defaults).
- **FR-002**: The assembly MUST produce an ordered list of messages, each with a role
  (instruction, user or character) and text, ready for 004 to send. It MUST also produce the
  trace.
- **FR-003**: The assembly MUST be deterministic: identical inputs give identical outputs and
  traces.

**Structure**

- **FR-004**: The order MUST be:
  1. main instruction;
  2. lore placed "before";
  3. description;
  4. personality;
  5. scenario;
  6. lore placed "after";
  7. example dialogue;
  8. history;
  9. post-history instructions.

  Empty parts are omitted.
- **FR-005**: The main instruction MUST be the card's system prompt if present, otherwise the
  default given in User Story 1. This replaces 001's fixed roleplay prompt when chatting with a
  character.
- **FR-006**: `{{char}}` and `{{user}}` (any letter case) MUST be replaced in every text part and
  in lorebook keywords before matching. Other macros MUST be left unchanged.

**Lore activation**

- **FR-007**: An enabled entry MUST be included when it is constant, or when any of its primary
  keywords occurs as a case-insensitive substring in the most recent N history messages, where N
  is the scan depth (default 2).
- **FR-008**: Disabled entries MUST never be included. Entries without keywords MUST only be
  included when they are constant.
- **FR-009**: Included entries MUST be placed "before" or "after" according to their source
  position, checked in this order:
  1. a numeric position `0` (before) or `1` (after): SillyTavern world info's `position`, or a
     card entry's `extensions.position`;
  2. the card format's `position` of `before_char` or `after_char`;
  3. a missing position means "after", which matches how card lorebooks without a position
     behave in SillyTavern. The local dsh samples have no position.

  Any other numeric position (depth, author's note and so on) MUST be treated as "after", and
  this MUST be noted in the trace.
- **FR-010**: Within each placement group, entries MUST appear in ascending insertion order.

**Budget**

- **FR-011**: The total estimated tokens of included lore MUST NOT exceed the lore budget
  (default: 2,000 tokens). Candidates are admitted in descending insertion order; the first
  candidate that does not fit, and every candidate after it, is left out with reason "budget".

**Trace**

- **FR-012**: The trace MUST record:
  - every included part, with its source and estimated tokens;
  - every lorebook entry considered, with its lorebook, its entry name, whether it was
    included, and the reason;
  - notes on ignored, unsupported entry features;
  - the estimated total.
- **FR-013**: The trace MUST be produced by the same steps that make each decision, not
  reconstructed afterwards.
- **FR-014**: Token counts MUST be estimates, labelled as such in the trace, and MUST not badly
  undercount Chinese or Japanese text: each CJK character counts as at least one token.

### Key Entities

- **Assembly input**: character, lorebooks, user name, history, settings.
- **History message**: role (user or character) and text, in chronological order.
- **Assembled message**: role (instruction, user or character) and text.
- **Trace**: included parts (source, tokens), lore decisions (lorebook, entry, included, reason,
  matched keyword and message when relevant), notes, and total estimated tokens.
- **Settings**: scan depth (default 2) and lore budget in tokens (default 2,000).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For every acceptance scenario above, an automated test checks both the assembled
  messages and the trace.
- **SC-002**: Every lorebook entry considered in an assembly appears in the trace exactly once,
  with a reason: 100% of decisions are explained.
- **SC-003**: Assembling the same inputs twice produces identical results.
- **SC-004**: With each real sample card from `../test-cards/` (when present) and a short
  scripted conversation, assembly succeeds and the trace accounts for every entry of the card's
  lorebook.
- **SC-005**: The owner can tell from the trace alone, without reading the assembled text, why
  any given entry did or did not appear.

## Acceptance Testing

Per the constitution's testing policy:

- **Automated**: unit tests for each acceptance scenario (fixtures built in code), asserting on
  structured trace data rather than on large text snapshots wherever possible. Add a
  determinism test.
- **Automated, local only**: if `../test-cards/` exists, assemble with each sample card and check
  that every lorebook entry appears in the trace (SC-004).
- **Manual**: none in this feature (no UI). The owner sees it through 004 and 005.
- **Deferred**: any test judged too complex during planning is listed in the plan instead.

## Assumptions

- **Simple first version.** The following SillyTavern behaviours are deliberately **not**
  implemented and are only noted in the trace when an entry relies on them:
  - secondary keys and their logic;
  - regex keys;
  - whole-word matching;
  - per-entry case sensitivity;
  - recursion;
  - probability;
  - groups;
  - sticky, cooldown and delay;
  - placement at depth or in the author's note;
  - per-entry scan depth.
- History is included in full. Trimming history to the model's context window and summarising
  old messages are later work. Current models have large context windows, and v1 sessions are
  short.
- The user's display name defaults to "User". Changing it (personas) is outside this feature.
- Which standalone lorebooks accompany a character is decided by 004; this feature takes whatever
  lorebooks it is given.
- The first message (greeting) of a chat is part of the history supplied by 004.
- Example dialogue is included as one instruction block, unchanged except for macro replacement.
- Roles: "instruction" parts become system-level instructions when 004 sends them. How exactly
  they map onto the provider's message roles is decided in the plan.
