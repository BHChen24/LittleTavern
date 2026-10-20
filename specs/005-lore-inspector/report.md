# Implementation report: 005-lore-inspector

## Summary

003's trace can now be seen in two places:

- **`littletavern dry-run <character> [--message] [--session] [--json]`** prints the next request
  and why it looks the way it does. It uses no provider and no key and writes nothing.
- **`/trace`** opens a scrollable overlay for the last request of the current character chat.

Both use one formatter. It shows, in order:

1. the summary (total, lore against the budget, history kept and left out);
2. notes;
3. the parts;
4. the fired entries, with reason sentences;
5. the not-fired entries, grouped by reason with counts.

The dry run calls the same `assembleForCharacter` as a real chat. A test shows that its trace
deep-equals a real request's `lastTrace` (SC-003).

This was implemented by Claude Code rather than Codex, because Codex's usage limit was close.

## Tasks completed and not completed

- T001–T013 are complete. Phase 6 (T011–T013) was added by convergence.
- T001 needed no code: `assembleForCharacter` was already extracted in 004.

## Test results

```text
pnpm build && pnpm lint && pnpm test
Checked 87 files … No fixes applied.
Test Files  33 passed (33)
     Tests  206 passed (206)
```

| Area | What the tests cover |
|---|---|
| Formatter | summary, notes, parts, reason sentences, groups with counts, unnamed entries, "No lorebooks.", ignored features, every entry exactly once, CJK alignment by display width, no escape codes, the 30-entry readability case |
| `dryRun` | new chat (greeting plus message), greeting only, no files written, saved chat after regenerate, a session of another character or a missing character, unknown ids, same trace as a real send |
| CLI | text output, the greeting-only note, JSON, unknown id with exit code 1, no key |
| `TraceOverlay` | window and footer, scrolling bounds, Esc |
| App `/trace` | notices outside a character chat and before any request; the overlay shows the keyword reason; Esc returns focus to the editor |

**Smoke test (built CLI, real samples, no key)**: dry-running `avra-complete.json` with the
message 「金麦穗」 shows:

- 3 entries fired: one is always on, ``keyword `金麦穗` in message 2``, and ``keyword `黑蜡信封` in
  message 1`` (from the greeting);
- 3 entries in "no keyword in the last 2 messages".

## Deferred tests

None.

## Deviations from spec or plan

- **Not-fired names wrap onto continuation lines instead of being cut to one line** (research R4).
  Cutting would hide entries and break SC-001 ("every entry exactly once"). The names are packed
  so that a name is never split.
- **Truncation and padding use our own small `fitWidth`** (display-width aware) instead of
  pi-tui's `truncateToWidth`. The latter adds ANSI reset codes, which pollute dry-run output that
  is piped to a file.
- **The `/trace` overlay is our own windowed component**, as planned in Complexity Tracking.
- **A saved chat must belong to the given character.** Otherwise the dry run reports which
  character it belongs to, or the same "no longer in the library" message as 004's resume
  (convergence T012).

## Open questions

None.

## Demo notes for the owner

- **Use 阿芙拉 (`avra-complete.json`) or Seraphina for the keyword demo.** The lighthouse card's
  two entries have no keywords: one is constant and one is disabled. It still makes a good
  "disabled / always on" example.
- **Suggested flow**:
  1. Run `dry-run <id>` (greeting only).
  2. Run `dry-run <id> --message "…金麦穗…"`.
  3. Lower `loreBudget` in `settings.json` and dry-run again to show "over budget".
  4. With a key, start the chat, send the same message and open `/trace`.

## Development tool and token usage

See [development-usage.md](./development-usage.md). Total development tokens: **unknown**. The
owner can add the figure from `/cost`.

## Convergence

**Checked**: 10 FRs, 4 SCs, 17 acceptance scenarios, plan decisions R1–R6, and 7 constitution
principles plus the testing policy.

**Findings, all LOW, all fixed**:

| Task | Finding | Fix |
|---|---|---|
| T011 | The greeting-only dry run did not say so | It now prints a note |
| T012 | Saved chats were not checked against the character | The check is added |
| T013 | `development-usage.md` was missing | Added |

**Re-check after the fixes**: no remaining gaps.

## What the owner should check manually

Follow `quickstart.md`:

1. The greeting-only dry run.
2. The keyword dry run.
3. Lowering the budget to show "over budget".
4. `/trace` in a real chat, including scrolling and Esc.
