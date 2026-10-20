import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";

export interface UsageRecord {
  v: 1;
  timestamp: string;
  sessionId: string;
  provider: "openrouter";
  model: string;
  outcome: "completed" | "interrupted" | "error";
  inputTokens: number | null;
  outputTokens: number | null;
  cacheReadTokens: number | null;
  cacheWriteTokens: number | null;
  reasoningTokens: number | null;
  cost: {
    total: number;
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
  } | null;
  durationMs: number | null;
  error?: string;
}

export function appendUsageRecord(file: string, record: UsageRecord): void {
  mkdirSync(dirname(file), { recursive: true });
  appendFileSync(file, `${JSON.stringify(record)}\n`);
}

export function readUsageRecords(file: string): UsageRecord[] {
  let content: string;
  try {
    content = readFileSync(file, "utf8");
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return [];
    throw error;
  }
  return content
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => {
      const record = JSON.parse(line) as UsageRecord;
      return {
        v: record.v,
        timestamp: record.timestamp,
        sessionId: record.sessionId,
        provider: record.provider,
        model: record.model,
        outcome: record.outcome,
        inputTokens: record.inputTokens,
        outputTokens: record.outputTokens,
        cacheReadTokens: record.cacheReadTokens,
        cacheWriteTokens: record.cacheWriteTokens,
        reasoningTokens: record.reasoningTokens,
        cost: record.cost,
        durationMs: record.durationMs,
        ...(record.error === undefined ? {} : { error: record.error }),
      };
    });
}
