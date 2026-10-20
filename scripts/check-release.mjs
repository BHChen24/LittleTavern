import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ALLOWED_FILES = [
  "package/package.json",
  "package/README.md",
  "package/LICENSE",
  "package/dist/cli.js",
  "package/examples/README.md",
  "package/examples/LICENSE",
  "package/examples/characters/alice.json",
  "package/examples/lorebooks/wonderland.json",
];

export function compareContents(files) {
  return [
    ...files
      .filter((file) => !ALLOWED_FILES.includes(file))
      .map((file) => `Unexpected file: ${file}`),
    ...ALLOWED_FILES.filter((file) => !files.includes(file)).map((file) => `Missing file: ${file}`),
  ];
}

function checkRelease(args) {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const release = join(root, "release");
  const { version } = JSON.parse(readFileSync(join(release, "package.json"), "utf8"));
  if (args.length && (args.length !== 2 || args[0] !== "--tag")) {
    throw new Error("Usage: node scripts/check-release.mjs [--tag v<version>]");
  }
  if (args.length && args[1] !== `v${version}`) {
    throw new Error(`Tag ${args[1]} does not match app version v${version}`);
  }
  const tarball = join(release, `littletavern-${version}.tgz`);
  const files = execFileSync("tar", ["-tzf", tarball], { encoding: "utf8" }).trim().split("\n");
  const errors = compareContents(files);
  if (errors.length) throw new Error(errors.join("\n"));
  console.log(`Package contents verified:\n${files.join("\n")}`);
  const contents = join(release, "package-contents");
  rmSync(contents, { recursive: true, force: true });
  mkdirSync(contents, { recursive: true });
  execFileSync("tar", ["-xzf", tarball, "-C", contents]);
  execFileSync("gitleaks", ["dir", "--redact", "--no-banner", contents], { stdio: "inherit" });
  console.log(`Release package v${version} passed contents and secret checks.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    checkRelease(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
