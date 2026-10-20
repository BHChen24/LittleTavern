# Data Model: Prompt Assembly with Lore Trace

All types live in `packages/engine/src/assembly/types.ts` and are exported from the engine
barrel. They use `Character`, `Lorebook` and `LorebookEntry` from 002 (re-exported through the
engine, as 001 and 002 do).

## AssemblyInput

| Field | Type | Notes |
|---|---|---|
| `character` | `Character` | from the 002 library item |
| `lorebooks` | `Lorebook[]` | standalone lorebooks; the character's embedded lorebook is added automatically, first |
| `userName` | string | default `"User"` |
| `history` | `HistoryMessage[]` | chronological |
| `contextWindow` | number | the selected model's window; default 128000 if 0 or missing |
| `settings` | `Partial<AssemblySettings>` | missing values use the defaults |

## HistoryMessage

`{ role: "user" | "character"; text: string }`

## AssemblySettings

| Field | Default |
|---|---|
| `scanDepth` | 2 |
| `loreBudget` | 4000 |
| `replyReserve` | 4000 |

## AssembledPrompt

| Field | Type |
|---|---|
| `system` | string: main instruction, lore before, description, personality, scenario, lore after, examples, joined with blank lines (empty parts omitted) |
| `history` | `HistoryMessage[]`: the kept messages, chronological |
| `afterHistory` | `string \| null`: post-history instructions |

## AssemblyTrace

| Field | Type |
|---|---|
| `tokensAreEstimates` | `true` |
| `parts` | `TracePart[]`, in prompt order |
| `lore` | `LoreDecision[]`, one per entry considered, in source order |
| `history` | `{ included: number; leftOut: number }` |
| `notes` | string[], for example `"request exceeds the context window"` |
| `totalTokens` | number (estimate) |

## TracePart

`{ source: "main" | "lore-before" | "description" | "personality" | "scenario" | "lore-after" | "examples" | "history" | "after-history"; tokens: number; detail?: string }`

The `detail` field holds, for example, `"3 entries"` or `"12 messages, 4 left out"`.

## LoreDecision

| Field | Type |
|---|---|
| `lorebook` | string (lorebook name) |
| `index` | number (position in that lorebook) |
| `entry` | string (entry name, may be `""`) |
| `included` | boolean |
| `reason` | `{ kind: "constant" }`, `{ kind: "keyword"; key: string; message: number }`, `{ kind: "disabled" }`, `{ kind: "no-keywords" }`, `{ kind: "no-match"; depth: number }` or `{ kind: "budget" }` |
| `placement` | `"before" \| "after"` (for included entries) |
| `tokens` | number (for candidates) |
| `ignoredFeatures` | string[] |

A `keyword` or `constant` reason with `included: false` cannot happen: those candidates either
stay included or get the reason `budget`.

## Invariants (tested)

- Every entry of every lorebook passed in, including the embedded one, appears exactly once in
  `trace.lore` (SC-002).
- The sum of `tokens` over included lore is at most `loreBudget`.
- `trace.history.included + trace.history.leftOut === input.history.length`.
- The same input gives the same output (SC-003).
