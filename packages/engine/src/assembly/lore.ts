import type { LorebookEntry } from "../index.ts";
import { replaceMacros } from "./macros.ts";
import { estimateTokens } from "./tokens.ts";
import {
  type AssemblyInput,
  DEFAULT_ASSEMBLY_SETTINGS,
  DEFAULT_USER_NAME,
  type LoreDecision,
} from "./types.ts";

export interface ActivatedLore {
  decision: LoreDecision;
  content: string;
  insertionOrder: number;
}

function extensionsOf(entry: LorebookEntry): Record<string, unknown> {
  const value = entry.source.extensions;
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function numericPosition(entry: LorebookEntry): number | undefined {
  if (typeof entry.source.position === "number") return entry.source.position;
  const position = extensionsOf(entry).position;
  return typeof position === "number" ? position : undefined;
}

export function placementOf(entry: LorebookEntry): "before" | "after" {
  const numeric = numericPosition(entry);
  if (numeric !== undefined) return numeric === 0 ? "before" : "after";
  return entry.source.position === "before_char" ? "before" : "after";
}

export function ignoredFeatures(entry: LorebookEntry): string[] {
  const source = entry.source;
  const extensions = extensionsOf(entry);
  const ignored: string[] = [];
  const secondary = source.secondary_keys ?? source.keysecondary ?? source.secondaryKeys;
  if (Array.isArray(secondary) && secondary.length) ignored.push("secondary keys");
  const keys = source.keys ?? source.key;
  if (
    Array.isArray(keys) &&
    keys.some((key) => typeof key === "string" && /^\/.*\/[a-z]*$/i.test(key))
  )
    ignored.push("regex keys");
  if (
    (typeof source.probability === "number" &&
      source.probability < 100 &&
      source.useProbability !== false) ||
    (typeof extensions.probability === "number" && extensions.probability < 100)
  )
    ignored.push("probability");
  const position = numericPosition(entry);
  if (position !== undefined && position !== 0 && position !== 1)
    ignored.push(`placement ${position}`);
  if (source.scanDepth != null || extensions.scan_depth != null)
    ignored.push("per-entry scan depth");
  if (source.caseSensitive === true || extensions.case_sensitive === true)
    ignored.push("case sensitivity");
  if (source.matchWholeWords === true || extensions.match_whole_words === true)
    ignored.push("whole-word matching");
  return ignored;
}

function reasonFor(
  entry: LorebookEntry,
  scanned: { text: string; message: number }[],
  scanDepth: number,
  names: { char: string; user: string },
): LoreDecision["reason"] {
  if (!entry.enabled) return { kind: "disabled" };
  if (entry.constant) return { kind: "constant" };
  const keys = entry.keys
    .map((key) => replaceMacros(key, names).toLowerCase())
    .filter((key) => key !== "");
  if (!keys.length) return { kind: "no-keywords" };
  for (const message of scanned) {
    for (const key of keys) {
      if (message.text.includes(key)) return { kind: "keyword", key, message: message.message };
    }
  }
  return { kind: "no-match", depth: scanDepth };
}

export function activateLore(input: AssemblyInput): ActivatedLore[] {
  const names = { char: input.character.name, user: input.userName ?? DEFAULT_USER_NAME };
  const scanDepth = input.settings?.scanDepth ?? DEFAULT_ASSEMBLY_SETTINGS.scanDepth;
  const scanned = input.history
    .map((message, index) => ({
      text: replaceMacros(message.text, names).toLowerCase(),
      message: index + 1,
    }))
    .slice(Math.max(0, input.history.length - scanDepth))
    .reverse();
  const books = [
    ...(input.character.lorebook ? [input.character.lorebook] : []),
    ...(input.lorebooks ?? []),
  ];
  return books.flatMap((book) =>
    book.entries.map((entry, index) => {
      const reason = reasonFor(entry, scanned, scanDepth, names);
      const included = reason.kind === "constant" || reason.kind === "keyword";
      const content = replaceMacros(entry.content, names);
      return {
        content,
        insertionOrder: entry.insertionOrder,
        decision: {
          lorebook: book.name,
          index,
          entry: entry.name,
          included,
          reason,
          ...(included ? { placement: placementOf(entry), tokens: estimateTokens(content) } : {}),
          ignoredFeatures: ignoredFeatures(entry),
        },
      };
    }),
  );
}
