import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { createLogger, scrubSecrets } from "./logger.ts";

it("scrubs every occurrence and ignores empty secrets", () => {
  expect(scrubSecrets("abc abc", ["", "abc"])).toBe("[REDACTED] [REDACTED]");
});

it("keeps keys out of messages, structured fields and errors on disk", () => {
  const dir = mkdtempSync(join(tmpdir(), "lt-log-"));
  try {
    const file = join(dir, "log.txt");
    const key = "synthetic-secret-key";
    const logger = createLogger(file, () => [key]);
    logger.info(`message ${key} ${key}`);
    logger.error(new Error(`failed ${key}`), "request error");
    logger.error(
      { err: new Error(`nested ${key}`), apiKey: key, headers: { authorization: key } },
      "failed",
    );
    logger.flush();
    const logged = readFileSync(file, "utf8");
    expect(logged).not.toContain(key);
    expect(logged).toContain("[REDACTED]");
    expect(logged.trim().split("\n")).toHaveLength(3);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
