# Quickstart: validating 003-prompt-assembly

## Automated

```bash
pnpm build && pnpm lint && pnpm test
```

Expected results:

- The assembly tests cover every acceptance scenario in spec.md (SC-001).
- The invariant tests in data-model.md pass.
- When `../test-cards/` exists, the local sample test assembles each sample card with a scripted
  two-message conversation, and every lorebook entry of the card appears in the trace (SC-004).

## Manual

None in this feature. The owner sees the result through 004 (chatting with a character) and 005
(`--dry-run`, `/lore`).

For a quick look before 005 exists, run this from the repository root after `pnpm build`. Run it
as an ES module, for example by saving it as `look.mjs` and running `node look.mjs`:

```js
import { assemblePrompt } from "@littletavern/engine";
// Build an AssemblyInput from a library item (002) and print
// JSON.stringify(result.trace, null, 2).
```
