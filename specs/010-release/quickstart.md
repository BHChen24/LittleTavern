# Quickstart: validating 010-release

## Automated (implementer)

```bash
pnpm build && pnpm lint && pnpm test
pnpm release:check
bash ../acceptance/run-v1-acceptance.sh --auto-only --repo "$PWD"
```

`pnpm release:check` must list exactly the files in
[contracts/release-package.md](./contracts/release-package.md) and report no secrets.

If the network is available, also run the install smoke test:

```bash
tmp=$(mktemp -d)
npm install --global --prefix "$tmp/prefix" release/littletavern-*.tgz
LITTLETAVERN_HOME="$tmp/home" "$tmp/prefix/bin/littletavern" --version
LITTLETAVERN_HOME="$tmp/home" "$tmp/prefix/bin/littletavern" import "$tmp/prefix/lib/node_modules/littletavern/examples/characters/alice.json"
LITTLETAVERN_HOME="$tmp/home" "$tmp/prefix/bin/littletavern" list
```

## Manual (owner)

1. Run the install smoke test above, then start `LITTLETAVERN_HOME="$tmp/home2" "$tmp/prefix/bin/littletavern"`.
   Alice is in `/characters`; after choosing her, `/lorebooks` shows Wonderland. Add a key and a model, chat about
   the Cheshire Cat and open `/trace`: the Cheshire Cat entry is listed.
2. Quit, delete Alice's file from the import folder, start again: she is not added back.
3. In the app, `/import`: the browser starts at the import root and has no `..` there.
   `/import /etc/passwd` shows the "Choose a file from the import folders" message.
4. `littletavern import ~/Downloads/<a card>.json` still works from a shell.

## Owner checklist: the first release

Do these once, in this order. They are outside the implementer's scope.

1. Review and merge `010-release` into `main`, and push it.
2. Make the repository public: `gh repo edit BHChen24/LittleTavern --visibility public --accept-visibility-change-consequences`.
3. Enable secret scanning and push protection:
   `gh api -X PATCH repos/BHChen24/LittleTavern -f 'security_and_analysis[secret_scanning][status]=enabled' -f 'security_and_analysis[secret_scanning_push_protection][status]=enabled'`.
4. Check that CI passes on every Node version. If 22 or 24 fails, narrow `engines` and the README
   first.
5. Create an npm account with two-factor authentication, then an automation token with publish
   rights. Add it as the repository secret `NPM_TOKEN`: `gh secret set NPM_TOKEN`.
6. Tag and push: `git tag v0.1.0 && git push origin v0.1.0`. The release workflow publishes the
   package and creates the GitHub release.
7. On a clean machine: `npm install -g littletavern`, then follow the README.
