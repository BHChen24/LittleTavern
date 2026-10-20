export const CHARACTER_TEMPLATE = `<!-- LittleTavern character template. Fill in the sections, save and close the editor.
     Only "Name" is required. Delete a section's text to leave it empty. -->

## Name
<!-- The character's name. Used for {{char}}. -->

## Description
<!-- Who the character is: appearance, background, situation. -->

## Personality
<!-- How they think, speak and act. -->

## Scenario
<!-- Where and when the story starts. -->

## First message
<!-- The character's opening line. {{user}} and {{char}} are replaced. -->

## Example dialogue
<!-- Optional. Sample exchanges showing their voice. -->

## System prompt
<!-- Optional. Replaces the default instruction to the model. -->

## Lorebook
<!-- Optional. One "###" block per entry. Keys: comma-separated trigger words.
     "Always on: yes" makes the entry always included. The text below is the entry content.

### Example entry title
Keys: lighthouse, harbor
Always on: no
The lighthouse has been dark for ten years.
-->
`;

const SECTIONS = {
  name: "name",
  description: "description",
  personality: "personality",
  scenario: "scenario",
  "first message": "first_mes",
  "example dialogue": "mes_example",
  "system prompt": "system_prompt",
} as const;

export type CharacterFields = Record<(typeof SECTIONS)[keyof typeof SECTIONS], string>;
export interface TemplateEntry {
  name: string;
  keys: string[];
  constant: boolean;
  content: string;
}
export type ParsedTemplate =
  | { fields: CharacterFields; entries: TemplateEntry[]; warnings: string[] }
  | { error: string };

/** Remove blank boundary lines without trimming any characters from content lines. */
function trimBlankLines(text: string): string {
  if (!text.trim()) return "";
  return text.replace(/^(?:[^\S\n]*\n)+/, "").replace(/(?:\r?\n[^\S\n]*)+$/, "");
}

export function parseMarkdownSections(
  text: string,
): { title: string; key: string; body: string }[] {
  const sections = text.replace(/<!--[\s\S]*?-->/g, "").split(/^## (.+)\r?$/m);
  const result: { title: string; key: string; body: string }[] = [];
  for (let i = 1; i < sections.length; i += 2) {
    const title = sections[i]?.trim() ?? "";
    result.push({ title, key: title.toLowerCase(), body: trimBlankLines(sections[i + 1] ?? "") });
  }
  return result;
}

export function parseCharacterTemplate(text: string): ParsedTemplate {
  const fields: CharacterFields = {
    name: "",
    description: "",
    personality: "",
    scenario: "",
    first_mes: "",
    mes_example: "",
    system_prompt: "",
  };
  const entries: TemplateEntry[] = [];
  const warnings: string[] = [];
  const seen = new Set<string>();
  for (const { title, key: heading, body: content } of parseMarkdownSections(text)) {
    if (heading !== "lorebook" && !Object.hasOwn(SECTIONS, heading)) {
      warnings.push(`Unknown section: ${title}; ignored.`);
      continue;
    }
    if (seen.has(heading)) return { error: `Duplicate section: ${title}.` };
    seen.add(heading);
    if (heading === "lorebook") {
      const blocks = content.split(/^### (.+)\r?$/m);
      for (let j = 1; j < blocks.length; j += 2) {
        const entry: TemplateEntry = {
          name: blocks[j]?.trim() ?? "",
          keys: [],
          constant: false,
          content: "",
        };
        const lines = (blocks[j + 1] ?? "").split(/(?<=\n)/);
        entry.content = trimBlankLines(
          lines
            .filter((line) => {
              const keys = /^keys:\s*(.*?)\s*$/i.exec(line);
              if (keys) {
                entry.keys = (keys[1] ?? "")
                  .split(",")
                  .map((key) => key.trim())
                  .filter(Boolean);
                return false;
              }
              const always = /^always on:\s*(.*?)\s*$/i.exec(line);
              if (always) {
                entry.constant = always[1]?.toLowerCase() === "yes";
                return false;
              }
              return true;
            })
            .join(""),
        );
        if (!entry.keys.length && !entry.constant)
          warnings.push(
            `Lore entry "${entry.name}" has no keys and is not always on; it will never fire.`,
          );
        entries.push(entry);
      }
    } else {
      fields[SECTIONS[heading as keyof typeof SECTIONS]] = content;
    }
  }
  if (!fields.name.trim()) return { error: "A character needs a name." };
  for (const heading of [...Object.keys(SECTIONS), "lorebook"]) {
    if (!seen.has(heading))
      warnings.push(
        `Missing section: ${heading[0]?.toUpperCase()}${heading.slice(1)}; left empty.`,
      );
  }
  return { fields, entries, warnings };
}

export function buildV3Card(fields: CharacterFields, entries: TemplateEntry[], version: string) {
  return {
    spec: "chara_card_v3",
    spec_version: "3.0",
    data: {
      ...fields,
      creator_notes: "",
      tags: [],
      alternate_greetings: [],
      character_book: {
        entries: entries.map((entry, index) => ({
          ...entry,
          enabled: true,
          insertion_order: index,
        })),
      },
      extensions: {
        littletavern: {
          createdWith: `LittleTavern ${version}`,
          createdAt: new Date().toISOString(),
        },
      },
    },
  };
}

export function safeCardFileName(name: string, existingNames: readonly string[]): string {
  const base =
    Array.from(
      name
        .toLowerCase()
        .replace(/[^\p{L}\p{N}_-]/gu, "-")
        .replace(/-+/g, "-"),
    )
      .slice(0, 60)
      .join("")
      .replace(/^-+|-+$/g, "") || "character";
  let candidate = `${base}.json`;
  for (let suffix = 2; existingNames.includes(candidate); suffix++)
    candidate = `${base}-${suffix}.json`;
  return candidate;
}
