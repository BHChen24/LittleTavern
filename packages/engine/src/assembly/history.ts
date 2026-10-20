import { estimateTokens } from "./tokens.ts";
import type { HistoryMessage } from "./types.ts";

export function fitHistory(
  history: HistoryMessage[],
  availableTokens: number,
): { kept: HistoryMessage[]; leftOut: number; overflow: boolean } {
  const kept: HistoryMessage[] = [];
  let used = 0;
  for (let index = history.length - 1; index >= 0; index--) {
    const message = history[index];
    if (!message) continue;
    const tokens = estimateTokens(message.text);
    if (kept.length && used + tokens > availableTokens) break;
    kept.push({ ...message });
    used += tokens;
  }
  kept.reverse();
  return { kept, leftOut: history.length - kept.length, overflow: used > availableTokens };
}
