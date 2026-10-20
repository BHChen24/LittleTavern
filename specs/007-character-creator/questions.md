# Implementation questions

- The checkout has the 006 design artifacts but not its import-path fields or command table. For 007 only, add the required import paths using 006 research R2, and a small command table containing `/new-character` consumed by the existing help. Keep the current chat entry flow; do not implement the rest of 006.
- Duplicate known section headings are unspecified. Reject them with a specific error and preserve the draft, rather than silently losing text. T015 confirms that unknown sections, including repeated headings, must instead be ignored with warnings.
- Filename replacement can leave only hyphens for emoji/punctuation. Trim boundary hyphens before the documented `character` fallback. Existing names are filenames including `.json`; the helper returns a filename including `.json`.
- An unchanged app template is cancelled and kept: the task permits draft deletion only following successful import.
- R1 describes pi's editor implementation as synchronous, but the pinned source uses asynchronous `spawn` with a Windows console-input warning. Follow the explicit task/research requirement to use `spawnSync`; record Windows real-editor behavior as a manual limitation.
