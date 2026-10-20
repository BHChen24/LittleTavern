import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { ensureImportFolders, resolveAppPaths } from "./paths.ts";

const homes: string[] = [];
function testHome() {
  const home = mkdtempSync(join(tmpdir(), "lt-paths-"));
  homes.push(home);
  return home;
}
afterEach(() => {
  for (const home of homes.splice(0)) rmSync(home, { recursive: true, force: true });
});
it("puts all application files and import folders under the explicit home", () => {
  const paths = resolveAppPaths({ LITTLETAVERN_HOME: "/tmp/lt-path-test" });
  expect(paths.importRoot).toBe("/tmp/lt-path-test/import");
  expect(paths.importCharactersDir).toBe(join(paths.importRoot, "characters"));
  expect(paths.configDir).toBe("/tmp/lt-path-test/config");
  expect(paths.dataDir).toBe("/tmp/lt-path-test/data");
  expect(paths.logDir).toBe("/tmp/lt-path-test/log");
  expect(paths.credentialsFile).toBe(join(paths.configDir, "credentials.json"));
  expect(paths.usageLedgerFile).toBe(join(paths.dataDir, "usage.jsonl"));
  expect(paths.logFile).toBe(join(paths.logDir, "littletavern.log"));
  expect(paths.importRoot).toBe("/tmp/lt-path-test/import");
  expect(paths.importCharactersDir).toBe(join(paths.importRoot, "characters"));
  expect(paths.importLorebooksDir).toBe(join(paths.importRoot, "lorebooks"));
  expect(paths.importPersonasDir).toBe(join(paths.importRoot, "personas"));
});
it("defaults to the home drop folders without creating them", () => {
  expect(resolveAppPaths({}).importRoot).toBe(join(homedir(), ".littletavern"));
  expect(resolveAppPaths({}).importPersonasDir).toBe(join(homedir(), ".littletavern", "personas"));
});
it("creates missing import folders and leaves existing files intact", () => {
  const paths = resolveAppPaths({ LITTLETAVERN_HOME: testHome() });
  expect(ensureImportFolders(paths)).toBeNull();
  const file = join(paths.importCharactersDir, "card.json");
  writeFileSync(file, "original bytes");
  expect(ensureImportFolders(paths)).toBeNull();
  expect(readFileSync(file, "utf8")).toBe("original bytes");
  expect(existsSync(paths.importLorebooksDir)).toBe(true);
  expect(existsSync(paths.importPersonasDir)).toBe(true);
});
it("returns a notice instead of throwing when the import root is a file", () => {
  const paths = resolveAppPaths({ LITTLETAVERN_HOME: testHome() });
  writeFileSync(paths.importRoot, "keep me");
  expect(ensureImportFolders(paths)).toContain(paths.importRoot);
  expect(readFileSync(paths.importRoot, "utf8")).toBe("keep me");
});
