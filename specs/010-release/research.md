# Research: Release v0.1

Verified on 2026-10-20 against branch `010-release` (009 plus the hooks, README and examples
commits) and pi `v1.3.0`.

## R1. Bundling the workspace into one package

- **Decision**: bundle our own code with **esbuild** (`0.28.2`, the latest release, 2026-08-08)
  into a single `release/dist/cli.js`. The entry is the already-built
  `packages/tui/dist/cli.js`. Only `@littletavern/*` is bundled; every third-party package is
  marked external and listed as an ordinary dependency of the published package.
- **Why external**: pi-tui loads native helpers from its own package folder
  (`native-platform.ts`, `getNativeModuleCandidates`), and pino resolves files at run time.
  Bundling them would break both. Keeping them external also keeps the published file small and
  readable.
- **Options**: `bundle: true`, `platform: "node"`, `format: "esm"`, `target: "node22"`,
  `external: [<the runtime dependency names>]`. The entry's `#!/usr/bin/env node` line is kept by
  esbuild. The dynamic `import("./app.js")` in `cli.ts` is inlined into the single file.
- **Install script**: esbuild has a postinstall script, and `pnpm-workspace.yaml` denies install
  scripts. esbuild's JavaScript API finds its binary through the platform-specific optional
  dependency without the script. Add it as a root devDependency and check
  `pnpm exec esbuild --version`. Only if that fails, add `esbuild: true` under `allowBuilds`, with
  a comment, as for the existing entries.
- **Alternatives considered**:
  - publishing `@littletavern/data` and `@littletavern/engine` as separate npm packages: three
    packages to version and publish, and a scope to own;
  - npm `bundleDependencies` with copied workspace folders: no new tool, but npm's handling of a
    bundled package's own dependencies is easy to get wrong and hard to explain.

## R2. The release folder and the manifest

- `scripts/build-release.mjs` (run by `pnpm release:build`, after `pnpm build`) recreates
  `release/` and writes:
  - `release/dist/cli.js` (R1);
  - `release/package.json`, generated (see `contracts/release-package.md`): name `littletavern`,
    the version from `packages/tui/package.json`, `bin`, `type: "module"`, `engines`, `files`,
    `license`, `repository`, `homepage`, `bugs`, `keywords`, and `dependencies` collected from
    the `dependencies` of `packages/{data,engine,tui}/package.json`, excluding `@littletavern/*`,
    with their declared ranges (the pi packages stay exact);
  - copies of `README.md`, `LICENSE` and `examples/`.
- Then it runs `npm pack` inside `release/`, which writes `release/littletavern-<version>.tgz`.
- `release/` is added to `.gitignore`.
- **Version**: `packages/tui/package.json` is the source of truth, because `littletavern --version`
  prints it. `version.ts` reads `../package.json` relative to the built file, so in the release
  layout (`dist/cli.js` → `package.json`) it reads the generated manifest, which carries the same
  version.

## R3. Checking the package

- `scripts/check-release.mjs` (run by `pnpm release:check`, which also runs `release:build`):
  - lists the tarball's files with `tar -tzf` (paths start with `package/`) and compares them with
    the exact allowed list in `contracts/release-package.md`. Any extra or missing file fails the
    check and is named;
  - runs `gitleaks dir --redact --no-banner release/package-contents` on an extracted copy and
    fails on any finding;
  - when a tag is given (`--tag v0.1.0`), fails unless the tag equals `v<version>`.
- The comparison logic is a small exported function, so it can be unit-tested with a list of paths
  and without building a tarball.

## R4. Running the installed package

- The bundle cannot run from `release/` directly: its external dependencies are only resolvable
  after an install. So the install smoke test runs where the network exists, in CI:
  `npm install --global --prefix <tmp> release/littletavern-<version>.tgz`, then, with a temporary
  `LITTLETAVERN_HOME`, `littletavern --version`, `littletavern import <examples>` and
  `littletavern list`.
- Locally, the implementer tries the same command. If the sandbox has no network, they record it
  as deferred to CI and the owner. This is not a reason to stop.

## R5. Examples on first start

- **Where the files are at run time**: the release layout has `dist/cli.js` and `examples/`
  side by side, and the development layout has `packages/tui/dist/cli.js` with `examples/` at the
  repository root. `examplesDir()` in `packages/tui/src/examples-dir.ts` returns the first
  existing directory of `new URL("../examples/", import.meta.url)` and
  `new URL("../../../examples/", import.meta.url)`, or `null`.
- **The step**: `addExamplesOnce(paths, examplesDir)` in `packages/data/src/examples.ts`. It
  never throws; every failure becomes the returned notice.
  1. if `settings.examplesAdded === true`, or `examplesDir` is `null`, or either example file is
     missing from `examplesDir`, return without doing anything (the missing-files case sets no
     marker, per the spec's edge cases);
  2. call `ensureImportFolders(paths)` first, because `createApp` (which also calls it) runs
     later. If it fails, write the marker and return **no** notice: `createApp`'s existing
     import-folder notice is the one notice the spec asks for;
  3. copy `characters/alice.json` and `lorebooks/wonderland.json` into the import folders with an
     exclusive-create copy (`copyFileSync` with `COPYFILE_EXCL`). An existing file of the same
     name is left alone and is not imported;
  4. import both **from `examplesDir`**, not from the copies, with `importFile`. So the library
     always receives the real Alice and Wonderland, whatever is in the import folders.
     `already-imported` counts as success. If either import fails, the notice names it;
  5. add Wonderland's id to `lorebookAttachments[<Alice's id>]`, without duplicates;
  6. write `examplesAdded: true` in every outcome after step 1. If that write fails, return
     `Could not add the example character: could not save settings (<reason>)`; the next start
     tries again, which is harmless because steps 3–5 are idempotent.
  On any other error, return one notice: `Could not add the example character: <reason>`.
- **Who calls it**: `cli.ts`, on the interactive path only, right before `startApp()`. The notice
  is passed into the app and shown like the existing import-folder notice. Subcommands never call
  it. App tests that build the app with `createApp` are therefore unaffected.

## R6. Import limits

- **Both entry points** (`importFile` in `packages/data/src/library.ts`): before reading, `statSync`
  the path, which follows links:
  - not a regular file → `{ ok: false, reason: "not a regular file" }`;
  - `size > MAX_IMPORT_BYTES` (`20 * 1024 * 1024`, exported) →
    `{ ok: false, reason: "larger than 20 MB" }`.
  The largest real sample the owner has is about 0.55 MB, so 20 MB leaves room for large PNG
  cards.
- **App only**:
  - `FileBrowser` gains a `root` (the import root). At the root it lists no `..` entry, and it
    never moves to a directory outside the root;
  - after selection, the app compares `realpathSync(file)` with `realpathSync(importRoot)`. If
    `path.relative` starts with `..` or is absolute, it refuses with
    `<name> is outside the import folders.`;
  - `/import` with any argument shows
    `Choose a file from the import folders. To import from elsewhere, run: littletavern import <file>`
    and imports nothing. The command loses its `argumentHint` and its file-system completion
    (`importCompletions` is deleted from `commands.ts`).
- `ensureImportFolders`' failure notice changes from "You can still use /import <path>." to "You
  can still import with: littletavern import <file>".

## R7. Continuous integration and releases

- **Tested Node.js lines**: the even-numbered release lines 22 (pinned to its minimum, `22.19.0`),
  24 and 26. Odd-numbered lines satisfy `engines` but are not tested separately (spec
  clarification). The secret scan does not depend on Node.js, so it runs once per workflow run.
- **`ci.yml`** (push and pull request): a matrix of Node `22.19.0`, `24` and `26` on
  `ubuntu-latest`. Steps: checkout with full history (`fetch-depth: 0`), `pnpm/action-setup@v4`
  (reads `packageManager`), `actions/setup-node@v5` with the pnpm cache,
  `pnpm install --frozen-lockfile` with `HUSKY=0`, then `pnpm build`, `pnpm lint`, `pnpm test`.
  A separate job, run once on Node 26: install gitleaks 8.30.1 from its GitHub release, verify it
  against the release's checksum file, and run `gitleaks git --redact --no-banner .` on the full
  history. A third job, also once: `pnpm release:check`, then the install smoke test (R4).
- **`release.yml`** (tags `v*`): the same checks, `pnpm release:check --tag "$GITHUB_REF_NAME"`,
  the smoke test, `npm publish release/littletavern-<version>.tgz --provenance --access public`
  with `NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}` and `permissions: id-token: write`, then
  `gh release create "$GITHUB_REF_NAME" release/*.tgz --generate-notes`, with
  `permissions: contents: write`.
- Actions are pinned to major versions (`@v4`, `@v5`). The workflows cannot be run before the
  repository is pushed; locally the implementer only checks that they are valid YAML.
- **Supported Node versions**: `engines.node` is `>=22.19.0`, matching pi. If the CI matrix shows a
  failure on 22 or 24, the owner narrows `engines` and the README (spec edge case); the
  implementer does not guess.

## R8. Facts checked

- pi 1.3.0 packages declare `engines.node >=22.19.0`, and have no optional dependencies.
- Runtime dependencies: `data` uses `env-paths`, `pino` and `yaml`; `engine` uses
  `@earendil-works/pi-agent-core`, `pi-ai` and `pi-coding-agent` (`1.3.0`) and `pino`; `tui` uses
  `@earendil-works/pi-tui` (`1.3.0`).
- `cli.ts` starts with `#!/usr/bin/env node`. `isEntryPoint` compares real paths, so the bundled
  file still runs through npm's bin symlink.
- `importFile` reads with `readFileSync` and no checks; `FileBrowser` offers `..` up to `/`;
  `/import <path>` has completion across the whole file system.
- `ImportReport` returns the `LibraryItem` (with its `id`) both for `imported` and
  `already-imported`, which step 4 of R5 needs.
