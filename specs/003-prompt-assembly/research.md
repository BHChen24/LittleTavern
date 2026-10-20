# Research: Prompt Assembly with Lore Trace

Verified on 2026-10-19 against the 002 types (`packages/data/src/cards/types.ts` as written by
Codex), the local samples in `../test-cards/`, `../pi` at `v1.3.0`, and the owner's SillyTavern
notes (`../sillytavern-analysis/analysis/03`, `04`, `11`).

## R1. Pure pipeline in `engine`, no pi imports

- **Decision**: `assemblePrompt(input) → { prompt, trace }` is a pure, synchronous function in
  `packages/engine/src/assembly/`. It is built from small steps, each of which returns new values:
  1. replace macros;
  2. activate lore;
  3. apply the lore budget;
  4. place lore;
  5. build the instruction parts;
  6. fit the history;
  7. append the post-history instructions.
- **Rationale**: This is the "explicit pipeline, immutable input" lesson from the SillyTavern
  notes (ch. 11 §2, §4). Pure steps are trivial to test and explain. Because each step appends
  its own decisions to the trace, the trace is a by-product and is never reconstructed (FR-013).
- **No pi**: the output is our own `AssembledPrompt`. 004 converts it to pi messages
  (constitution II).

## R2. Output shape: system text, history, post-history

- **Decision**: `AssembledPrompt = { system: string, history: { role: "user" | "character",
  text }[], afterHistory: string | null }`.
  - `system` joins the instruction parts in FR-004 order with a blank line between them.
  - `afterHistory` holds the post-history instructions.
- **Rationale**: pi-agent-core's `Agent` takes `systemPrompt` plus messages. pi-ai 1.3 also has
  `SystemMessage` in the `Message` union (`packages/ai/src/types.ts:546,644`), where a later
  system message means "additional instructions", so 004 can send `afterHistory` as a system
  message after the history. Keeping the three pieces separate leaves that choice to 004, which
  owns the pi conversion.
- **Alternative rejected**: a flat list of role-tagged parts. It is more general, but every
  consumer would then have to re-derive the system text.

## R3. Token estimate (CJK-aware)

- **Decision**: `estimateTokens(text) = cjkCount + ceil(otherCount / 4)`.
  - `cjkCount` counts characters matching `\p{Script=Han}`, `\p{Script=Hiragana}`,
    `\p{Script=Katakana}` or `\p{Script=Hangul}`.
  - `otherCount` counts all remaining characters.
- **Rationale**: pi's own estimate is characters ÷ 4 (coding-agent compaction, and noted in the
  SillyTavern notes ch. 11 §6). It undercounts Chinese about fourfold. All the local samples are
  Chinese, so the budget would let in about 4× too much lore. One line of regex is enough to fix
  that and still easy to explain. The trace labels counts as estimates (FR-014).
- **Alternative**: a real tokenizer (tiktoken and similar). Rejected: new dependency, and the
  tokenizer differs per model.

## R4. Macros

- **Decision**: replace `/\{\{\s*(char|user)\s*\}\}/gi` with the character name or user name.
  Leave everything else alone. Apply this to every text part and to each keyword before
  matching (FR-006).

## R5. Lore activation rules (simple version)

- **Entry sources**: `character.lorebook` (if any) followed by `input.lorebooks`, in that order.
  Each entry is identified in the trace by its lorebook name, its index in that lorebook, and
  its `name`.
- **Scan text**: the last `scanDepth` history messages (default 2), lowercased. Message numbers
  in the trace are 1-based positions in the full history.
- **Decision for each entry**, in this order:
  1. `!enabled` → excluded, reason `disabled`;
  2. `constant` → candidate, reason `constant`;
  3. no non-empty keys → excluded, reason `no-keywords`;
  4. the first key (after macro replacement, lowercased) found as a substring, scanning from the
     newest message → candidate, reason `keyword` with that key and message number;
  5. otherwise → excluded, reason `no-match` with the depth.
- **Ignored-feature notes** are read from `entry.source`, never from the normalized fields. Each
  rule below adds a string to `ignoredFeatures`:
  - non-empty `secondaryKeys` → `"secondary keys"`;
  - any key that looks like `/.../flags` → `"regex keys"` (the key is still matched as plain
    text);
  - `source.probability` less than 100 with `source.useProbability !== false`, or
    `source.extensions?.probability` less than 100 → `"probability"`;
  - a numeric position other than 0 or 1 → `"placement <n>"`;
  - `source.scanDepth` or `source.extensions?.scan_depth` not null → `"per-entry scan depth"`;
  - `source.caseSensitive` or `source.extensions?.case_sensitive` true → `"case sensitivity"`;
  - `source.matchWholeWords` or `source.extensions?.match_whole_words` true →
    `"whole-word matching"`.
- **Placement** (FR-009):
  1. A numeric `source.position` (world info) or `source.extensions?.position` (card) of 0 means
     before and 1 means after.
  2. Otherwise `source.position === "before_char"` means before and `"after_char"` means after.
  3. Otherwise the entry goes after. An unknown number also goes after, with a note.
- **Samples checked**: Seraphina has `position: "before_char"` plus `extensions.position: 0`, so
  it goes before. dsh cards have no position, so they go after. Both world-info files use 0, so
  before.

## R6. Budget (FR-011)

- Sort the candidates by `insertionOrder` descending. Break ties by original order (sources
  order, then index).
- Walk the sorted list, adding `estimateTokens(content after macros)` to a running total. At the
  first candidate that would exceed `loreBudget`, mark it and every remaining candidate `budget`.
- The survivors are included. Each lore decision records its token estimate.

## R7. History fit (FR-015, clarified)

- **Available space**: `contextWindow − replyReserve − tokens(system) − tokens(afterHistory)`.
- **Filling**: walk the history newest-first, adding `estimateTokens(text)` per message, and stop
  at the first message that does not fit. The newest message is always kept, even when it alone
  overflows; in that case the trace notes `"request exceeds the context window"`.
- **Trace record**: `{ included, leftOut }`.
- **Context window**: 004 passes the selected model's value. 001's `ModelInfo` has no
  `contextWindow` field, so 003 adds one (pi `Model.contextWindow`) in
  `packages/engine/src/models.ts`. The defaults when a value is missing or 0 are
  `contextWindow 128000` and `replyReserve 4000`.

## R8. Defaults

The settings and their defaults are:

- `scanDepth = 2`: the SillyTavern default (notes ch. 4 §3).
- `loreBudget = 4000`: clarified.
- `replyReserve = 4000`: clarified.
- `userName = "User"`.
- Default main instruction: `"Write {{char}}'s next reply in a fictional chat between {{char}}
  and {{user}}."`. This is our own wording of SillyTavern's default `main` idea.
