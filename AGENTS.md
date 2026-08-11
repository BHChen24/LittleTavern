# Repository Instructions

## Purpose

LittleTavern is a **terminal (TUI) app for character-card roleplay chat**, in the same family as
SillyTavern but not a port of it.

SillyTavern is a **design reference**, not a specification. It has spent years solving real problems
— character cards, lorebooks, injecting text at a chosen depth in the conversation, swipes, instruct
templates, prompt presets — and those solutions are worth borrowing instead of rediscovering. But
LittleTavern is under no obligation to reproduce SillyTavern's behavior, its output, or its quirks.
Take the concept; design the implementation ourselves.

Concretely: **output parity with SillyTavern is not a goal.** Its accumulated
backwards-compatibility scars do not transfer to us. Where SillyTavern's design is good we adopt the
idea; where it is legacy baggage we do not.

## Reference Repository

SillyTavern v1.18.0 is cloned read-only at `../SillyTavern` (commit `8172dcd0e`).

- **Never modify it, and never write into it.** Treat the whole tree as read-only.
- Where its behavior lives: the server (`src/`) is a thin file-CRUD and provider-proxy layer. *All*
  prompt-building logic is in the browser — `public/script.js`, `public/scripts/openai.js`,
  `world-info.js`, `instruct-mode.js`, `macros.js`, `slash-commands/`.

## Licensing Rule

SillyTavern is **AGPL-3.0**. LittleTavern is **MIT**. File formats, wire protocols and language
syntax are not copyrightable; source code is. Therefore:

- Read SillyTavern to learn what a format contains and which design ideas are worth taking. Describe
  them in our own words and implement independently.
- Do **not** copy/paste its source, translate a function statement-by-statement, or vendor its files
  (tokenizer models, shipped preset JSON, tests).
- Third-party assets come from their original upstreams, not from SillyTavern's tree.

Because we are borrowing design rather than matching behavior, this is a comfortable margin rather
than a tightrope — but it applies to every change.

## Tech Stack

| Concern | Choice |
|---|---|
| Runtime / package manager | Node (v26 locally), pnpm |
| Language + build | TypeScript 7, full `tsc` build |
| Tests | Vitest |
| Lint + format | Biome |
| Logging | pino — file transport, structured, **secret redaction from the first commit** |
| Storage | SQLite via built-in `node:sqlite` (zero deps, no native build) |
| Vectors / RAG | `sqlite-vec` extension (ships a per-platform compiled binary) |
| TUI framework | **Ink** (7.1.1) — React-based; chosen for ecosystem depth |
| Provider/transport layer | `@earendil-works/pi-ai` — chat providers, request shaping, streaming |
| Tool-call loop | **Ours** — see AI Layer below |

Logging to stdout is not an option: a full-screen TUI owns the terminal. Logs go to a file, read
with `tail -f` in a second terminal. Redaction matters because request bodies contain API keys.

### AI Layer

**The dividing line: transport is commodity, prompt assembly is the product.** SillyTavern's request
layer is 26 variations of "POST JSON, parse an SSE stream" — all its intelligence is in building the
prompt. So outsource the transport and own the prompt.

**`@earendil-works/pi-ai` (MIT) handles transport.** Verified escape hatches, which was the condition
for adopting it:

- `StreamOptions.samplingParams: Record<string, unknown>` — arbitrary params merged into the request
  body, overriding named fields. Covers `top_k`, `min_p`, `repetition_penalty` etc. for
  OpenAI-compatible servers. **Only applied by OpenAI-compatible adapters**; other APIs ignore it.
- `Model.baseUrl`, `Model.headers`, per-API `compat` overrides, `cacheRetention` for prompt caching.
- Adapters are lazy-loaded, so the AWS SDK is not paid for unless Bedrock is used.
- `AssistantMessage.content` is `(TextContent | ThinkingContent | ToolCall)[]` — **reasoning is
  already a separate content type**, which feeds Output Segmentation directly.

**Verified gaps — design around these, do not discover them later:**

| Gap | Consequence |
|---|---|
| No `name` field on messages | Multi-character group chat cannot label speakers at the API level |
| System is one `Context.systemPrompt` string, not a role in the message array | **System-role injection at depth is not expressible** — inject at depth as `user` instead |
| No assistant prefill | Cannot force a reply to begin with given text |
| No raw-prompt (non-chat) API | Text-completion backends (ooba, koboldcpp, llama.cpp raw mode) are not covered |

**The tool-call loop is ours.** pi-ai already models tools completely — `Context.tools`, `ToolCall`
inside assistant content, `ToolResultMessage` in the message union. Only the loop is missing, and it
is ~30 lines: stream, collect tool calls, execute, append results, repeat until the reply is prose.
Own it, because it has to interleave with our streaming UI, abort handling and state engine.

**`pi-agent-core` is rejected.** It is a coding-agent harness — `harness/tools/`, `skills`,
`FileSystem`, `Shell`, `ExecutionEnv`, session management, telemetry — and our UI explicitly excludes
shell and file tools. More importantly it **owns the transcript and builds context**, which is the
exact job our prompt assembly and state engine must own. Adopting it to obtain a 30-line loop means
inheriting that conflict permanently.

**One piece of it we will need eventually: compaction.** `shouldCompact`, `findCutPoint`,
`generateSummary`, `estimateContextTokens` solve context summarization for long sessions —
unavoidable in long-form roleplay. Read theirs before writing ours; possibly depend on it then, once
the requirements are known.

### TUI framework notes

Ink core is healthy (7.1.1, Jul 2026) and depends on `string-width@8`, so **CJK width is handled
internally** — important for roleplay content. Claude Code is built on Ink, which validates this
exact shape of app.

Its **component ecosystem is largely stale**, though: `ink-markdown` (Oct 2023), `ink-table`
(Dec 2023), `ink-text-input`, `ink-form` and `ink-testing-library` (all May 2024). Expect to fork or
replace some of it. Prefer `marked-terminal` (Jan 2025) over `ink-markdown` for rendering.

Two known gaps, both already covered by decisions in the UI section:

- **No multiline editor component.** Irrelevant, because long messages go to `$EDITOR`; Ink only
  needs a competent single-line inline input.
- **No z-layering or portals**, so true floating overlays do not exist. Modals *replace* content
  rather than float over it — acceptable terminal UX for a command palette or `/sessions`.

Build ourselves: theming, keybinding conflict management, collapsible blocks, message selection
cursor.

`@earendil-works/pi-tui` was evaluated and rejected despite meeting every requirement (first-class
overlays, built-in markdown/editor/autocomplete/fuzzy, headless `render(width) → string[]`). Ink won
on ecosystem depth. If Ink's stale components become a real drag, pi-tui is the fallback worth
re-testing.

### Packages — suggested

Adopt when scaffolding. Versions verified 2026-08-10; re-check before installing.

| Package | Version | Reason |
|---|---|---|
| `typescript` | 7.0.2 | The build. |
| `vitest` | 4.1.10 | Test runner; its snapshot support is what this project leans on. |
| `@biomejs/biome` | 2.5.7 | Lint and format in one tool. |
| `ink` | 7.1.1 | The TUI framework. Peer-requires `react` and `@types/react` >= 19.2.0. |
| `react` | 19.2.8 | Ink peer dependency, not a UI choice of its own. |
| `@earendil-works/pi-ai` | 0.84.1 | Chat provider transport, request shaping and streaming. |
| `pino` | 10.3.1 | Structured logging to a file, because a TUI owns stdout. |
| `pino-pretty` | 13.1.3 | Makes the `tail -f` log readable to a human. |
| `sqlite-vec` | 0.1.9 | Vector search inside the same database, for RAG. |
| `env-paths` | 4.0.0 | Resolves XDG-correct config/data/cache directories. |
| `fflate` | 0.8.3 | Pure-JS zip for CharX/BYAF card imports, no native build. |
| `yaml` | 2.9.0 | Some cards ship as YAML; likely the config-file format too. |
| `sanitize-filename` | 1.6.4 | Character names become filenames on export, and users will use slashes. |

`node:sqlite` needs no package — built into Node 26, verified working with FTS5, JSON1, WAL and
extension loading.

### Packages — on hold

Shortlisted; decide when the need is real. Do not install these speculatively.

| Package | Blocked on |
|---|---|
| `ink-select-input`, `ink-scroll-view`, `marked-terminal`, `ink-testing-library` | Ink companions — adopt as each need arrives; check staleness before depending on any of them. |
| `@earendil-works/pi-agent-core` | **Compaction only** — adopt (or copy the approach) when long-session context summarization becomes real. Do not adopt the harness. |
| `chevrotain` | Whether there is a macro language at all — but far better than hand-rolling a parser if so. |
| `handlebars` | Whether we adopt templated context strings or design something else. |
| `tiktoken`, `@agnai/sentencepiece-js` | Whether token budgeting is in v1 — exact counts only matter once trimming context. |
| `@huggingface/transformers` | Whether embeddings run locally or via an API. Use upstream, not ST's fork. |
| `fuse.js` | Whether the character picker needs fuzzy typeahead; complements FTS5 rather than duplicating it. |
| `citty` / `commander` | There being an entrypoint with arguments to parse. |
| `drizzle-orm` / `kysely` | Whether we want a query builder, and whether it supports `node:sqlite` rather than `better-sqlite3`. |
| `umzug` / `drizzle-kit` | Migration tooling. **Has a deadline** — settle at the first table, not after. Hand-rolled `PRAGMA user_version` is a legitimate third option. |
| `png-chunk-text` / `-extract` / `-encode` | Depend vs implement — ~50 lines each, frozen since 2022, and card parsing is core enough to want control over the `ccv3`/`chara` dual-write. |

### Packages — avoid

| Package | Reason |
|---|---|
| `droll` | Declares no license at all; dice parsing is a short function. |
| `moment` | Deprecated by its maintainers; native `Intl` covers it. |
| `vectra` | ST's local vector store, superseded by `sqlite-vec`. |
| `node-persist` | A file-backed KV store, which is what SQLite already is. |
| `jimp` (21 packages in ST) | Image processing for artwork a terminal cannot display. |
| `seedrandom` | Frozen since 2022; mulberry32 is ten lines we should own for determinism. |
| `webpack`, `express` + browser stack | Solving problems a TUI does not have. |

Using the same npm packages as SillyTavern carries **no licensing risk** — they are independently
licensed third-party libraries. The AGPL constraint applies only to SillyTavern's own source.

### Code portability rules

`tsc` is the build today, but Node can execute `.ts` directly and a bundler will be needed for
distribution. Two rules keep all three interchangeable at near-zero cost:

- No `enum`, no `namespace` with runtime code, no constructor parameter properties. Use `as const`
  objects plus union types.
- Explicit `.ts` extensions on relative imports, with `allowImportingTsExtensions` and
  `rewriteRelativeImportExtensions` so `tsc` rewrites them to `.js` on emit.

Note `tsc` emits a mirrored tree of `.js`, not a shippable artifact. A bundler at distribution time
is expected, not a change of plan.

## Design Principle: Mechanism, Not Policy

LittleTavern ships **mechanism**; the user's configuration and prompts determine whether their
particular setup works. We are not responsible for making every model, card or prompt behave
correctly.

This is a deliberate scope limit and it will be tempting to violate. It means: no model-compliance
detection, no schema-validation heroics, no fallback path for every malformed block a model might
emit. When output does not match a user's configured pattern, nothing happens — that is the correct
behavior, not a bug. Fail visibly and cheaply rather than guessing.

## Data Model

**SQLite is the source of truth.** SillyTavern's file formats are an import/export boundary only —
nothing downstream of import ever sees them. We do not read or write a live SillyTavern install.

Compatibility is worth paying for at exactly one layer. Sort SillyTavern's data into three tiers:

1. **Ecosystem formats — support these.** Character cards (PNG with base64 JSON in `tEXt` chunks:
   `ccv3` for V3, `chara` for V2; also plain JSON, CharX, BYAF) and lorebooks. These have a public
   spec and are shared across the whole ecosystem (Chub, RisuAI, Agnai). This is the real value.
2. **SillyTavern conventions — import only.** Chat JSONL, regex scripts. Informally shared; worth
   reading, not worth designing around.
3. **SillyTavern application state — ignore entirely.** `settings.json`, preset folders,
   `secrets.json`, personas, groups, themes. Nobody trades these files. Our own design is better.

**Files for human-authored content; SQLite for machine-generated.** The test is who writes it.

- **Files** — config (data directory, log level, endpoints, keybindings) *and* authored resources:
  characters, lorebooks, presets, personas. Authored in TOML/YAML/Markdown so users can organize,
  grep, diff and version them without the app running.
- **SQLite** — chats, vectors, search indexes, caches. Append-heavy, high-churn, thousands of rows
  deep; miserable as hand-edited files, ideal with FTS5.
- **Deliberate exception: the recent event log lives in a file** as full text, for fidelity and
  inspectability, even though it is model-generated. Older events age out into SQLite as vectors for
  semantic retrieval. Two storage systems for one kind of data is the accepted cost; the aging
  migration is a known piece of work, not an oversight.

**Preserve the original card JSON verbatim at import, from the first version.** Export can wait for a
later wave, but a source blob not captured on the way in can never be recovered — lossless export
would then require users to re-import everything. One column now; impossible later.

Import accepts both PNG and JSON; **JSON is the documented recommendation**, because a terminal
cannot preview a PNG while JSON is inspectable, diffable and greppable.

Still open: config file format (TOML vs YAML); secrets storage (env vars vs database vs OS keychain —
do not let this default silently into a plaintext column); migration tooling.

## UI / UX

The reference feel is **Claude Code**: terminal chat, slash commands, `?` for hints, streaming
output, modal pickers. Explicitly *not* included: shell access, file tools, or anything else outside
roleplay. This is an entertainment app.

**Layout**

- One-line status bar.
- Toggleable left/right sidebars (opencode-style).
- Small modals for commands and search (`Ctrl+P`-style palette).
- Full-screen panes only for genuinely interactive views. **Not for editing** — see `$EDITOR` below.

**Principle: sidebars show state about the current conversation; modals handle navigation and
selection.** Sidebars are inspectors, not menus, so nothing in them moves while you read. Panels:
active lorebook entries, context/token meter, character sheet, and character/world status. Session
switching is navigation, so it is `/sessions`, not a panel.

**`$EDITOR` is the editing surface, everywhere.** Short messages are composed inline; long ones open
in `$EDITOR`. Editing a character, lorebook or preset does the same — serialize, open, parse back on
save, `kubectl edit` style. This deletes an entire category of work (in-app forms, focus management,
tab order, scrolling field layouts) and gives users their own editor config for free.

**Message operations.** Define the operation set **once** — edit, delete, regenerate, continue,
branch, swipe — each taking a target message. Expose that same set through three surfaces:

- quick keys on the last message (the common case),
- selection mode (`j`/`k` moves a highlight, then operate),
- slash commands with an optional index: `/regenerate`, `/regenerate 8`, `/continue`.

Three surfaces, one implementation. Message indices are **hidden by default and toggled on demand**,
and are **stable per chat, not positional** — deleting message 5 must not renumber what is on screen.

**Other settled behavior**

- Swipes render inline as `◀ 2/4 ▶` with arrow keys to cycle.
- `Esc` interrupts generation and keeps the partial text.
- Mouse support is excluded or opt-in only: enabling mouse reporting breaks the terminal's own
  click-drag text selection, which users rely on for copying text, and degrades over plain SSH.
- Text only in v1 — no character portraits. Terminal graphics protocols exist and can be revisited.
- Rendering ships sane defaults in v1 (italic, bold, code, colored dialogue). **User-configurable
  rendering is a later wave** — but "deferred" must not mean the default is unreadable.

## Output Segmentation and Game State

**A v1 core feature, not a follow-on.** Model output arrives as one stream containing several kinds
of content — prose to read, reasoning not to, and structured state (status, events). Segment it at
parse time and route each kind to its own destination.

**Regex-based rule table.** Each rule is a pattern plus a policy, so new content types are new rows
rather than new code:

| Content | Destination |
|---|---|
| Thinking / reasoning | Collapse inline, toggleable; strip from prompt history so it does not consume context forever |
| Character status (HP, MP, buffs) | Sidebar panel; persist current values |
| Events | Recent → full text in a file; older → vectorized in SQLite for retrieval |

SillyTavern regex scripts embedded in imported cards map onto a subset of this same table, so
importing them is natural rather than a special case.

**Tool calls are the other route to state, and the rule table should be able to target both.**
Instead of regex-parsing a status block out of prose, a tool like `update_status({hp, mp, location})`
makes the update explicit and schema-validated. Regex is the default because it works with any model,
costs no extra round-trip, and roleplay leans on local models with weak tool support — but where
tools are available they are strictly more reliable. Do not design the state engine so that regex is
the only possible source.

**Collapsing is renderer display state, not markup.** Do not introduce `<hide>` tags or an HTML
renderer. "Collapsed" means: print a marker line (`▸ thinking (412 tokens)`) instead of the body, and
expand on keypress. Whatever regex matched the block is enough to know what to collapse.

**Close the loop.** Persisted state is **re-injected into the next prompt**, so the model is handed
the current time, location and inventory rather than re-deriving them from history. This is the
headline feature and the main differentiator from SillyTavern — which parses reasoning blocks and can
hide text, but captures no state.

Per *Mechanism, Not Policy* above: when a model emits a malformed or missing block, the rule simply
does not match. Do not build reconciliation logic for that.

## Data Safety

- Never write into `../SillyTavern` or any SillyTavern installation.
- Pick migration tooling when the schema is first created, not after the first painful change. The
  schema will churn early and users will already have data in it.
- Back up the database before destructive operations. `VACUUM INTO` gives a consistent copy cheaply.

## Not Decided Yet

Do not introduce any of these here until settled.

**Blocking the first code**

- **Platform baseline.** Linux / macOS / Windows / WSL, and the minimum Node version.

**Blocking design, needed before the engine**

- **v1 scope and wave boundaries.** Not recorded anywhere. Note that the state engine being a v1
  core feature makes v1 "a roleplay client with a state engine", not "a chat TUI" — scope
  accordingly.
- **Text-completion backends.** pi-ai has no raw-prompt API, so ooba / koboldcpp / llama.cpp raw mode
  means either hand-rolling that transport or dropping those backends. A real fork; decide it.
- **Prompt assembly design.** The core of the product and entirely undesigned. What replaces
  SillyTavern's story string and prompt manager — how card fields, lorebook hits, injections at
  depth, and persisted state combine into one request.
- **Internal schema for characters, lorebooks and presets** — what imported cards map *into*.
- **Which tools ship in v1**, given tool calls can drive the state engine.

**Has a deadline**

- **Migration tooling** — settle at the first table, not after.

**Decide when reached**

- Config file format (TOML vs YAML); secrets storage (env vs database vs OS keychain — never let it
  default silently into a plaintext column); Ink theme/styling layer; keybinding scheme; user-facing
  error model; UI testing approach (Ink needs a library to capture frames, and
  `ink-testing-library` is stale — verify early, it gates the whole UI test story); packaging and
  distribution.

## Structure

pnpm workspace, three packages. The split exists for one reason: **the engine must be importable and
testable without Ink and React loading.** Keeping that boundary is what makes engine tests fast and
stops presentation concerns leaking into prompt assembly.

```
packages/
  data/     @littletavern/data     SQLite, files, schema, import/export.  No workspace deps.
  engine/   @littletavern/engine   Prompt assembly, output segmentation, state engine,
                                   tool-call loop.  -> data
  tui/      @littletavern/tui      Ink app; provides the `littletavern` binary.  -> engine
```

Dependency direction is strictly `tui -> engine -> data`. **`engine` must never import `ink` or
`react`.**

Built with `tsc -b` and TypeScript project references, so build order and incremental caching are the
compiler's job. Turborepo was considered and rejected: `tsc -b` already provides the task graph and
cache, Biome lints the whole tree in one pass, and Vitest handles the workspace natively — Turbo
would orchestrate tools that already orchestrate themselves.

`tsconfig.base.json` sets **`erasableSyntaxOnly: true`**, which mechanically enforces the portability
rule above — `enum`, `namespace` with runtime code and constructor parameter properties are compile
errors, not conventions. `allowImportingTsExtensions` + `rewriteRelativeImportExtensions` mean source
imports are written `./foo.ts` and emitted as `./foo.js` (verified in the build output).

Install scripts are **denied by default** in `pnpm-workspace.yaml` (`allowBuilds`). Two arrive
transitively via pi-ai and neither does anything we need; see the comment there before changing it.

## Current State

Workspace scaffolded and verified: all three packages build, link, lint and test. Each package holds
a placeholder `src/index.ts` and no real implementation yet.

## Commands

All run from the repository root:

| Command | Purpose |
|---|---|
| `pnpm build` | `tsc -b` across all packages |
| `pnpm build:watch` | Incremental rebuild on change |
| `pnpm clean` | `tsc -b --clean` |
| `pnpm test` / `pnpm test:watch` | Vitest |
| `pnpm lint` | Biome check (lint + format, read-only) |
| `pnpm lint:fix` | Biome check with `--write` |

There is no separate typecheck command — `pnpm build` typechecks and emits in one pass.

## Conventions

- `.env` and `.env.*` are ignored, while `.env.example` is allowed; document required variable names
  there without secrets.
