# Feature Specification: Release v0.1

**Feature Branch**: `010-release` (stacked on `009-ui-polish`)

**Created**: 2026-10-20

**Status**: Draft

**Input**: Owner: prepare LittleTavern v0.1 for public delivery, so that anyone, including an
interviewer, can install it with one command and start playing straight away. The owner's
decisions from 2026-10-20 are recorded under Clarifications.

## Context

Today LittleTavern can only be installed from a source checkout, and a fresh install has nothing
to play: the sample cards on the owner's machine are third-party AGPL files that cannot be
shipped. The app also lets its `/import` browser walk the whole file system and reads files of any
size. The repository has git hooks (secret scan, lint, commit rules, build and tests) but no
continuous integration, and no defined release process.

This feature makes v0.1 deliverable:

- a published package that installs with one command;
- original example content that is ready on first start;
- an import scope that matches what a roleplay app needs;
- automated checks on every push, and a release process with the same checks plus a check of the
  package itself.

## Clarifications

### Session 2026-10-20

- Q: How is LittleTavern distributed? → A: As the public npm package `littletavern`, installed
  with `npm install -g littletavern`. The source repository will also be public.
- Q: What may the published package contain? → A: Only the built app, the bundled examples, the
  README and the license. No tests, specifications, secrets or third-party samples. The app's own
  internal modules are bundled into it; third-party libraries, including pi, stay ordinary
  dependencies that the package manager installs.
- Q: Which Node.js versions are supported? → A: As broad as pi allows (22.19 and later), provided
  the app's checks pass on them. Versions where they fail are not claimed.
- Q: What may `/import` read inside the app? → A: Only files under the import folders
  (`~/.littletavern` by default). It takes no path argument, cannot navigate above the import
  root, and a file reached through a link must still be inside it. The command-line
  `littletavern import <file>` keeps accepting any path, because the user names the file
  explicitly in a shell.
- Q: Which files can be imported at all? → A: Regular files of at most 20 MB, from both the app and
  the command line. Anything else (directories, devices, pipes, larger files) is refused with a
  clear message, before its contents are read.
- Q: What example content ships? → A: An original **Alice** character card and a **Wonderland**
  lorebook, written from Lewis Carroll's public-domain books and released under CC0. No persona
  example.
- Q: How does a new user get the examples? → A: On the first interactive start they are copied
  into the import folders, imported, and Wonderland is attached to Alice, so the user can chat at
  once. This happens once only: deleting them never brings them back, and existing files with the
  same names are never overwritten.
- Q: Which checks run automatically? → A: On every push and pull request: build, lint, tests and a
  secret scan, on each supported Node.js version. A release is made from a version tag after the
  same checks, plus a check of the package's contents and a secret scan of the package.
- Q: What is out of scope? → A: The innkeeper assistant (feature 011), spend limits, and the owner's
  own one-off actions: making the repository public, creating the npm account and token, and
  approving the first publication. These are documented as an owner checklist.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Install with one command and play at once (Priority: P1)

Someone who has never seen LittleTavern runs `npm install -g littletavern`, then `littletavern`.
After adding an OpenRouter key and choosing a model, they open `/characters` and find Alice
already there, with the Wonderland lorebook attached. They chat with her without importing
anything.

**Why this priority**: This is the point of the release: the interview demo starts from a clean
machine.

**Independent Test**: Install the release package into an empty location with an empty
LittleTavern home, start the app, and check that Alice is listed and has Wonderland attached.

**Acceptance Scenarios**:

1. **Given** a machine with a supported Node.js version, **When** the user installs the package,
   **Then** the `littletavern` command is available and `littletavern --version` prints the
   released version.
2. **Given** a fresh LittleTavern home, **When** the app starts for the first time, **Then** the
   Alice card and the Wonderland lorebook are in the import folders and in the library, and
   Wonderland is attached to Alice.
3. **Given** the examples were added once, **When** the user deletes them and restarts,
   **Then** they do not come back.
4. **Given** the user already has a file named like an example in the import folders, **When**
   the app starts for the first time, **Then** that file is left unchanged.
5. **Given** Alice and Wonderland, **When** the user mentions the Cheshire Cat and opens
   `/trace`, **Then** the trace shows which Wonderland entries were sent and why the others were
   not.

---

### User Story 2 - Import stays inside the import folders (Priority: P1)

Inside the app, the user imports cards only from the LittleTavern import folders. The import
browser starts there and cannot leave. Very large files and things that are not files are refused
before they are read. On the command line, the user can still import a file from anywhere by
naming it.

**Why this priority**: A roleplay app that can browse the whole disk surprises users and makes a
poor demo, and an unbounded read can hang the app.

**Independent Test**: Open `/import`, try to go above the import root, select a link that points
outside it, and import an oversized file. Each is refused. Then import a card from another
directory with `littletavern import <path>`: it works.

**Acceptance Scenarios**:

1. **Given** the import browser at the import root, **When** the user looks for a way up,
   **Then** there is none.
2. **Given** `/import` followed by a path, **When** submitted, **Then** nothing is imported and a
   message explains that the app imports from the import folders and that
   `littletavern import <file>` handles other locations.
3. **Given** a link inside the import folders that points outside them, **When** selected in the
   browser, **Then** it is refused with a message saying the file is outside the import folders.
4. **Given** a file larger than 20 MB, or something that is not a regular file, **When** imported
   from the app or the command line, **Then** it is refused with a message that names the reason,
   and its contents are not read.
5. **Given** a valid card in another directory, **When** imported with `littletavern import`,
   **Then** it is imported as before.

---

### User Story 3 - Every change is checked automatically (Priority: P2)

Every push and pull request runs the build, lint, tests and a secret scan on each supported
Node.js version. The owner sees a failing check before anything reaches a release.

**Why this priority**: The repository is about to become public; checks that only run on the
owner's machine are not enough.

**Independent Test**: Push a branch. The checks run on every supported Node.js version and pass.
A change that breaks a test, or that adds something that looks like a secret, fails them.

**Acceptance Scenarios**:

1. **Given** a push or a pull request, **When** the checks run, **Then** build, lint, tests and a
   full-history secret scan run on each supported Node.js version.
2. **Given** a failing test or a detected secret, **When** the checks run, **Then** they fail and
   say which step failed.

---

### User Story 4 - Releasing is one tag (Priority: P2)

The owner releases by pushing a version tag. The release process runs the same checks, builds the
package, verifies that it contains only the allowed files and no secrets, publishes it to npm and
creates a GitHub release with the package attached. A tag that does not match the app's version
is refused.

**Why this priority**: A repeatable release keeps the published package trustworthy; manual
publishing is where secrets and stray files slip in.

**Independent Test**: Build the package locally with the release command and run its content
check: it passes for a clean build and fails when a forbidden file is added.

**Acceptance Scenarios**:

1. **Given** a clean checkout, **When** the release package is built locally, **Then** it
   contains only the built app, the examples, the README, the license and the package manifest,
   and the content check and secret scan pass.
2. **Given** a forbidden file in the package (for example a test, a specification, an environment
   file or a third-party sample), **When** the content check runs, **Then** it fails and names the
   file.
3. **Given** a version tag, **When** the release runs, **Then** the package is published only if
   the tag equals the app's version and every check passes.

---

### User Story 5 - The README matches the release (Priority: P3)

The README tells a new user to install with `npm install -g littletavern`, mentions the Alice
example, and moves installing from source into a developer section. An owner checklist describes
the one-off steps before the first release.

**Why this priority**: The README is the first thing an interviewer reads, but it only needs to
change once the rest works.

**Independent Test**: Follow the README's install and quick-start steps on a clean machine; they
work as written.

**Acceptance Scenarios**:

1. **Given** the README, **When** a new user reads the install section, **Then** it shows the npm
   command and the supported Node.js versions.
2. **Given** the owner checklist, **When** the owner prepares the first release, **Then** it lists
   making the repository public, enabling GitHub's secret scanning, creating the npm token secret,
   and tagging the release.

---

### Edge Cases

- The import folders cannot be created or written on first start: the app still starts, shows one
  notice naming the problem, and does not try to add the examples again on later starts.
- The examples are missing from the installed package (a broken install): the app starts normally,
  adds nothing, shows no notice, and does not record the step as done, so a repaired install can
  still add them.
- The user already imported an identical Alice card: importing the example again creates no
  duplicate, and Wonderland is still attached.
- The user starts the app with `LITTLETAVERN_HOME` set: the examples go into that home's import
  folders.
- An existing install upgrades to v0.1: the examples are added once on its next interactive start,
  like a fresh install.
- Command-line subcommands (`import`, `list`, `show`, `dry-run`, `create`) never add the examples;
  only the interactive start does.
- A file in the import folders is replaced between being listed and being imported: the size and
  file-type checks apply at import time.
- A Node.js version inside the supported range fails the checks: it is removed from the supported
  range rather than claimed.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: LittleTavern MUST be installable with `npm install -g littletavern`, which provides
  the `littletavern` command.
- **FR-002**: The published package MUST contain only the built app, the examples, the README, the
  license and its manifest. It MUST NOT contain tests, specifications, environment files, secrets
  or third-party samples.
- **FR-003**: The package MUST declare the supported Node.js versions, which MUST be versions on
  which the automated checks pass, starting no lower than 22.19.
- **FR-004**: On the first interactive start, the app MUST copy the Alice card and the Wonderland
  lorebook into the import folders without overwriting existing files, import both, and attach
  Wonderland to Alice. It MUST record that this was done and MUST NOT repeat it, whether or not it
  succeeded (except when the examples are missing from the install, see Edge Cases). A failure MUST produce one notice that names the reason.
- **FR-005**: Command-line subcommands MUST NOT add the examples.
- **FR-006**: The example card and lorebook MUST be original works based only on public-domain
  text, released under CC0, with a notice saying so shipped next to them.
- **FR-007**: Inside the app, `/import` MUST only offer files under the import root. The browser
  MUST NOT navigate above the import root, `/import` MUST NOT accept a path argument, and a
  selected file whose real location is outside the import root MUST be refused with a message.
- **FR-008**: Every import, from the app or the command line, MUST refuse anything that is not a
  regular file, and any file larger than 20 MB, before reading its contents, with a message that
  names the reason.
- **FR-009**: `littletavern import <file>` MUST keep accepting files at any path, subject to
  FR-008.
- **FR-010**: Messages that currently suggest `/import <path>` MUST suggest the import folders or
  `littletavern import <file>` instead.
- **FR-011**: Every push and pull request MUST run the build, lint, tests and a full-history secret
  scan on each supported Node.js version.
- **FR-012**: A release MUST be triggered by a version tag. It MUST refuse a tag that differs from
  the app's version, run the same checks as FR-011, build the package, check its contents
  (FR-002), scan it for secrets, publish it to npm, and create a GitHub release with the package
  attached.
- **FR-013**: The package's content check and secret scan MUST also be runnable locally with one
  command, without publishing.
- **FR-014**: The README MUST give the npm install command and the supported Node.js versions,
  mention the bundled Alice example, and move installing from source into a developer section.
- **FR-015**: The project MUST document an owner checklist for the first release: making the
  repository public, enabling GitHub secret scanning and push protection, adding the npm token
  secret, and pushing the version tag.

### Key Entities

- **Release package**: the published artifact. Its contents are limited to the allowed set, and
  its version equals the app's version.
- **Examples**: the Alice card and the Wonderland lorebook, with their CC0 notice.
- **Examples-added marker**: a setting recording that the first-start examples step has run.
- **Import root**: the folder that bounds what the app's `/import` can read.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On a clean machine with a supported Node.js version, a new user goes from nothing to
  chatting with Alice in under 5 minutes, using only the install command, `/apikey`, `/model` and
  `/characters`.
- **SC-002**: 100% of files in the release package are on the allowed list, and the package's
  secret scan finds nothing.
- **SC-003**: Inside the app, 0 files outside the import root can be imported, and no import reads
  a file larger than 20 MB.
- **SC-004**: Every push and pull request reports a pass or fail result for each supported Node.js
  version.
- **SC-005**: After the examples have been added once, deleting them and restarting 3 times never
  brings them back.

## Acceptance Testing

Per the constitution's testing policy:

- **Automated**:
  - the import size and file-type checks;
  - the browser's root boundary, the `/import` argument refusal and the link check;
  - adding the examples on first start, once only, without overwriting, including the failure
    notice;
  - the package content check, for a clean package and for one with a forbidden file;
  - the happy path: a simulated first start adds Alice with Wonderland attached, and a simulated
    chat with her sends a request whose trace contains a Wonderland entry.
- **Manual (owner)**: install the built package into an empty location and play with Alice; push a
  branch and read the checks; follow the owner checklist for the first release.

## Assumptions

- The npm package name `littletavern` is still free at release time (it was on 2026-10-20).
- The repository becomes public before the first release, because provenance for npm packages and
  free secret scanning on GitHub both require a public repository.
- OpenRouter remains the only provider in v0.1, as in earlier features.
- The Alice and Wonderland drafts in `examples/` are accepted by the owner; their wording can
  change without affecting this feature's behaviour.
- The installer's network access is available on the user's machine; offline installation is not
  supported.
