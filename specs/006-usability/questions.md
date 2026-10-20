# Implementation questions: 006-usability

## Manual launch command (T011)

T011 requests `pnpm dev`, but that script loads `.env`. The run rules prohibit reading or using
that file. Conservative resolution: run the same built CLI directly, with `LITTLETAVERN_HOME`
pointing to a temporary folder and `OPENROUTER_API_KEY` removed. No script or environment file
is changed.

## Acceptance script checkout (T012)

The external acceptance script hardcodes the sibling `LittleTavern` checkout and prefers an
installed binary. Conservative resolution: temporary PATH wrappers route its `pnpm build` and
`littletavern` commands to this checkout without editing the script. Its recorded Git branch
still describes the hardcoded sibling checkout; this report identifies the actual tested branch.
The script writes its own acceptance result outside this repository, as requested by T012.
