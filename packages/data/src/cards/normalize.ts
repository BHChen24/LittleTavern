import type { Character, Lorebook, LorebookEntry } from "./types.ts";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function stringField(data: Record<string, unknown>, field: string, warnings: string[]): string {
  if (typeof data[field] === "string") return data[field];
  if (data[field] !== undefined) warnings.push(`field "${field}" is not a string; ignored`);
  return "";
}
function stringsField(data: Record<string, unknown>, field: string, warnings: string[]): string[] {
  const value = data[field];
  if (Array.isArray(value) && value.every((item) => typeof item === "string")) return [...value];
  if (value !== undefined) warnings.push(`field "${field}" is not a list of strings; ignored`);
  return [];
}
function booleanField(
  data: Record<string, unknown>,
  field: string,
  fallback: boolean,
  warnings: string[],
): boolean {
  if (typeof data[field] === "boolean") return data[field];
  if (data[field] !== undefined) warnings.push(`field "${field}" is not a boolean; ignored`);
  return fallback;
}
function numberField(data: Record<string, unknown>, field: string, warnings: string[]): number {
  const value = data[field];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value !== undefined) warnings.push(`field "${field}" is not a number; ignored`);
  return 0;
}

export function toLorebook(
  raw: Record<string, unknown>,
  fallbackName: string,
): { value: Lorebook; warnings: string[] } {
  const warnings: string[] = [];
  const name = stringField(raw, "name", warnings);
  const description = stringField(raw, "description", warnings);
  const worldInfo = isRecord(raw.entries);
  let sources: unknown[] = [];
  if (Array.isArray(raw.entries)) sources = raw.entries;
  else if (worldInfo)
    sources = Object.entries(raw.entries as Record<string, unknown>)
      .sort(([left], [right]) => Number(left) - Number(right))
      .map(([, entry]) => entry);
  else if (raw.entries !== undefined)
    warnings.push('field "entries" is not a list or object; ignored');
  const entries: LorebookEntry[] = [];
  for (const source of sources) {
    if (!isRecord(source)) {
      warnings.push('field "entries" contains a non-object entry; ignored');
      continue;
    }
    entries.push({
      keys: stringsField(source, worldInfo ? "key" : "keys", warnings),
      secondaryKeys: stringsField(source, worldInfo ? "keysecondary" : "secondary_keys", warnings),
      content: stringField(source, "content", warnings),
      enabled: worldInfo
        ? !booleanField(source, "disable", false, warnings)
        : booleanField(source, "enabled", true, warnings),
      constant: booleanField(source, "constant", false, warnings),
      insertionOrder: numberField(source, worldInfo ? "order" : "insertion_order", warnings),
      name: stringField(source, !worldInfo && source.name != null ? "name" : "comment", warnings),
      source,
    });
  }
  return { value: { name: name.trim() ? name : fallbackName, description, entries }, warnings };
}

export function toCharacter(data: Record<string, unknown>): {
  value: Character;
  warnings: string[];
} {
  const warnings: string[] = [];
  const name = stringField(data, "name", warnings);
  let lorebook: Lorebook | null = null;
  if (isRecord(data.character_book)) {
    const result = toLorebook(data.character_book, name);
    lorebook = result.value;
    warnings.push(...result.warnings);
  } else if (data.character_book != null)
    warnings.push('field "character_book" is not an object; ignored');
  return {
    value: {
      name,
      description: stringField(data, "description", warnings),
      personality: stringField(data, "personality", warnings),
      scenario: stringField(data, "scenario", warnings),
      firstMessage: stringField(data, "first_mes", warnings),
      alternateGreetings: stringsField(data, "alternate_greetings", warnings),
      exampleMessages: stringField(data, "mes_example", warnings),
      systemPrompt: stringField(data, "system_prompt", warnings),
      postHistoryInstructions: stringField(data, "post_history_instructions", warnings),
      creatorNotes: stringField(data, "creator_notes", warnings),
      tags: stringsField(data, "tags", warnings),
      creator: stringField(data, "creator", warnings),
      characterVersion: stringField(data, "character_version", warnings),
      lorebook,
    },
    warnings,
  };
}

export function preservedUnusedFields(raw: Record<string, unknown>): string[] {
  const character = isRecord(raw.data);
  const data = character ? (raw.data as Record<string, unknown>) : raw;
  const mapped = new Set(
    character
      ? [
          "name",
          "description",
          "personality",
          "scenario",
          "first_mes",
          "alternate_greetings",
          "mes_example",
          "system_prompt",
          "post_history_instructions",
          "creator_notes",
          "tags",
          "creator",
          "character_version",
          "character_book",
        ]
      : ["name", "description", "entries"],
  );
  const fields = Object.keys(data).filter((key) => !mapped.has(key) && key !== "extensions");
  if (isRecord(data.extensions))
    fields.push(...Object.keys(data.extensions).map((key) => `extensions.${key}`));
  else if ("extensions" in data) fields.push("extensions");
  return fields;
}
