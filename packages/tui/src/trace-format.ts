import { visibleWidth } from "@earendil-works/pi-tui";
import type { AssembledPrompt, AssemblyTrace, LoreDecision } from "@littletavern/engine";

export interface ReportMeta {
  characterName: string;
  modelId: string;
  loreBudget: number;
}

/**
 * Cuts or pads text to a display width (CJK counts double) without adding escape codes,
 * so dry-run output stays clean when piped to a file.
 */
function fitWidth(text: string, width: number, ellipsis = ""): string {
  let result = text;
  if (visibleWidth(text) > width) {
    result = "";
    for (const character of Array.from(text)) {
      if (visibleWidth(result + character + ellipsis) > width) break;
      result += character;
    }
    result += ellipsis;
  }
  return result + " ".repeat(Math.max(0, width - visibleWidth(result)));
}

/** Not-fired groups, in the order they are shown. */
const GROUP_ORDER: LoreDecision["reason"]["kind"][] = [
  "no-match",
  "budget",
  "disabled",
  "no-keywords",
];

export function reasonText(reason: LoreDecision["reason"]): string {
  switch (reason.kind) {
    case "constant":
      return "always on";
    case "keyword":
      return `keyword \`${reason.key}\` in message ${reason.message}`;
    case "disabled":
      return "disabled";
    case "no-match":
      return `no keyword in the last ${reason.depth} messages`;
    case "no-keywords":
      return "no keywords defined";
    case "budget":
      return "over budget";
  }
}

function entryName(decision: LoreDecision): string {
  const name = decision.entry.trim() || `entry #${decision.index + 1}`;
  const ignored = decision.ignoredFeatures.length
    ? ` (ignored: ${decision.ignoredFeatures.join(", ")})`
    : "";
  return `${decision.lorebook} · ${name}${ignored}`;
}

/** Packs names into lines no wider than `width`, never splitting a name. */
function packNames(names: string[], width: number): string[] {
  const lines: string[] = [];
  let current = "";
  for (const name of names) {
    const candidate = current ? `${current}, ${name}` : name;
    if (current && visibleWidth(candidate) > width) {
      lines.push(`${current},`);
      current = name;
    } else current = candidate;
  }
  if (current) lines.push(current);
  return lines;
}

/** The trace as plain lines; shared by `littletavern dry-run` and the /trace overlay. */
export function formatTraceReport(trace: AssemblyTrace, meta: ReportMeta, width = 80): string[] {
  const fired = trace.lore.filter((decision) => decision.included);
  const notFired = trace.lore.filter((decision) => !decision.included);
  const loreUsed = fired.reduce((sum, decision) => sum + (decision.tokens ?? 0), 0);
  const lines = [
    `${meta.characterName} · ${meta.modelId} · ~${trace.totalTokens} tokens (estimate) · ` +
      `lore ~${loreUsed}/${meta.loreBudget} · history ${trace.history.included} kept, ` +
      `${trace.history.leftOut} left out`,
  ];
  if (trace.notes.length) lines.push(`Notes: ${trace.notes.join("; ")}`);
  lines.push("Parts (estimated tokens)");
  for (const part of trace.parts)
    lines.push(
      `  ${fitWidth(part.source, 13)} ~${part.tokens}${part.detail ? `   ${part.detail}` : ""}`,
    );
  if (trace.lore.length === 0) {
    lines.push("No lorebooks.");
    return lines;
  }
  lines.push(`Lore fired (${fired.length})`);
  if (fired.length === 0) lines.push("  (none)");
  const nameWidth = Math.max(12, Math.min(32, width - 40));
  for (const decision of fired)
    lines.push(
      `  ${fitWidth(entryName(decision), nameWidth, "…")}   ${reasonText(decision.reason)}   ~${decision.tokens ?? 0}`,
    );
  lines.push(`Lore not fired (${notFired.length})`);
  for (const kind of GROUP_ORDER) {
    const group = notFired.filter((decision) => decision.reason.kind === kind);
    const first = group[0];
    if (!first) continue;
    lines.push(`  ${reasonText(first.reason)} (${group.length}):`);
    // Names wrap instead of being cut, so every entry stays visible exactly once.
    for (const line of packNames(group.map(entryName), Math.max(10, width - 4)))
      lines.push(`    ${line}`);
  }
  return lines;
}

/** The assembled request as the model would receive it, for the dry run. */
export function formatAssembledPrompt(prompt: AssembledPrompt): string[] {
  const lines = ["[system]", ...prompt.system.split("\n")];
  for (const message of prompt.history)
    lines.push("", `[${message.role}]`, ...message.text.split("\n"));
  if (prompt.afterHistory) lines.push("", "[after history]", ...prompt.afterHistory.split("\n"));
  return lines;
}
