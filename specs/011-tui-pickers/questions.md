# Implementation Questions: Pickers Instead of Ids

## Resolved implementation details

- Lorebook picker values use a small local discriminated union for import, embedded, library and
  missing entries. This keeps the selection handler explicit without a new component or storage.
- App-harness tests share local fixture helpers in `app-pickers.test.ts`; all cards and lorebooks
  are generated in temporary directories. Symlink creation is skipped on Windows, consistent
  with the existing import tests.

- Removing the last argument-taking command also removes the now-unused command context and
  library-completion helpers. Character-creation success directs users to `/characters`.

## Open behavior questions

### Q1. Persistence of a chat containing only the greeting

**Affected task**: T009 (left unchecked pending a design decision).

Research R6 says `CharacterChat.start` creates a new session file with the character entry and
greeting. The pinned pi `v1.3.0` source contradicts that fact: `SessionManager._persist` returns
without creating a file until `_hasConversation()` finds a user or assistant message
(`../pi/packages/coding-agent/src/core/session-manager.ts:1166–1185`). Our greeting is a custom
entry, so a chat with only that greeting is absent from `/sessions`.

The implemented `/new` follows T009's explicit `startChat(item)` design. A previous chat with a
user message stays saved and resumable, as the planned tests demonstrate. However, `/new`
before any user message replaces a greeting-only chat which has never been saved. A new chat
also does not appear in `/sessions` until it has a user message. This conflicts with FR-007's
unqualified preservation requirement and SC-003's “100% of cases”.

The owner must decide whether greeting-only chats should be persisted (and specify the engine
storage change), or whether the requirement applies only after a user message. No storage-policy
change is invented here. Independent work continues under the unattended-run rules.


### Q2. Panels taller than the terminal lose a border

**Affected work**: FR-008 / US4/AC1; convergence T019.

The planned Frame wraps the child's rendered lines and has no viewport-height contract. At
60 columns and 24 terminal rows, `/help` renders 32 rows. An offline check against the built app
and a stub terminal captured a top border but no bottom border in actual terminal writes.
pi's overlay compositor crops oversized overlays; a border around all child lines is therefore
not sufficient to keep all four sides visible.

The owner must specify whether tall panels should scroll, clip content while retaining the
border, or use another overflow policy. Each option affects what the user can read or navigate.
The plan only specifies a height adjustment for the trace, which has been implemented. No new
height or scrolling policy is chosen here. The reproduced check used a temporary home, no key
and no network.
