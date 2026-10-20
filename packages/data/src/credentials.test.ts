import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import { forgetKey, readSavedKey, saveKey } from "./credentials.ts";
import { type AppPaths, resolveAppPaths } from "./paths.ts";

let home: string;
let paths: AppPaths;
beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "lt-credentials-"));
  paths = resolveAppPaths({ LITTLETAVERN_HOME: home });
});
afterEach(() => rmSync(home, { recursive: true, force: true }));
it("saves with private permissions, reads, and forgets the key", () => {
  expect(readSavedKey(paths)).toEqual({ key: null });
  saveKey(paths, "synthetic-key");
  expect(statSync(paths.configDir).mode & 0o777).toBe(0o700);
  expect(statSync(paths.credentialsFile).mode & 0o777).toBe(0o600);
  expect(readSavedKey(paths).key).toBe("synthetic-key");
  forgetKey(paths);
  expect(readSavedKey(paths).key).toBeNull();
  expect(readFileSync(paths.credentialsFile, "utf8")).not.toContain("synthetic-key");
});
it("warns about broad permissions and tightens them on overwrite", () => {
  saveKey(paths, "old-key");
  chmodSync(paths.credentialsFile, 0o644);
  expect(readSavedKey(paths).warning).toBe("permissions-too-open");
  saveKey(paths, "new-key");
  expect(statSync(paths.credentialsFile).mode & 0o777).toBe(0o600);
});
it("reports malformed and unreadable files without echoing contents", () => {
  mkdirSync(paths.configDir, { recursive: true });
  writeFileSync(paths.credentialsFile, "synthetic-secret-invalid-json");
  expect(readSavedKey(paths).error).toBeTruthy();
  expect(readSavedKey(paths).error).not.toContain("synthetic-secret");
  rmSync(paths.credentialsFile);
  mkdirSync(paths.credentialsFile);
  expect(readSavedKey(paths).error).toBeTruthy();
});
it("preserves other fields when forgetting and keeps mode 0600", () => {
  saveKey(paths, "synthetic-key");
  writeFileSync(
    paths.credentialsFile,
    JSON.stringify({ openrouter: "synthetic-key", other: "keep" }),
  );
  forgetKey(paths);
  expect(JSON.parse(readFileSync(paths.credentialsFile, "utf8"))).toEqual({ other: "keep" });
  expect(statSync(paths.credentialsFile).mode & 0o777).toBe(0o600);
});
