import { type Component, truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import type { SessionTotals } from "@littletavern/engine";
import { stripControls } from "../sanitize.ts";
import { messageStyles } from "../theme.ts";

export interface StatusInfo {
  model: string;
  keySource: string;
  character?: string;
  persona?: string;
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

/** The two status components are mounted above the transcript and below the input. */
export class StatusBar implements Component {
  private info: StatusInfo;
  readonly top: Component = { render: (width) => this.renderTop(width), invalidate() {} };
  readonly bottom: Component = { render: (width) => this.renderBottom(width), invalidate() {} };

  constructor(info: StatusInfo) {
    this.info = info;
  }
  update(info: StatusInfo): void {
    this.info = info;
  }
  invalidate(): void {}

  private fit(labelled: string, compact: string, width: number): string {
    const full = stripControls(labelled);
    return visibleWidth(full) <= width
      ? full
      : truncateToWidth(stripControls(compact), Math.max(0, width));
  }

  private renderTop(width: number): string[] {
    const { character, persona, model, keySource } = this.info;
    const key =
      keySource === "none" ? "No API key — /apikey" : `Model: ${model} | Key: ${keySource}`;
    const labels = [
      ...(character ? [`Character: ${character}`] : []),
      ...(persona ? [`Persona: ${persona}`] : []),
      key,
    ];
    const compact = [
      ...(character ? [character] : []),
      ...(persona ? [`Persona: ${persona}`] : []),
      keySource === "none" ? key : `${model} | Key: ${keySource}`,
    ];
    return [this.fit(labels.join(" | "), compact.join(" | "), width)];
  }

  private renderBottom(width: number): string[] {
    const totals = this.info.totals;
    if (!totals?.requests) return [];
    return [
      messageStyles.muted(
        this.fit(
          `Tokens: ${totals.inputTokens} in / ${totals.outputTokens} out | Cache: ${cacheHitPercent(totals)}% | ${cost(totals)}`,
          `${totals.inputTokens}/${totals.outputTokens} | ${cost(totals)}`,
          width,
        ),
      ),
    ];
  }

  render(width: number): string[] {
    return [...this.renderTop(width), ...this.renderBottom(width)];
  }
}
