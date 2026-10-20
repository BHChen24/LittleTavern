import { appendFileSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { appendUsageRecord, readUsageRecords, type UsageRecord } from "./usage-ledger.ts";

it("appends one line per record and ignores blank lines and unknown fields", () => {
  const home = mkdtempSync(join(tmpdir(), "lt-ledger-"));
  const file = join(home, "data", "usage.jsonl");
  const record: UsageRecord = {
    v: 1,
    timestamp: "2026-10-19T00:00:00Z",
    sessionId: "test",
    provider: "openrouter",
    model: "openai/gpt-4o-mini",
    outcome: "error",
    inputTokens: null,
    outputTokens: null,
    cacheReadTokens: null,
    cacheWriteTokens: null,
    reasoningTokens: null,
    cost: null,
    durationMs: 10,
  };
  try {
    expect(readUsageRecords(file)).toEqual([]);
    appendUsageRecord(file, record);
    appendUsageRecord(file, record);
    expect(readFileSync(file, "utf8").trim().split("\n")).toHaveLength(2);
    appendFileSync(file, `\n${JSON.stringify({ ...record, future: true })}\n`);
    expect(readUsageRecords(file)).toEqual([record, record, record]);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});
