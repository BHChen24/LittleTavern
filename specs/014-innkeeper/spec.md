# Feature Specification: The Innkeeper

**Feature Branch**: `014-innkeeper` (from `main` at 15a64b5, merged through a pull request;
constitution 3.2.0)

**Created**: 2026-10-20

**Status**: Draft

**Input**: The owner's idea from 2026-10-20: turn the plain chat (now `/innkeeper`) into an
in-app guide that explains how to use LittleTavern, looks things up, and takes care of the
settings that are hard to change by hand. Scope decisions were made the same day, before 010,
and completed after the 0.1.1 release.

## Context

`/innkeeper` is the plain chat from 001, renamed in 009. It sends the player's text to the model
with a generic roleplay prompt and keeps the conversation in memory. It has no tools and knows
nothing about the app. Leaving it and coming back clears the screen but not the conversation
the model sees.

Some settings exist only in `settings.json`:
- the reply cap, the spend cap and the sampling parameters (012);
- the player's name after the first start;
- the lore settings;
- `mouse`.

Changing them means finding and editing a JSON file, and for some of them restarting. The model,
the persona and lorebook attachments have commands (`/model`, `/persona`, `/lorebooks`).

Users pay for every request with their own key. A tool-using assistant makes several requests
per message, so it needs a cap on rounds, and its usage must count every request.

## Clarifications

### Session 2026-10-20 (before 010)

- Q: Is the innkeeper separate from character chats? → A: Yes. It has its own conversation and
  its own set of allowed tools, and never shares state with a character chat.
- Q: Where does its conversation live? → A: In memory only, for this run. It is lost on quit.
  It has no long-term memory; it reads settings fresh through its tools.
- Q: Who is it? → A: A tavern keeper. It speaks in character, but every fact about the app or
  the player's setup must come from a tool result, not from its own guesses.
- Q: What about requests it cannot do? → A: It says so in character and names the command that
  does it.
- Q: Does a change need the player's approval? → A: Yes, every time. There is no auto-approve
  mode.

### Session 2026-10-20 (after 0.1.1)

- Q: Which tools does it have? → A: Reading the settings (never the API key), listing characters
  and personas, the app's help, opening a character chat, and changing settings.
- Q: Which settings can it change? → A: Only the hard ones, the settings that have no command
  and can only be changed by editing `settings.json`:
  - `limits` (reply cap, spend cap, tool rounds);
  - `generation` (temperature, top P, top K, min P, repetition penalty);
  - the player's name (`userName`; it is asked only on the first start);
  - the lore settings (`loreBudget`, `scanDepth`, `replyReserve`);
  - `mouse`.

  The model, the persona and lorebook attachments have commands, so the innkeeper teaches the
  player which command to use instead of changing them. The owner's words: give the hard things
  to the innkeeper; for the button-clicking things, the innkeeper teaches the player how.
- Q: Is anything backed up? → A: Yes. Before every change, the current `settings.json` is
  backed up (owner).
- Q: When does a change apply? → A: Immediately: the next request uses the new values. The
  exception is `mouse`, which the terminal sets up at start, so it applies after a restart, and
  the innkeeper says so. Editing `settings.json` by hand still needs a restart for the limits
  and `generation`.
- Q: What does opening a chat do? → A: Either a new chat with a character (from the greeting,
  like `/characters`) or the most recent saved chat with that character. The model picks from
  the player's words; the confirmation says which.
- Q: How many tool rounds per message? → A: A new setting, `limits.toolRounds`, default 5. When
  it is reached, the innkeeper stops and the app says why.
- Q: Are tool calls visible? → A: Yes: one muted line per tool call in the transcript.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ask the innkeeper how things work (Priority: P1)

A new player types `/innkeeper` and asks "how do I add my own character?" or "what can I
change?". The innkeeper looks it up and answers in character, naming the commands and folders.

**Why this priority**: it is the feature's purpose, and it needs no changes to anything.

**Independent Test**: with the simulated provider calling the help tool and then answering, the
transcript shows a muted line for the lookup and the answer, and the answer request contained the
help text.

**Acceptance Scenarios**:

1. **Given** the innkeeper, **When** the player asks how to use a feature, **Then** the innkeeper
   looks up the help and answers with the relevant commands; the transcript shows one muted line
   for the lookup.
2. **Given** the innkeeper, **When** the player asks about their setup ("which model am I
   using?", "what characters do I have?"), **Then** it reads the settings or lists the
   characters or personas and answers from the result.
3. **Given** a request to change the model, the persona or a lorebook, **When** the innkeeper
   answers, **Then** it changes nothing and names the command (`/model`, `/persona`,
   `/lorebooks`).
4. **Given** a request for the API key, **When** the innkeeper answers, **Then** it cannot see
   or change the key and points to `/apikey`.
5. **Given** the player writes in another language, **When** the innkeeper answers, **Then** it
   answers in that language.

---

### User Story 2 - Let the innkeeper change the hard settings (Priority: P1)

The player says "replies are too long, cap them at 1000 tokens" or "make it more creative". The
innkeeper proposes the change; the app shows the old and new values and asks; the player agrees;
the settings file is backed up and changed, and the next request uses the new values.

**Why this priority**: these settings exist only in a JSON file today.

**Independent Test**: with the simulated provider calling the change tool, the confirmation shows
the old and new values; Yes writes the file, creates a backup and changes the next request's
options; No changes nothing.

**Acceptance Scenarios**:

1. **Given** a change request, **When** the innkeeper calls the change tool, **Then** the app
   asks Yes or No, listing each setting with its old and new value.
2. **Given** the question, **When** the player chooses Yes, **Then** the current settings file is
   backed up, the new values are saved, the transcript shows a muted line naming the change and
   the backup, and the next request uses the new values without a restart.
3. **Given** the question, **When** the player chooses No or presses Esc, **Then** nothing is
   written, and the innkeeper is told the player declined.
4. **Given** a value outside the allowed range (FR-005), **When** the tool is called, **Then**
   nothing is asked or written, and the innkeeper is told the rule.
5. **Given** a request to stop sending a sampling parameter, or to reset a lore setting, **When**
   it is confirmed, **Then** that value is removed from the settings, and the default applies
   again.
6. **Given** the spend cap is changed, **When** it is saved, **Then** this run's spending limit
   uses the new cap from then on.
7. **Given** a change to `mouse`, **When** it is confirmed, **Then** it is saved, and the app and
   the innkeeper say it applies after a restart.
8. **Given** a new player name, **When** it is confirmed, **Then** characters use it from the next
   request, unless a persona is active, whose name takes precedence (012).

---

### User Story 3 - Open a chat from the innkeeper (Priority: P2)

The player says "I'd like to talk to Alice" or "let's continue my last chat with Alice". The
innkeeper offers it; the app asks; on Yes, the chat opens.

**Why this priority**: it connects the guide to the main feature, but `/characters` and
`/sessions` already do it.

**Independent Test**: with the simulated provider calling the open tool for a new chat and for a
resumed chat, Yes opens the right chat and No keeps the innkeeper.

**Acceptance Scenarios**:

1. **Given** a request for a new chat, **When** the tool is called with a character in the
   library, **Then** the app asks `Start a new chat with <name>?`; Yes opens a new chat from the
   greeting, as `/characters` does.
2. **Given** a request to continue, **When** the tool is called and a saved chat with that
   character exists, **Then** the app asks to continue the most recent one; Yes resumes it, as
   `/sessions` does.
3. **Given** no saved chat for that character, **When** the continue tool is called, **Then**
   nothing is asked, and the innkeeper is told there is none, so it can offer a new chat.
4. **Given** a name that matches no character, or several, **When** the tool is called, **Then**
   nothing is asked, and the innkeeper is told which names exist or which ones match.
5. **Given** No, **When** the player declines, **Then** the innkeeper stays, and it is told the
   player declined.
6. **Given** a chat was opened, **When** the player enters `/innkeeper` again, **Then** the
   earlier innkeeper conversation is shown and continues.

---

### User Story 4 - The innkeeper cannot run away with money (Priority: P1)

Every innkeeper message can make several requests. They are capped, counted and shown.

**Why this priority**: it protects the player's money with their own key.

**Independent Test**: with the simulated provider calling tools in a loop, the turn stops after
`limits.toolRounds` rounds with a notice; the run's spend includes every request of the turn.

**Acceptance Scenarios**:

1. **Given** the innkeeper keeps calling tools, **When** the number of tool rounds for one
   message reaches `limits.toolRounds`, **Then** it stops, and the app says it stopped at the
   limit and where to change it.
2. **Given** a turn with tool calls, **When** it ends, **Then** the usage of every request in the
   turn counts toward the status bar, the run's spend and the usage ledger.
3. **Given** the run's spend has reached its cap, **When** the player sends to the innkeeper,
   **Then** the 012 Continue or Stop question appears first.
4. **Given** a provider failure during a turn, **When** it happens, **Then** the 012 innkeeper
   failure notice appears.

---

### Edge Cases

- No key or no model: the existing setup notice, as for any chat.
- A tool call with invalid arguments: the innkeeper is told what was wrong; nothing changes.
- Several settings in one request: one question lists all of them; one backup is made.
- A setting changed by hand while the app runs, then by the innkeeper: the innkeeper's change
  reads the file at that moment, so the other hand edits are kept. They still only apply after a
  restart.
- A settings file that exists but is not valid JSON, or cannot be written: nothing changes, and
  the innkeeper is told the error. The file is never replaced by one built from defaults.
- Esc while the innkeeper is replying stops it, as today. Esc while the question is open counts
  as No.
- Opening a chat ends the innkeeper's turn; it makes no further requests for that message.
- `/new` in the innkeeper clears its conversation (011).
- Leaving the innkeeper and coming back shows the conversation so far, including the muted tool
  lines.
- The innkeeper's tools never return the API key or the credentials file, whatever is asked.
- A tool-round limit set to an invalid value in `settings.json`: it falls back to 5 with the 012
  startup warning.
- Character chats are unchanged: they have no tools.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The innkeeper MUST keep its own conversation for this run, separate from character
  chats, and lose it on quit. Returning to it with `/innkeeper` MUST show the conversation so
  far; `/new` MUST clear it.
- **FR-002**: The innkeeper MUST play a tavern keeper, answer in the player's language, and state
  facts about the app or the setup only from tool results.
- **FR-003**: Its read-only tools MUST be: the settings without secrets, the characters in the
  library, the personas, and the app's help (commands, key bindings, import folders and the
  settings file's location).
- **FR-004**: It MUST NOT be able to read or change the API key or the credentials.
- **FR-005**: Its change tool MUST accept only these settings, with these rules:
  - `limits.replyTokens` (whole number ≥ 0), `limits.runSpendUsd` (number ≥ 0) and
    `limits.toolRounds` (whole number ≥ 1);
  - `generation.temperature` (0–2), `topP` (0–1), `topK` (whole number ≥ 1), `minP` (0–1) and
    `repetitionPenalty` (> 0), as in 012;
  - `userName` (not blank after control characters are removed);
  - `loreBudget` (number > 0), `scanDepth` (whole number ≥ 0) and `replyReserve` (number ≥ 0),
    as `readSettings` accepts them today;
  - `mouse` (true or false).

  A `generation` value or a lore setting MAY be removed, which restores its default.
- **FR-006**: Every change MUST be confirmed by the player with Yes or No, showing each old and
  new value. No or Esc MUST write nothing.
- **FR-007**: Before writing, the app MUST back up the current settings file. Backups MUST NOT be
  overwritten by later backups.
- **FR-008**: A confirmed change MUST apply from the next request, without a restart, for
  character chats and the innkeeper alike. `mouse` is the exception: it is saved, and the app
  says it applies after a restart.
- **FR-009**: The open tool MUST start a new chat or resume the most recent saved chat with a
  named character, after the player confirms. It MUST report unknown or ambiguous names and the
  absence of a saved chat without asking.
- **FR-010**: For requests about the model, the persona or lorebooks, the innkeeper MUST name
  the command instead of changing them. It has no tool for them.
- **FR-011**: The tool rounds for one player message MUST stop at `limits.toolRounds` (default 5),
  with a notice naming the limit and the settings file.
- **FR-012**: The usage of every request in an innkeeper turn MUST count toward the status bar,
  the run's spend and the usage ledger.
- **FR-013**: Each tool call MUST show one muted line in the transcript.
- **FR-014**: Help and the README MUST describe what the innkeeper can do, the confirmation, the
  backups and `limits.toolRounds`.

### Key Entities

- **Innkeeper conversation**: messages, tool calls and tool results, in memory for this run.
- **Tool**: a named capability with checked arguments. Read-only tools run directly; the change
  and open tools ask first.
- **Settings change**: a list of (setting, old value, new value), confirmed as a whole.
- **Settings backup**: a copy of the settings file taken before a change, kept next to it.
- **Tool rounds limit** (settings, `limits.toolRounds`): default 5.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new player can find out how to import their own character by asking the
  innkeeper one question, without opening the README.
- **SC-002**: A player can change the reply cap, the temperature or their name through the
  innkeeper in one exchange plus one confirmation, without editing a file or restarting.
- **SC-003**: No settings change happens without the player's Yes, and every change leaves a
  backup of the previous settings.
- **SC-004**: One innkeeper message never makes more than `limits.toolRounds` rounds of tool
  calls, and its full cost appears in the run's spend.
- **SC-005**: The API key never appears in any innkeeper tool result.

## Acceptance Testing

- Unit tests:
  - each tool with temporary homes (results, errors, no secrets);
  - the change tool's validation, backup, nested merge and removal;
  - the round limit;
  - summed usage.
- App tests with the simulated provider calling tools:
  - the muted lines;
  - the confirmation (Yes, No, Esc) and its old and new values;
  - a change applied to the next request without a restart;
  - opening a new or a resumed chat;
  - unknown or ambiguous names;
  - the round-limit notice;
  - returning to the innkeeper;
  - `/new`.
- Happy path:
  1. ask how to import a character (help lookup);
  2. ask to cap replies at 1000 tokens, and confirm;
  3. check the backup and that the next request asks for 1000 tokens;
  4. ask to talk to Alice, and confirm;
  5. the chat opens.
- Owner, manually: a real model's tool use, the tone, and the look of the lines and the question.

## Assumptions

- Every model the app allows can call tools (pi's OpenRouter catalog lists only models that
  support tools; the plan cites it).
- The innkeeper uses the currently selected model.
- The help text the innkeeper reads is built into the app (commands, key bindings, folders,
  settings file). It does not read the README file.
- The innkeeper's prompt is written in English, like all repository text. It answers in the
  player's language because the prompt tells it to.
- Out of scope: changing the model, the persona or lorebook attachments through the innkeeper;
  long-term memory; `/trace` for the innkeeper; an auto-approve mode; restoring a backup through
  the innkeeper (the player can copy the file back).
