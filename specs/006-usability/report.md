# Implementation report: 006-usability

## Manual terminal observations

Ran the built CLI in an isolated PTY with a temporary `LITTLETAVERN_HOME` and no environment
key. Used a synthetic Mira card. The home screen showed the description, Enter and slash hints,
missing-key status and both drop folders. Enter focused the chat editor. Typing `/import` showed
its completion; the browser opened, filtering selected `characters/` then `mira.json`, and the
usual import notice appeared. `/chat <id>` showed `Mira:` and the greeting. Sending `hello`
showed the `·` missing-key notice, left `hello` in the editor, and sent nothing. The status bar
followed the editor's lower border; there was no extra separator or large blank area. Ctrl+C
exited with code 0. User/reply labels are also checked with the simulated provider in tests.

`pnpm dev` was not invoked because its script loads `.env`. The equivalent built CLI was
launched directly; see [questions.md](./questions.md). Final visual acceptance remains owner-side.
