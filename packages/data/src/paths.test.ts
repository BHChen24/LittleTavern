import { join } from "node:path";
import { expect, it } from "vitest";
import { resolveAppPaths } from "./paths.ts";

it("puts all application files under the explicit home", () => {
  const paths = resolveAppPaths({ LITTLETAVERN_HOME: "/tmp/lt-path-test" });
  expect(paths.configDir).toBe("/tmp/lt-path-test/config");
  expect(paths.dataDir).toBe("/tmp/lt-path-test/data");
  expect(paths.logDir).toBe("/tmp/lt-path-test/log");
  expect(paths.credentialsFile).toBe(join(paths.configDir, "credentials.json"));
  expect(paths.usageLedgerFile).toBe(join(paths.dataDir, "usage.jsonl"));
  expect(paths.logFile).toBe(join(paths.logDir, "littletavern.log"));
});
