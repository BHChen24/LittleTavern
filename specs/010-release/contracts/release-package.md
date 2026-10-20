# Contract: Release package, commands and messages

## Package contents (exact allowlist)

The tarball `release/littletavern-<version>.tgz` contains exactly these paths, and nothing else:

```text
package/package.json
package/README.md
package/LICENSE
package/dist/cli.js
package/examples/README.md
package/examples/LICENSE
package/examples/characters/alice.json
package/examples/lorebooks/wonderland.json
```

## Generated manifest (`release/package.json`)

```json
{
  "name": "littletavern",
  "version": "<packages/tui/package.json version>",
  "description": "A terminal app for character-card roleplay, built on pi.",
  "type": "module",
  "bin": { "littletavern": "dist/cli.js" },
  "files": ["dist", "examples"],
  "engines": { "node": ">=22.19.0" },
  "license": "MIT",
  "repository": { "type": "git", "url": "git+https://github.com/BHChen24/LittleTavern.git" },
  "homepage": "https://github.com/BHChen24/LittleTavern#readme",
  "bugs": { "url": "https://github.com/BHChen24/LittleTavern/issues" },
  "keywords": ["roleplay", "character-card", "sillytavern", "tui", "terminal", "llm"],
  "dependencies": { "<third-party dependencies of data, engine and tui>": "<declared range>" }
}
```

npm always includes `package.json`, `README.md` and `LICENSE`, so `files` lists only the folders.

## Repository commands

| Command | Does |
|---|---|
| `pnpm release:build` | `pnpm build`, then `scripts/build-release.mjs`: recreates `release/` and writes `release/littletavern-<version>.tgz` |
| `pnpm release:check [--tag v<version>]` | `release:build`, then `scripts/check-release.mjs`: allowlist, gitleaks on the extracted contents, optional tag check. Exit code 1 on any failure, naming it |

## App and CLI messages

| Situation | Message |
|---|---|
| `/import <anything>` | `Choose a file from the import folders. To import from elsewhere, run: littletavern import <file>` |
| Selected file's real path is outside the import root | `<file name> is outside the import folders.` |
| Not a regular file (app or CLI) | import report with reason `not a regular file` |
| Over 20 MB (app or CLI) | import report with reason `larger than 20 MB` |
| Import folders cannot be created | `Could not create import folders under <importRoot>. You can still import with: littletavern import <file>` |
| First-start examples step failed | `Could not add the example character: <reason>` |

## Command list change

`/import` keeps its description, "Import a card or lorebook from the import folders", and loses its
`[path]` argument hint and its file completion. The row in
`specs/006-usability/contracts/commands.md` is updated, with the note "changed by 010".
