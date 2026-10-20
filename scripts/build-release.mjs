import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = fileURLToPath(new URL("../", import.meta.url));
const release = join(root, "release");
const packages = ["data", "engine", "tui"].map((name) =>
  JSON.parse(readFileSync(join(root, "packages", name, "package.json"), "utf8")),
);
const dependencies = {};
for (const manifest of packages) {
  for (const [name, version] of Object.entries(manifest.dependencies)) {
    if (!name.startsWith("@littletavern/")) dependencies[name] = version;
  }
}
const version = packages[2].version;
rmSync(release, { recursive: true, force: true });
mkdirSync(join(release, "dist"), { recursive: true });
await build({
  entryPoints: [join(root, "packages/tui/dist/cli.js")],
  outfile: join(release, "dist/cli.js"),
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  external: Object.keys(dependencies),
});
writeFileSync(
  join(release, "package.json"),
  `${JSON.stringify(
    {
      name: "littletavern",
      version,
      description: "A terminal app for character-card roleplay, built on pi.",
      type: "module",
      bin: { littletavern: "dist/cli.js" },
      files: ["dist", "examples"],
      engines: { node: ">=22.19.0" },
      license: "MIT",
      repository: { type: "git", url: "git+https://github.com/BHChen24/LittleTavern.git" },
      homepage: "https://github.com/BHChen24/LittleTavern#readme",
      bugs: { url: "https://github.com/BHChen24/LittleTavern/issues" },
      keywords: ["roleplay", "character-card", "sillytavern", "tui", "terminal", "llm"],
      dependencies,
    },
    null,
    2,
  )}\n`,
);
for (const name of ["README.md", "LICENSE", "examples"]) {
  cpSync(join(root, name), join(release, name), { recursive: true });
}
execFileSync("npm", ["pack"], { cwd: release, stdio: "inherit" });
