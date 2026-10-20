import type { ImportReport, LibraryItem, LorebookEntry } from "@littletavern/engine";

export const EMPTY_LIBRARY_HINT =
  'Library is empty. Put cards in the import folders and use /import, or run "littletavern import <file>".';

function entries(item: LibraryItem): LorebookEntry[] {
  return item.kind === "character"
    ? (item.character.lorebook?.entries ?? [])
    : item.lorebook.entries;
}
function shorten(text: string, length: number): string {
  const characters = Array.from(text);
  return characters.length > length ? `${characters.slice(0, length).join("")}…` : text;
}

export function formatImportReport(report: ImportReport): string[] {
  if (!report.ok) return [`✗ ${report.file} — ${report.reason}`];
  const item = report.item;
  if (report.status === "already-imported")
    return [`• Already imported: "${item.name}" [id ${item.id}]`];
  const lines = [
    `✓ Imported "${item.name}" — ${item.format}, ${entries(item).length} lorebook entries  [id ${item.id}]`,
  ];
  if (item.preservedUnused.length)
    lines.push(`  Preserved, not used: ${item.preservedUnused.join(", ")}`);
  lines.push(...item.warnings.map((warning) => `  Warning: ${warning}`));
  return lines;
}

export function formatLibraryList(items: readonly LibraryItem[]): string[] {
  if (!items.length) return [EMPTY_LIBRARY_HINT];
  const lines: string[] = [];
  for (const kind of ["character", "lorebook"] as const) {
    const group = items.filter((item) => item.kind === kind);
    lines.push(`${kind === "character" ? "Characters" : "Lorebooks"} (${group.length})`);
    for (const item of group)
      lines.push(
        `  ${item.id}  ${item.name}  ${item.format}  ${entries(item).length} entries  ${item.importedAt.slice(0, 10)}`,
      );
  }
  return lines;
}

export function formatItemDetails(item: LibraryItem): string[] {
  const lines = [
    item.name,
    `Format: ${item.format}`,
    `Id: ${item.id}`,
    `Imported: ${item.importedAt}`,
    `Source: ${item.sourceFileName}`,
  ];
  if (item.kind === "character") {
    const character = item.character;
    const fields: [string, string][] = [
      ["Description", character.description],
      ["Personality", character.personality],
      ["Scenario", character.scenario],
      ["First message", character.firstMessage],
      ["Example messages", character.exampleMessages],
      ["System prompt", character.systemPrompt],
      ["Post-history instructions", character.postHistoryInstructions],
      ["Creator notes", character.creatorNotes],
      ["Tags", character.tags.join(", ")],
      ["Creator", character.creator],
      ["Character version", character.characterVersion],
    ];
    for (const [label, text] of fields) if (text) lines.push(`${label}: ${shorten(text, 200)}`);
    lines.push(`Alternate greetings: ${character.alternateGreetings.length}`);
  } else if (item.lorebook.description)
    lines.push(`Description: ${shorten(item.lorebook.description, 200)}`);
  const bookEntries = entries(item);
  lines.push(`Lorebook entries: ${bookEntries.length}`);
  for (const entry of bookEntries)
    lines.push(
      `[${entry.enabled ? "on" : "off"}]${entry.constant ? " [const]" : ""} order=${entry.insertionOrder} keys=${entry.keys.join(", ")} — ${shorten(entry.content, 60)}`,
    );
  if (item.preservedUnused.length)
    lines.push(`Preserved, not used: ${item.preservedUnused.join(", ")}`);
  if (item.warnings.length)
    lines.push("Warnings:", ...item.warnings.map((warning) => `  ${warning}`));
  return lines;
}
export function formatLimits(
  replyTokens: number,
  runSpendUsd: number,
  settingsFile: string,
): string {
  const reply = replyTokens > 0 ? `replies up to ${replyTokens} tokens` : "replies not capped";
  const spend = runSpendUsd > 0 ? `$${runSpendUsd.toFixed(2)} per run` : "spending not capped";
  return `Limits: ${reply}, ${spend}. Change them in ${settingsFile}.`;
}
