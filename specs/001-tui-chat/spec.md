# Feature Specification: TUI Chat Skeleton

**Feature Branch**: `001-tui-chat`

**Created**: 2026-10-19

**Status**: Draft

**Input**: User description: "001-tui-chat: A terminal UI for LittleTavern, built on pi-tui, that a
user can launch, see the product title, enter an OpenRouter API key (env var OPENROUTER_API_KEY
takes precedence; when entered in the TUI, the user is explicitly told the key will be saved to a
named path with 0600 permissions and chooses whether to save it; secrets are redacted from logs),
pick a model limited to the OpenAI and Gemini families on OpenRouter, and have a plain streaming
chat with the LLM. Every request records token usage and cost into a usage ledger (one record per
request: time, session, model, input/output/cache/reasoning tokens, cost, duration) as the basis of
a future monitoring system, and the status bar shows the running session totals. No character
cards, lorebooks or prompt assembly yet: those are later features (002 card import, 003 prompt
assembly, 004 character chat). Purpose: a walking skeleton so the owner can immediately verify LLM
connectivity and basic TUI behaviour."

## Context

This is the first feature of LittleTavern v1 and the base the later features build on: 002 (card
import), 003 (prompt assembly) and 004 (character chat). It deliberately contains no roleplay
content. Its job is to prove, end to end, that the application starts, holds a credential safely,
talks to a language model, and accounts for every request it makes.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Launch and chat with a model (Priority: P1)

The owner already has an OpenRouter key in the `OPENROUTER_API_KEY` environment variable. They
launch LittleTavern, see the product title, type a message and watch the model's reply appear
progressively as it is generated. They can keep the conversation going for several turns, and can
interrupt a reply that is taking too long.

**Why this priority**: This is the whole point of the walking skeleton: verifying that the
application can reach a model and display a streamed reply. Every later feature depends on it.

**Independent Test**: With the environment variable set, launch the app, send "Say hello in five
words", and confirm a reply streams in and the conversation can continue for a second turn.

**Acceptance Scenarios**:

1. **Given** the environment variable holds a valid key, **When** the user launches the app,
   **Then** the screen shows the product name "LittleTavern" with its version, the active model,
   and an input area ready for typing, without asking for a key.
2. **Given** the app is ready, **When** the user submits a message, **Then** the message appears in
   the transcript and the model's reply appears incrementally as it is generated.
3. **Given** a previous exchange, **When** the user sends a follow-up, **Then** the model receives
   the earlier turns of this conversation as context (it can refer back to them).
4. **Given** a reply is still being generated, **When** the user presses Esc, **Then** generation
   stops, the partial reply stays visible and is marked as interrupted, and the user can type
   again.
5. **Given** an empty or whitespace-only input, **When** the user submits it, **Then** nothing is
   sent.

---

### User Story 2 - Enter a key inside the app (Priority: P1)

A user without the environment variable launches the app. Instead of failing, the app asks for an
OpenRouter key. The input is masked. Before anything is written to disk, the app states the exact
file path where the key would be saved and that only the user's account can read it, and lets the
user choose between saving it and using it for this session only.

**Why this priority**: Without a key nothing works. The owner wants to test the product the way a
normal user would, without editing shell configuration.

**Independent Test**: Unset the environment variable and ensure no saved key exists; launch the
app, enter a key, choose "save"; quit; relaunch and confirm the app goes straight to chat; then
remove the saved key and confirm the app asks again.

**Acceptance Scenarios**:

1. **Given** no environment variable and no saved key, **When** the app launches, **Then** it shows
   a key prompt explaining what key is needed and where to obtain one, and does not allow chatting
   until a key is provided.
2. **Given** the key prompt, **When** the user types, **Then** the characters are masked on screen.
   If the user submits an empty or whitespace-only key, it is rejected with a message and the
   prompt stays open; an environment variable that is set but empty counts as "no key".
3. **Given** a key has been typed, **When** the user confirms, **Then** the app shows the full path
   of the file it would save to and that the file is readable only by the current user, and offers
   "save" and "this session only".
4. **Given** the user chose "save", **When** the key is stored, **Then** the file exists at the
   stated path with owner-only read/write permissions, and the next launch uses it without
   prompting.
5. **Given** the user chose "this session only", **When** the app exits, **Then** nothing was
   written to disk and the next launch prompts again.
6. **Given** both the environment variable and a saved key exist, **When** the app launches,
   **Then** the environment variable is used, and the app indicates which source the active key
   came from.
7. **Given** the provider rejects the key as invalid, **When** the user sends a message, **Then**
   the app says the key was rejected and lets the user enter a different one, without crashing or
   losing the transcript.
8. **Given** a saved key exists, **When** the user runs the command to forget it, **Then** the saved
   file no longer contains the key and the app asks for a key before the next request.

---

### User Story 3 - See what every request costs (Priority: P2)

While chatting, the status bar shows how many tokens this session has used and what it has cost so
far. Every request is also recorded in a usage ledger on disk, one record per request, so that a
future monitoring feature can analyse spending over time.

**Why this priority**: Token and cost tracking is a hard requirement for v1 and the seed of a
monitoring system, but chatting must work first.

**Independent Test**: Send three messages, then compare the status bar totals with the three new
ledger records; the totals must equal the sum of the records.

**Acceptance Scenarios**:

1. **Given** a completed reply, **When** it finishes, **Then** exactly one ledger record is appended
   containing: timestamp, session identifier, model, input tokens, output tokens, cache-read
   tokens, cache-write tokens, reasoning tokens when reported, cost, duration, and outcome.
2. **Given** several replies in one session, **When** the user looks at the status bar, **Then** it
   shows the session's cumulative tokens and cost, equal to the sum of that session's ledger
   records.
3. **Given** a reply interrupted with Esc or ended by an error, **When** the request ends, **Then** a
   ledger record is still written with its outcome ("interrupted" or "error") and whatever usage
   the provider reported; usage the provider never reported is recorded as unknown, not as zero.
4. **Given** the provider reports no price for the model, **When** the record is written, **Then**
   the cost is recorded as unknown rather than zero, and the status bar marks the total as
   incomplete.
5. **Given** any ledger record or log line, **When** it is inspected, **Then** it never contains the
   API key.

---

### User Story 4 - Choose the model (Priority: P2)

The user opens a model picker and chooses a model. Only models from the OpenAI and Google Gemini
families offered through OpenRouter are listed. The chosen model is shown in the status bar and is
remembered for the next launch.

**Why this priority**: A sensible default model is enough to verify connectivity, but the owner
needs to compare models and costs soon after.

**Independent Test**: Open the picker, confirm every entry belongs to the OpenAI or Gemini family,
choose a different model, send a message, and confirm the ledger record names the new model;
relaunch and confirm the choice persisted.

**Acceptance Scenarios**:

1. **Given** the picker is open, **When** the user browses it, **Then** only OpenAI-family and
   Gemini-family chat models are listed, each with its price where known.
2. **Given** a long list, **When** the user types part of a name, **Then** the list narrows to
   matching models.
3. **Given** the user selects a model, **When** the picker closes, **Then** the status bar shows
   the model and subsequent requests use it.
4. **Given** a model was selected previously, **When** the app is relaunched, **Then** that model
   is active.
5. **Given** a first launch with no previous choice, **When** the app starts, **Then** a documented
   default model from the allowed families is active.

---

### Edge Cases

- Network unavailable or provider timeout: the request ends with a readable error in the
  transcript, a ledger record with outcome "error" is written, and the app stays usable.
- Rate limit or insufficient credit reported by the provider: shown as a readable message that
  names the cause; the user can retry.
- The remembered model is no longer offered: the app falls back to the default model and says so.
- The saved key file exists but cannot be read or is malformed: the app says so and prompts for a
  key; it does not silently ignore the file.
- The saved key file has permissions wider than owner-only: the app warns the user.
- The terminal is resized during a reply: layout reflows without losing text.
- Replies containing CJK text or emoji: rendered with correct column widths.
- The model returns reasoning content: it is not shown in the transcript in this feature, but its
  tokens are counted in the ledger.
- The user quits while a reply is streaming: generation is stopped and the request is recorded as
  interrupted before exit.

## Requirements *(mandatory)*

### Functional Requirements

**Application shell**

- **FR-001**: The application MUST start in a full-screen terminal interface showing the product
  name "LittleTavern", its version, a transcript area, an input area and a one-line status bar.
- **FR-002**: The status bar MUST show the active model, the source of the active key
  (environment, saved or session), and the session's cumulative tokens and cost.
- **FR-003**: Users MUST be able to quit with a documented command and key binding, and the
  terminal MUST be restored to its normal state on exit, including on errors.
- **FR-004**: The application MUST show a short in-app help listing the available commands.

**Credentials**

- **FR-005**: The application MUST use the `OPENROUTER_API_KEY` environment variable when it is
  set and non-empty, ahead of any saved key.
- **FR-006**: When no key is available, the application MUST prompt for one with masked input and
  MUST NOT send any chat request until a key is provided.
- **FR-007**: Before writing a key to disk, the application MUST display the full destination path
  and that the file is readable only by the current user, and MUST offer both "save" and "this
  session only". Nothing is written unless the user chooses "save".
- **FR-008**: A saved key MUST be stored in a file created with owner-only read/write permissions
  inside a LittleTavern-specific directory that is not shared with any other application.
- **FR-009**: Users MUST be able to replace the active key and to forget the saved key from inside
  the application.
- **FR-010**: The key MUST never be displayed in full after entry (at most its last four
  characters), and MUST never appear in logs, the ledger, error messages or the transcript.

**Chat**

- **FR-011**: Users MUST be able to send a message and see the reply rendered incrementally as it
  streams.
- **FR-012**: Each request MUST include the conversation so far in this session, preceded by a
  fixed default system prompt: "You are a roleplay assistant. Stay in character, write vivid
  in-world prose, keep replies to a few paragraphs, and follow the user's lead." Feature 004
  replaces it with prompts assembled from character cards.
- **FR-013**: Users MUST be able to interrupt generation with Esc; the partial reply MUST remain
  visible and be marked as interrupted.
- **FR-014**: Provider errors (invalid key, rate limit, insufficient credit, network failure,
  unavailable model) MUST be shown as readable messages that name the cause, and the application
  MUST remain usable afterwards.
- **FR-015**: The conversation lives only for the current run; persisting conversations is out of
  scope for this feature.

**Model selection**

- **FR-016**: The only provider in this feature is OpenRouter.
- **FR-017**: The model picker MUST list only chat models from the OpenAI and Google Gemini
  families available through OpenRouter, with their prices where known, and MUST support
  narrowing the list by typing.
- **FR-018**: The selected model MUST be remembered across launches. A documented default from the
  allowed families MUST be used when there is no valid remembered choice.

**Usage ledger**

- **FR-019**: Every request that reaches the provider MUST append exactly one record to a usage
  ledger file, whatever its outcome.
- **FR-020**: Each record MUST contain: timestamp, session identifier, provider, model, input
  tokens, output tokens, cache-read tokens, cache-write tokens, reasoning tokens (when reported),
  total cost and its breakdown, duration, and outcome (completed, interrupted or error).
- **FR-021**: Values the provider did not report MUST be recorded as unknown, never as zero.
- **FR-022**: The ledger MUST be append-only, one self-contained record per line, readable by
  other tools without the application running, and kept across launches.
- **FR-023**: The status bar totals MUST equal the sum of the current session's ledger records,
  and MUST be marked incomplete when any record has an unknown cost.

**Logging**

- **FR-024**: Diagnostic logs MUST go to a file, never to the terminal the interface is drawn on,
  and MUST redact secrets.

### Key Entities

- **Credential**: the OpenRouter API key in use. Attributes: source (environment, saved, session),
  masked display form. Never persisted except through an explicit "save".
- **Model choice**: the selected model identifier and its family; persisted as a preference.
- **Conversation**: the ordered user and model messages of the current run, held in memory.
- **Usage record**: one entry per provider request, with the fields listed in FR-020. Belongs to a
  session.
- **Session**: one run of the application, identified so that its usage records can be grouped
  and totalled.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Starting with no key configured, a user can go from launching the app to reading the
  first streamed reply in under 2 minutes, without editing any file or environment variable.
- **SC-002**: The first part of a reply becomes visible as soon as the provider starts sending it;
  the user never waits for the full reply before seeing text.
- **SC-003**: 100% of requests that reach the provider produce exactly one ledger record,
  including interrupted and failed ones.
- **SC-004**: Status bar totals match the sum of the session's ledger records exactly, in every
  tested scenario.
- **SC-005**: An automated scan of logs, ledger and saved-state files after a test run finds the
  API key zero times outside the deliberately saved key file.
- **SC-006**: 100% of models offered in the picker belong to the OpenAI or Gemini families.
- **SC-007**: The automated tests listed under "Acceptance Testing" pass. The owner confirms the
  remaining scenarios (look and feel, real provider) in one manual session.

## Acceptance Testing

Per the constitution's testing policy: lightweight, own code only, and nothing pi already tests.

**Automated (must pass every night run):**

- Happy path, end-to-end against the simulated model: the app starts and shows the product title,
  takes a key, sends a message and shows the reply.
- Edge cases: no key, empty or whitespace key (typed or from an empty environment variable), key
  rejected by the provider, environment variable taking precedence over a saved key.
- Unit tests for our own functions, in particular the usage ledger: totals equal the sum of
  records, unknown values are not recorded as zero, interrupted and failed requests are recorded,
  and the key never appears in a ledger record or log line.

**Opt-in:** one real-provider check that runs only when `OPENROUTER_API_KEY` is set: it sends one
short message to an inexpensive allowed model and confirms a reply and a ledger record.

**Manual (owner):** layout and rendering, masking, resizing, CJK text, model picker feel,
terminal restored on exit.

**Deferred:** any test judged too complex during planning is listed in the plan as deferred
instead of being written.

## Assumptions

- The only user is the owner on a single machine; there are no accounts or multi-user concerns.
- OpenRouter is the only provider for now; direct OpenAI or Google access is out of scope.
- "OpenAI family" and "Gemini family" mean the models OpenRouter lists under those vendors;
  image-only and batch-only variants are excluded because this is a text chat.
- Prices come from the model catalogue available to the application; when a model has no known
  price, cost is unknown (see FR-021) rather than estimated.
- A saved key in a user-only file is acceptable because the user is told the path and chooses to
  save it; this satisfies the constitution's "never silently into plaintext" rule. OS keychain
  storage is out of scope.
- Reasoning text is not displayed in this feature; how to show it is decided by a later feature.
- Conversations are not saved; session persistence arrives with 004 (character chat).
- The ledger is kept indefinitely; rotation and analysis tooling belong to a future monitoring
  feature.
- Automated acceptance uses a simulated model so that tests need no network and no real key.
- For local development the owner keeps the key in a git-ignored `.env` file at the repository
  root; only the development launch reads it, and tests never do.
- Out of scope: character cards, lorebooks, prompt assembly, regenerate and swipes, saved
  sessions, multiple providers, themes and configurable key bindings.
