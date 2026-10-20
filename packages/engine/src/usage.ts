import { scrubSecrets, type UsageRecord } from "@littletavern/data";
import type { TurnResult } from "./chat-session.ts";
import type { ModelPrice } from "./models.ts";

export interface SessionTotals {
  requests: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  cost: number;
  incomplete: boolean;
}

export function toUsageRecord(
  turn: TurnResult,
  options: {
    sessionId: string;
    modelPrice: ModelPrice | null;
    secrets: readonly string[];
  },
): UsageRecord {
  const unknownTokens = turn.outcome !== "completed" && turn.usage.totalTokens === 0;
  const price = options.modelPrice;
  const knownPrice = price !== null && (price.inputPerMTok !== 0 || price.outputPerMTok !== 0);
  return {
    v: 1,
    timestamp: turn.startedAt,
    sessionId: options.sessionId,
    provider: "openrouter",
    model: turn.model,
    outcome: turn.outcome,
    inputTokens: unknownTokens ? null : turn.usage.input,
    outputTokens: unknownTokens ? null : turn.usage.output,
    cacheReadTokens: unknownTokens ? null : turn.usage.cacheRead,
    cacheWriteTokens: unknownTokens ? null : turn.usage.cacheWrite,
    reasoningTokens: unknownTokens ? null : (turn.usage.reasoning ?? null),
    cost: knownPrice ? { ...turn.usage.cost } : null,
    durationMs: turn.durationMs ?? null,
    ...(turn.outcome === "error" && turn.errorMessage !== undefined
      ? { error: scrubSecrets(turn.errorMessage, options.secrets) }
      : {}),
  };
}

export function sumUsage(records: readonly UsageRecord[]): SessionTotals {
  const totals: SessionTotals = {
    requests: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    cost: 0,
    incomplete: false,
  };
  for (const record of records) {
    totals.requests++;
    totals.inputTokens += record.inputTokens ?? 0;
    totals.outputTokens += record.outputTokens ?? 0;
    totals.cacheReadTokens += record.cacheReadTokens ?? 0;
    totals.cacheWriteTokens += record.cacheWriteTokens ?? 0;
    totals.cost += record.cost?.total ?? 0;
    totals.incomplete ||=
      record.cost === null ||
      [
        record.inputTokens,
        record.outputTokens,
        record.cacheReadTokens,
        record.cacheWriteTokens,
        record.reasoningTokens,
      ].some((value) => value === null);
  }
  return totals;
}
