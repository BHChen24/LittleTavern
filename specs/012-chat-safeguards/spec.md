# Feature Specification: Chat Safeguards

**Feature Branch**: `012-chat-safeguards` (from `main`, merged through a pull request; constitution
3.2.0)

**Created**: 2026-10-20

**Status**: Draft. The plan and tasks are written after 011 is merged, because both features edit
`app.ts`.

**Input**: Owner feedback after installing 0.1.0 on macOS, and the follow-up discussion on
2026-10-20:

1. A reply can fail in the middle ("Provider finish_reason: error"). The user needs a way to deal
   with errors: details belong in the log, and the screen should say that the reply can be
   retried, where the log is, and how many retries were made. Most users will not read the
   details; an AI reading the log will.
2. After `/regenerate`, the user wants `/prev` to bring back the previous reply. It only keeps the
   previous reply: `/prev` swaps it in, and a second `/prev` swaps back.
3. Without a persona, `{{user}}` becomes "User", and characters say "User" to the player.
4. Simple token and spend protection, mentioned once on the home screen next to the API-key hint,
   and gone once a chat starts.
5. Users cannot change model parameters (temperature and the other sampling settings). The owner
   chose the simplest option first: settings in `settings.json`.

## Context

Users pay for every request with their own OpenRouter key. Today:

- there is no automatic retry;
- there is no cap on reply length;
- there is no cap on spending; the status bar only shows the running cost.

When a reply fails, the user sees a raw provider message and a cut-off reply. That reply is not
saved and is not sent with later requests, but nothing on screen says so.

`/regenerate` replaces the last reply. Its previous text is kept in the session file, but the
user cannot get back to it.

The name used for the player defaults to "User" unless a persona is active.

## Clarifications

### Session 2026-10-20

- Q: Is there automatic retrying? → A: No, not for now. Retrying stays manual (`/regenerate` or
  Ctrl+R).
- Q: What does the error notice show? → A: A short message: that the reply failed, that it can be
  retried with Ctrl+R or `/regenerate`, the retry count, and the log file's location. Technical
  details go to the log only. Where a retry cannot help (rejected key, no credit, model
  unavailable), the notice names the fix instead (`/apikey`, adding credit, `/model`).
- Q: What does "retry count" mean? → A: How many times the user has retried the same failed
  message by hand. It resets when a reply succeeds or a new message is sent.
- Q: How does `/prev` work? → A: It keeps only the reply that the latest regenerate replaced.
  `/prev` swaps that reply back in as the current reply; `/prev` again swaps back. The previous
  reply is kept for this run only: sending a new message, regenerating again, switching chats or
  quitting discards it. Whichever reply is showing is the one in the chat history and in the next
  request.
- Q: What is the player called without a persona? → A: The app asks for a name once, on the first
  start where none is set, with "Traveler" filled in. Enter accepts it. The name is used whenever
  no persona is active; a persona's name still takes precedence. A second-person word such as
  "You" is not used, because cards write `{{user}}` in the third person.
- Q: What do the spend limits cover? → A: Two limits:
  - a cap on each reply's length: **4096 output tokens** by default, enough for thinking models
    whose reasoning also counts as output;
  - a cap on what this run of the app spends: **1 USD** by default.
- Q: What happens when the run's spend reaches its cap? → A: Sending pauses. The app asks whether
  to continue: continuing allows one more cap's worth for this run; declining sends nothing.
- Q: How are the limits changed? → A: By editing `settings.json`. There is no command. The
  reminder says where the file is.
- Q: How do users change model parameters? → A: In a `generation` section of `settings.json`
  (owner, 2026-10-20): `temperature`, `topP`, `topK`, `minP` and `repetitionPenalty`. A parameter
  that is not set is not sent, so the model's own default applies. There is no command; presets
  or a picker may come later. `/trace` shows the parameters that were sent with the last request.
  Reasoning or thinking strength is not included in this feature.
- Q: Where is the reminder? → A: On the home screen and in the setup notice before the first
  chat, next to the API-key hint. Once a chat (character or innkeeper) has started in this run,
  it is no longer shown.

### Plan-time corrections (2026-10-20)

Recorded while planning; they follow from facts in `research.md`.

- The innkeeper has no `/regenerate` or Ctrl+R, so its failure notice says to send the message
  again and has no retry count (research R5). It is redesigned in 013.
- "Prices unknown" (FR-008) means the current model has no known price. The status bar's
  "incomplete" mark is not used for this, because errors also set it (research R3).
- The fallback name for `{{user}}` becomes "Traveler" everywhere, so Esc on the name prompt
  needs no extra state (research R8).
- `/prev` appends a copy of the restored reply to the session file, because pi only moves its
  branch pointer in memory and a reload takes the last entry (research R6).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A failed reply explains what to do (Priority: P1)

A reply stops halfway with a provider error. The user sees what came through, marked as
incomplete and not saved, and a short notice that suggests Ctrl+R, counts the retries and names
the log file.

**Why this priority**: today the notice is raw provider text and the cut-off reply looks like a
normal one, though it is not part of the chat.

**Independent Test**: with the simulated provider failing in the middle of a reply, the
transcript shows the partial text marked incomplete, the notice shows the retry hint, `retry 0`
and the log path, and the log has the provider's message. A retry that fails again shows
`retry 1`. A retry that succeeds replaces the partial text, and the count is gone.

**Acceptance Scenarios**:

1. **Given** a reply that fails after some text arrived, **When** the error comes, **Then** the
   partial text stays visible, marked `(incomplete, not saved)`, and the notice reads like the
   contract: the reply failed, Ctrl+R or `/regenerate` retries it, the retry count, and the log
   path.
2. **Given** a reply that fails before any text arrived, **When** the error comes, **Then** the
   same notice appears with no partial text.
3. **Given** the notice, **When** the user presses Ctrl+R, **Then** the same message is sent
   again without the partial text, and a further failure shows the count increased by one.
4. **Given** a failure, **When** a retry succeeds, **Then** the partial text is replaced by the
   new reply, which is saved, and the next failure starts counting from zero again.
5. **Given** a failure whose cause is a rejected key, missing credit or an unavailable model,
   **When** the notice appears, **Then** it names the fix (`/apikey`, adding credit on
   OpenRouter, `/model`) instead of suggesting a retry, and still names the log file.
6. **Given** any failure, **When** the user opens the log file, **Then** it contains the
   provider's error message, the model and the time; no API key appears in it.
7. **Given** the innkeeper, **When** a reply fails, **Then** the notice follows the same rules,
   except that it says to send the message again and shows no retry count (plan-time
   correction).

---

### User Story 2 - Spending stays within limits (Priority: P1)

A user leaves a long chat running. Each reply is capped in length, and when the run's spend
reaches 1 USD, the app asks before sending more.

**Why this priority**: it protects the user's money with their own key.

**Independent Test**: with a simulated provider that reports costs, set a small run cap in
`settings.json`; once the cap is reached, the next send asks first; declining sends nothing, and
continuing sends and allows another cap's worth.

**Acceptance Scenarios**:

1. **Given** any request, **When** it is sent, **Then** it asks the model for at most the reply
   cap in output tokens (4096 by default, or the value in settings).
2. **Given** the run's spend is below the cap, **When** the user sends, **Then** nothing changes.
3. **Given** the run's spend has reached the cap, **When** the user sends or regenerates, **Then**
   the app asks `Continue` or `Stop`, showing the amount spent and the cap. `Stop` sends nothing
   and keeps the typed text; `Continue` sends and raises this run's cap by one more cap.
4. **Given** a reply that hits the reply cap, **When** it ends, **Then** it is kept as an ordinary
   reply, and the app says once that it was cut off at the reply limit and where to change it.
5. **Given** the home screen, or the setup notice before the first chat, **When** they are shown,
   **Then** they include one line naming the two limits and the settings file, next to the
   API-key hint.
6. **Given** a chat has started in this run, **When** the screen updates, **Then** the limits
   line is no longer shown.
7. **Given** a model whose prices are unknown (the status bar cost marked as incomplete), **When**
   the user sends, **Then** the reply cap still applies, and the app says once that the spend cap
   cannot be checked for this model.

---

### User Story 3 - Bring back the previous reply (Priority: P2)

The user regenerates a reply, likes the old one better, and types `/prev` to get it back. Typing
`/prev` again shows the newer one.

**Why this priority**: regenerating should not cost the user a reply they preferred.

**Independent Test**: reply A, regenerate to reply B, `/prev` shows A, and the next request
contains A; `/prev` again shows B.

**Acceptance Scenarios**:

1. **Given** the last reply was produced by a regenerate in this run, **When** the user enters
   `/prev`, **Then** the reply it replaced becomes the current reply on screen, in the chat
   history and in the next request.
2. **Given** `/prev` was just used, **When** the user enters `/prev` again, **Then** the other
   reply comes back.
3. **Given** the user sent a new message, switched chats or restarted after a regenerate, or a
   later regenerate failed, **When** they enter `/prev`, **Then** the app says there is no
   previous reply to bring back, and nothing changes.
4. **Given** two regenerates in a row (A → B → C), **When** the user enters `/prev`, **Then** B
   comes back (only the last replaced reply is kept), and `/prev` again shows C.
5. **Given** a reply is streaming, **When** the user enters `/prev`, **Then** the app says to wait
   for the reply or press Esc, and nothing changes.
6. **Given** the innkeeper, **When** the user enters `/prev`, **Then** the app says `/prev` works
   in character chats.

---

### User Story 4 - The player has a name (Priority: P2)

On the first start where no name is set, the app asks "What should characters call you?" with
"Traveler" filled in. From then on, characters use that name unless a persona is active.

**Why this priority**: "User" breaks immersion in every chat that uses `{{user}}`.

**Independent Test**: in a fresh home, open the chat layout: the name prompt appears; Enter
saves "Traveler"; a dry run shows "Traveler" where the card says `{{user}}`. A restart does not
ask again.

**Acceptance Scenarios**:

1. **Given** no saved name and no active persona, **When** the user opens the chat layout for the
   first time, **Then** the name prompt appears with "Traveler" filled in.
2. **Given** the prompt, **When** the user types a name and presses Enter, **Then** that name is
   saved and used for `{{user}}`; **When** the user just presses Enter, **Then** "Traveler" is
   saved.
3. **Given** the prompt, **When** the user presses Esc, **Then** "Traveler" is used for this run
   and the prompt appears again on the next start.
4. **Given** a saved name, **When** the app starts, **Then** there is no prompt.
5. **Given** an active persona, **When** a request is assembled, **Then** the persona's name is
   used, as today.
6. **Given** a name with control characters or only spaces, **When** it is entered, **Then**
   control characters are removed, and an empty result is refused with a short message.

---

### User Story 5 - Tune the model's sampling (Priority: P3)

A user wants livelier replies. They set `"generation": { "temperature": 1.1 }` in
`settings.json`, restart, and the next request uses that temperature; `/trace` shows it.

**Why this priority**: useful for experienced users. It shares the request settings with the
reply cap, so it is cheap to add now.

**Independent Test**: with `generation` values in a temporary settings file, the simulated
provider receives exactly those values and no others, and `/trace` lists them.

**Acceptance Scenarios**:

1. **Given** no `generation` section, **When** a request is sent, **Then** no sampling parameter
   is sent (only the reply cap), as today.
2. **Given** some `generation` values, **When** a request is sent (character chat or innkeeper),
   **Then** exactly those parameters are sent, with those values.
3. **Given** an invalid value (wrong type, or out of range: temperature outside 0 to 2, `topP` or
   `minP` outside 0 to 1, `topK` not a whole number of at least 1, `repetitionPenalty` not
   above 0), **When** settings are read, **Then** that parameter is ignored and the app says once
   which one and why; the other parameters still apply.
4. **Given** a request was sent, **When** the user opens `/trace`, **Then** it lists the reply cap
   and every sampling parameter that LittleTavern requested, or says that model defaults were
   requested.

---

### Edge Cases

- A failure while the user has already typed the next message: the typed text is kept.
- A failure on a regenerate: the reply being replaced stays in the file. The notice is the same,
  and the retry count applies to that message.
- Esc during a reply (an interruption) is not an error: it keeps today's behaviour (saved as
  interrupted, no error notice).
- A provider error message that contains the API key: it is removed from the log and from the
  screen, as today.
- Settings with an invalid limit (negative, not a number): that limit uses its default, and the
  other settings still apply, as with other invalid settings.
- A limit set to 0 in settings: that limit is off. The reminder says "not capped" for it.
- The run's cap is reached in the middle of a reply: the reply finishes, and the next send asks.
- `/prev` after a restart: "nothing to bring back", which also covers a session file edited while
  the app was closed. Editing a session file while the app is running is not supported.
- The name prompt and the API-key setup on the same first start: the name prompt comes first,
  then the existing setup steps.
- A model that ignores some sampling parameter: the request still includes it, and the app cannot
  tell. `/trace` shows what was sent, not what the model honoured.
- Settings edited while the app runs: parameters and limits are read at start; the README says to
  restart after editing.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The app MUST NOT retry failed requests automatically.
- **FR-002**: A failed reply's partial text MUST stay visible, marked `(incomplete, not saved)`.
  It MUST NOT be saved or sent with later requests.
- **FR-003**: The failure notice MUST be short and MUST include the log file's path. When a retry
  can help, it MUST include the retry hint and the manual retry count for that message (character
  chats; the innkeeper has no count). For a rejected key, missing credit or an unavailable model,
  it MUST name the fix instead, without a retry count.
- **FR-004**: Each failure MUST be written to the log with the provider's message, the model and
  the time, with secrets removed.
- **FR-005**: Every request MUST ask for at most the reply cap in output tokens: 4096 by default,
  configurable in `settings.json`, with 0 meaning no cap.
- **FR-006**: When the run's spend has reached the run cap (1 USD by default, configurable in
  `settings.json`, 0 meaning off), sending or regenerating MUST ask first. Declining MUST send
  nothing; continuing MUST raise this run's cap by one more cap.
- **FR-007**: A reply that hits the reply cap MUST be kept and MUST be followed once per run by a
  short note that it was cut off at the reply limit.
- **FR-008**: When the prices of the current model are unknown, the app MUST say once per run that
  the spend cap cannot be checked, and still apply the reply cap.
- **FR-009**: The home screen and the pre-chat setup notice MUST show one line naming both limits
  (or "not capped") and the settings file, until a chat starts in this run.
- **FR-010**: `/prev` MUST swap the current last reply with the one that the latest successful
  regenerate in this run replaced, and swap back on a second use. A new regenerate discards the
  kept reply when it starts and keeps the reply it replaces once it succeeds (A → B → C keeps B).
  `/prev` MUST say there is nothing to bring back after a new message, a failed regenerate, a
  chat switch or a restart. It works in character chats only.
- **FR-011**: After `/prev`, the shown reply MUST be the one in the saved chat history and in the
  next request.
- **FR-012**: On the first chat layout where no name is saved and no persona is active (a persona
  setting whose file is missing or invalid counts as no persona), the app
  MUST ask for the player's name, with "Traveler" filled in. Enter saves it; Esc uses "Traveler"
  for this run only.
- **FR-013**: The saved name MUST be used for `{{user}}` whenever no persona is active. A persona's
  name still takes precedence.
- **FR-014**: Help and the command contract MUST list `/prev`. The README MUST describe `/prev`,
  the limits, the name prompt and the `generation` settings.
- **FR-015**: The app MUST send the `generation` parameters set in `settings.json` (`temperature`,
  `topP`, `topK`, `minP`, `repetitionPenalty`) with every request, and MUST NOT send the ones
  that are not set.
- **FR-016**: An invalid or out-of-range `generation` value MUST be ignored with a one-time notice
  that names it; the valid ones still apply.
- **FR-017**: `/trace` MUST show the reply cap and the sampling parameters that LittleTavern
  requested for the last request, or that model defaults were requested. pi may lower the output
  cap to fit the remaining context, and without a cap it uses the model's maximum; the trace says
  "requested" to make this clear.

### Key Entities

- **Limits** (settings): reply cap in output tokens, and run spend cap in USD. 0 means off; invalid
  values fall back to the defaults.
- **Run spend**: the cost of all requests in this run of the app, as the status bar already shows
  it. It may be marked incomplete when prices are unknown.
- **Retry count**: per failed user message, in memory, reset by success or a new message.
- **Previous reply**: in memory, at most one per run, set by a regenerate and cleared by a new
  message, another regenerate, a chat switch or quitting.
- **Player name** (settings): used for `{{user}}` when no persona is active.
- **Generation parameters** (settings, `generation`): optional `temperature` (0–2), `topP` (0–1),
  `topK` (whole number ≥ 1), `minP` (0–1) and `repetitionPenalty` (> 0). Unset means the
  model's default.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After any failed reply, a user can tell from the screen alone whether to retry and
  where the details are, without reading provider jargon.
- **SC-002**: With default settings, LittleTavern never asks for more than 4096 output tokens per
  reply, and once the run has spent 1 USD it starts no further request without the user agreeing.
  The request in progress when the cap is crossed may take the total slightly past it.
- **SC-003**: A regenerated-away reply can be brought back with one command in 100% of the cases
  covered by FR-010.
- **SC-004**: In a new installation, no character addresses the player as "User".
- **SC-005**: Failures are diagnosable from the log alone: every failure entry includes the
  provider message, the model and the time.
- **SC-006**: A user can change the temperature by editing one line of `settings.json`, and can
  confirm in `/trace` that the change took effect.

## Acceptance Testing

- Unit and app-harness tests with the simulated provider:
  - failures mid-reply and before any text;
  - the retry count;
  - the per-kind notices;
  - the log entry;
  - the reply cap passed to the request;
  - the run cap prompt (stop and continue);
  - the cut-off note;
  - unknown prices;
  - the limits line visible and hidden;
  - `/prev` (swap, swap back, cleared cases, A → B → C);
  - the name prompt (save, default, Esc, persona precedence, invalid name);
  - the `generation` parameters: none set, some set, invalid values, shown in `/trace`.
- Happy path: a fresh home answers the name prompt, chats with Alice, regenerates, uses `/prev`,
  and the next request contains the restored reply and "Traveler" where the card says `{{user}}`.
- Owner, manually: the look of the notices and the prompt; a real provider error if one happens.

## Assumptions

- The run's spend is the cost the status bar already totals for this run. FR-008 applies when the
  current model's price is unknown (plan-time correction).
- The output cap is passed to the provider as the request's maximum output tokens. Providers
  that ignore it are outside the app's control.
- `/prev` builds on what regenerate keeps in the session file, and appends the restored reply so
  it persists (plan-time correction). Its in-memory limit (this run only) is the owner's
  decision, not a storage limit.
- The name prompt fits into the existing setup flow before the first chat. Exactly where is a
  plan detail.
- Sampling parameters are passed through pi's request options. pi-ai 1.3.0 has `temperature` and
  `maxTokens` fields, and passes other sampling keys to OpenAI-compatible APIs, which include
  OpenRouter. This was verified on 2026-10-20; the plan confirms the exact mapping.
- Out of scope: automatic retries; daily or monthly caps; a `/limits` or `/params` command;
  sampling presets; reasoning or thinking strength; the innkeeper assistant (013); keywords for
  non-English chat.
