# Repository Instructions

LittleTavern is a terminal (TUI) client for character-card roleplay, built on the pi framework.
SillyTavern is a design reference, not a specification.

## Your Role

**You are primarily the implementer.** Design happens elsewhere: the project owner works it out
with another agent (mainly Claude) and hands it to you as Spec Kit artifacts. Implement what
those artifacts say. Do not redesign, and do not fill gaps with your own design.

## Sources of Truth

In order of precedence:

1. **`.specify/memory/constitution.md`**: non-negotiable principles. It overrides everything
   else, including this file.
2. **Feature artifacts in `specs/<feature>/`**, mostly written by Claude with the owner:
   `spec.md` (what and why), `plan.md` (how, including technology choices), `tasks.md`, and
   supporting files such as `research.md`, `data-model.md` and `contracts/` when present.
3. **This file**: runtime guidance only.

- If the artifacts contradict each other, or leave a gap that would change behaviour, stop and
  report it. Do not guess.
- Do not edit the constitution or a spec unless a task tells you to. Report problems you find in
  them instead.
- The design that predates the constitution is archived at the git tag `archive/ink-design`. It
  is history; do not follow it.

## Spec Kit

The Spec Kit skills are in `.agents/skills/`. On your side, use `speckit-implement` and
`speckit-converge` on the feature you were given. `speckit-constitution`, `speckit-specify`,
`speckit-clarify`, `speckit-plan` and `speckit-tasks` belong to the design side; do not run them
unless the owner asks.

## Working Rules

- Build only what the active `tasks.md` asks for. Do not add features "for later".
- Verify facts about pi against the reference clone at `../pi`, which is checked out at the pinned
  version's tag. Do not rely on memory; pi changes quickly.
- `../SillyTavern` and `../pi` are read-only. The licensing rules for reference projects are in
  the constitution.
- Ask before running a local LLM or anything GPU-heavy.
- Never commit secrets. `.env` and `.env.*` are ignored; `.env.example` is allowed and documents
  variable names without values.
- **Do not read, print or use `.env`.** It holds the owner's real API key. Tests use the
  simulated provider and never load it.
- Write code the owner can explain line by line. When a planned test turns out too complex,
  record it as deferred in the feature's report and move on; do not let it block the feature.

## Commands

All run from the repository root:

| Command | Purpose |
|---|---|
| `pnpm build` | `tsc -b` across all packages (this is also the typecheck) |
| `pnpm build:watch` | Incremental rebuild on change |
| `pnpm clean` | `tsc -b --clean` |
| `pnpm test` / `pnpm test:watch` | Vitest |
| `pnpm lint` | Biome check (lint + format, read-only) |
| `pnpm lint:fix` | Biome check with `--write` |

Every commit must pass `pnpm build`, `pnpm lint` and `pnpm test`.

## Layout

pnpm workspace with three packages: `packages/data`, `packages/engine` and `packages/tui` (which
provides the `littletavern` binary). The dependency rules between them are in the constitution.

## Commits

- Work directly on `main`.
- **Commit messages are always in English**, whatever language the conversation uses.
- Use a conventional prefix: `feat:`, `fix:`, `docs:`, `build:`, `chore:`, `test:`, `refactor:`.
