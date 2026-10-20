// Commit message rules from AGENTS.md: a conventional prefix, and English only.
import { readFileSync } from "node:fs";

const PREFIX = /^(feat|fix|docs|build|chore|test|refactor)(\([\w./-]+\))?!?: \S/;
const NON_ENGLISH_SCRIPT =
  /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;

const lines = readFileSync(process.argv[2], "utf8")
  .split("\n")
  .filter((line) => !line.startsWith("#"));
const subject = lines[0] ?? "";
const errors = [];

if (!PREFIX.test(subject) && !/^(Merge|Revert) /.test(subject)) {
  errors.push(
    `The subject must start with feat:, fix:, docs:, build:, chore:, test: or refactor:. Got: "${subject}"`,
  );
}
if (lines.some((line) => NON_ENGLISH_SCRIPT.test(line))) {
  errors.push("Commit messages must be in English.");
}
if (errors.length > 0) {
  for (const error of errors) console.error(`commit-msg: ${error}`);
  process.exit(1);
}
