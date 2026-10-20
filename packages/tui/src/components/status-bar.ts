import { Text, truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import type { SessionTotals } from "@littletavern/engine";
import { stripControls } from "../sanitize.ts";

export interface StatusInfo {
  model: string;
  keySource: string;
  character?: string;
  totals?: SessionTotals;
}

/** Share of prompt tokens served from the provider's cache (pi-ai excludes them from input). */
function cacheHitPercent(totals: SessionTotals): number {
  const prompt = totals.inputTokens + totals.cacheReadTokens + totals.cacheWriteTokens;
  return prompt === 0 ? 0 : Math.round((totals.cacheReadTokens / prompt) * 100);
}

function cost(totals: SessionTotals): string {
  return `$${totals.cost.toFixed(4)}${totals.incomplete ? "~" : ""}`;
}

/** One line: labelled when it fits, the compact form when the terminal is narrow. */
export class StatusBar extends Text {
  private info: StatusInfo;

  constructor(info: StatusInfo) {
    super("");
    this.info = info;
    this.update(info);
  }

  update(info: StatusInfo): void {
    this.info = info;
    this.setText(this.labelled());
  }

  private labelled(): string {
    const { character, model, keySource, totals } = this.info;
    const parts = [
      ...(character ? [`Character: ${character}`] : []),
      `Model: ${model}`,
      `Key: ${keySource}`,
    ];
    if (totals?.requests) {
      parts.push(`Tokens: ${totals.inputTokens} in / ${totals.outputTokens} out`);
      parts.push(`Cache: ${cacheHitPercent(totals)}%`);
      parts.push(cost(totals));
    }
    return stripControls(parts.join(" | "));
  }

  private compact(): string {
    const { character, model, keySource, totals } = this.info;
    const usage = totals?.requests
      ? `${totals.inputTokens}/${totals.outputTokens} | ${cost(totals)}`
      : "—";
    return stripControls(
      `${character ? `${character} | ` : ""}${model} | Key: ${keySource} | ${usage}`,
    );
  }

  override render(width: number): string[] {
    const labelled = this.labelled();
    if (visibleWidth(labelled) <= width) return [labelled];
    return [truncateToWidth(this.compact(), Math.max(0, width))];
  }
}
