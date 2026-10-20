# Implementation Questions: Pickers Instead of Ids

## Resolved implementation details

- Lorebook picker values use a small local discriminated union for import, embedded, library and
  missing entries. This keeps the selection handler explicit without a new component or storage.
- App-harness tests share local fixture helpers in `app-pickers.test.ts`; all cards and lorebooks
  are generated in temporary directories. Symlink creation is skipped on Windows, consistent
  with the existing import tests.

- Removing the last argument-taking command also removes the now-unused command context and
  library-completion helpers. Character-creation success directs users to `/characters`.

## Behavior questions resolved by the owner

### Q1. Persistence of a chat containing only the greeting

**Affected tasks**: T009 and T018 (completed after the owner decision below).

Research R6 says `CharacterChat.start` creates a new session file with the character entry and
greeting. The pinned pi `v1.3.0` source contradicts that fact: `SessionManager._persist` returns
without creating a file until `_hasConversation()` finds a user or assistant message
(`../pi/packages/coding-agent/src/core/session-manager.ts:1166–1185`). Our greeting is a custom
entry, so a chat with only that greeting is absent from `/sessions`.

The implemented `/new` follows T009's explicit `startChat(item)` design. A previous chat with a
user message stays saved and resumable, as the planned tests demonstrate. However, `/new`
before any user message replaces a greeting-only chat which has never been saved. A new chat
also does not appear in `/sessions` until it has a user message. This originally conflicted with FR-007's
unqualified preservation requirement and SC-003's “100% of cases”; the updated spec resolves it.

The owner subsequently chose the existing pi behavior, as recorded below and in the updated
spec. T018 adds coverage for replacing a greeting-only chat and immediately listing a previous
chat with messages. No engine storage change is needed; T009 and T018 are complete.


### Q2. Panels taller than the terminal lose a border

**Affected work**: FR-008 / US4/AC1; convergence T019 (completed after the owner decision below).

The planned Frame wraps the child's rendered lines and has no viewport-height contract. At
60 columns and 24 terminal rows, `/help` renders 32 rows. An offline check against the built app
and a stub terminal captured a top border but no bottom border in actual terminal writes.
pi's overlay compositor crops oversized overlays; a border around all child lines is therefore
not sufficient to keep all four sides visible.

The owner subsequently specified scrollable help and clipped overflow for other panels, as
recorded below and in research R1 and the contract. T019 implements those decisions. Frame reads
the terminal height at render time, preserves both border rows and replaces the last visible
content line with an ellipsis when clipped. Help wraps its lines with pi-tui and reuses
TraceOverlay; Esc closes it through onClose. Frame unit tests and a 60x24 app/terminal test pass.
The original reproduction used a temporary home, no key and no network.

## Owner decisions (2026-10-20)

- **Q1**: greeting-only chats are not saved, as pi does. FR-007, SC-003 and US3 now apply to chats
  with at least one message; a greeting-only chat is replaced by `/new`. No engine change. See
  T018.
- **Q2**: `/help` scrolls like `/trace`. Other panels taller than the terminal are clipped, with a
  complete border and `…` as the last visible line. See research R1 "Height", the contract's
  frame section, and T019.

## Follow-up validation guide correction

Convergence T020 aligns manual quickstart step 4 with the owner's Q1 decision: the previous chat
with messages is listed immediately after `/new`; the new chat appears after its first message.
There are no unresolved behavior questions.
