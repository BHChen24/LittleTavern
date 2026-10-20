import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import {
  buildV3Card,
  CHARACTER_TEMPLATE,
  parseCharacterTemplate,
  parseMarkdownSections,
  safeCardFileName,
} from "./template.ts";

it("splits Markdown sections in order, preserving duplicate headings and original spelling", () => {
  expect(
    parseMarkdownSections(
      "Intro\n## Name\n\n  Mira  \n<!-- hidden -->\n## nAmE\nTwo\n## Empty\n \n",
    ),
  ).toEqual([
    { title: "Name", key: "name", body: "  Mira  " },
    { title: "nAmE", key: "name", body: "Two" },
    { title: "Empty", key: "empty", body: "" },
  ]);
});

function parsed(text: string) {
  const result = parseCharacterTemplate(text);
  if ("error" in result) throw new Error(result.error);
  return result;
}

it("ships exactly the contracted template", () => {
  const contract = readFileSync("specs/007-character-creator/contracts/template.md", "utf8");
  expect(CHARACTER_TEMPLATE).toBe(contract.split("```markdown\n")[1]?.split("```")[0]);
});
it("maps every section, removes comments and preserves inner text, whitespace and macros", () => {
  const text = CHARACTER_TEMPLATE.replace("## Name\n", "## NAME\n\n  灯台の守り手  \n")
    .replace(
      "## Description\n",
      `## Description\n\n  Hello {{user}}.\r\n\r\n${"長".repeat(5000)}  \n`,
    )
    .replace("## Personality\n", "## Personality\nQuiet\n")
    .replace("## Scenario\n", "## Scenario\nAt sea\n")
    .replace("## First message\n", "## First message\nHello {{user}}!\n")
    .replace("## Example dialogue\n", "## Example dialogue\n{{char}}: Welcome.\n")
    .replace("## System prompt\n", "## System prompt\nStay in character.\n");
  const result = parsed(text);
  expect(result.fields).toEqual({
    name: "  灯台の守り手  ",
    description: `  Hello {{user}}.\r\n\r\n${"長".repeat(5000)}  `,
    personality: "Quiet",
    scenario: "At sea",
    first_mes: "Hello {{user}}!",
    mes_example: "{{char}}: Welcome.",
    system_prompt: "Stay in character.",
  });
  expect(result.entries).toEqual([]);
  expect(result.warnings).toEqual([]);
});
it("requires a nonblank name and rejects duplicate sections", () => {
  expect(parseCharacterTemplate(CHARACTER_TEMPLATE)).toEqual({
    error: "A character needs a name.",
  });
  expect(parseCharacterTemplate("## Name\n \n")).toHaveProperty("error");
  expect(parseCharacterTemplate("## Name\nOne\n## Name\nTwo")).toEqual({
    error: "Duplicate section: Name.",
  });
  expect(parseCharacterTemplate("## Name\nOne\n## nAmE\nTwo")).toEqual({
    error: "Duplicate section: nAmE.",
  });
  expect(parseCharacterTemplate("## Name\nOne\n## Lorebook\n## LOREBOOK\n")).toEqual({
    error: "Duplicate section: LOREBOOK.",
  });
});
it("warns about missing and unknown sections without consuming unknown content", () => {
  const result = parsed("## Name\nMira\n## Mystery\nIgnored\n");
  expect(result.fields.description).toBe("");
  expect(result.warnings).toContain("Unknown section: Mystery; ignored.");
  expect(result.warnings).toContain("Missing section: Description; left empty.");
  expect(Object.values(result.fields)).not.toContain("Ignored");
});
it.each(["Notes", "nOtEs"])(
  "ignores repeated unknown sections named %s with warnings",
  (heading) => {
    const result = parsed(
      `## Name\nMira\n## Notes\nIgnore one.\n## Description\nKeep this.\n## ${heading}\nIgnore two.\n## First message\nHello {{user}}.\n`,
    );
    expect(result.fields).toMatchObject({
      name: "Mira",
      description: "Keep this.",
      first_mes: "Hello {{user}}.",
    });
    expect(result.warnings.filter((warning) => warning.startsWith("Unknown section:"))).toEqual([
      "Unknown section: Notes; ignored.",
      `Unknown section: ${heading}; ignored.`,
    ]);
    expect(Object.values(result.fields).join("\n")).not.toContain("Ignore");
  },
);
it("parses titled lore entries with case-insensitive metadata and warns about inert entries", () => {
  const result = parsed(
    "## Name\nMira\n## Lorebook\n### Harbor\nkEyS: tea, harbor, \nAlways ON: no\n  {{user}} visits.  \n\nSecond line.\n### World\nAlways on: YES\nThe sea is blue.\n### Unused\nNever fires.",
  );
  expect(result.entries).toEqual([
    {
      name: "Harbor",
      keys: ["tea", "harbor"],
      constant: false,
      content: "  {{user}} visits.  \n\nSecond line.",
    },
    { name: "World", keys: [], constant: true, content: "The sea is blue." },
    { name: "Unused", keys: [], constant: false, content: "Never fires." },
  ]);
  expect(result.warnings).toContain(
    'Lore entry "Unused" has no keys and is not always on; it will never fire.',
  );
});
it("builds the contracted V3 card and records creation provenance", () => {
  const { fields, entries } = parsed(
    "## Name\nMira\n## First message\nWelcome.\n## Lorebook\n### Sea\nAlways on: yes\nBlue.",
  );
  const card = buildV3Card(fields, entries, "0.1.0");
  expect(card).toEqual({
    spec: "chara_card_v3",
    spec_version: "3.0",
    data: {
      ...fields,
      creator_notes: "",
      tags: [],
      alternate_greetings: [],
      character_book: { entries: [{ ...entries[0], enabled: true, insertion_order: 0 }] },
      extensions: {
        littletavern: { createdWith: "LittleTavern 0.1.0", createdAt: expect.any(String) },
      },
    },
  });
  expect(new Date(card.data.extensions.littletavern.createdAt).toISOString()).toBe(
    card.data.extensions.littletavern.createdAt,
  );
});
it("makes safe unique filenames without changing the name in the card", () => {
  expect(safeCardFileName("Mira / Harbor", [])).toBe("mira-harbor.json");
  expect(safeCardFileName("灯台 🌊", [])).toBe("灯台.json");
  expect(safeCardFileName("🌊", [])).toBe("character.json");
  expect(safeCardFileName("", [])).toBe("character.json");
  expect(safeCardFileName("Mira", ["mira.json", "mira-2.json"])).toBe("mira-3.json");
  expect(safeCardFileName("x".repeat(90), [])).toBe(`${"x".repeat(60)}.json`);
});

it("trims whitespace-only fields and lore content, including end-of-file blank lines", () => {
  expect(parsed("## Name\nMira\n## Description\n   ").fields.description).toBe("");
  expect(
    parsed("## Name\nMira\n## Lorebook\n### Empty\nAlways on: yes\n \t ").entries[0]?.content,
  ).toBe("");
  expect(parsed("## Name\nMira\n## Description\r\n  \r\n\t").fields.description).toBe("");
});
