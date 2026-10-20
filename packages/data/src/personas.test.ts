import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import { ensureImportFolders, resolveAppPaths } from "./paths.ts";
import {
  createPersonaFromDraft,
  listPersonas,
  PERSONA_TEMPLATE,
  parsePersona,
  readActivePersona,
} from "./personas.ts";
import { writeSettings } from "./settings.ts";

let home: string;
let paths: ReturnType<typeof resolveAppPaths>;
beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "lt-personas-"));
  paths = resolveAppPaths({ LITTLETAVERN_HOME: home });
  ensureImportFolders(paths);
});
afterEach(() => rmSync(home, { recursive: true, force: true }));

it("ships exactly the contracted template", () => {
  const contract = readFileSync("specs/008-persona/contracts/persona.md", "utf8");
  expect(PERSONA_TEMPLATE).toBe(contract.split("```markdown\n")[1]?.split("```")[0]);
});
it("parses sections, strips comments and keeps non-Latin content, macros and inner whitespace", () => {
  expect(
    parsePersona(
      "## NAME\n旅人\n## Description\n\n  {{user}} knows {{char}}.\n\n<!-- hidden -->\n  遠い港  \n",
    ),
  ).toEqual({ name: "旅人", description: "  {{user}} knows {{char}}.\n\n\n  遠い港  " });
  expect(parsePersona("## Name\nTraveller\n## Description\n \n")).toEqual({
    name: "Traveller",
    description: "",
  });
  expect(parsePersona(PERSONA_TEMPLATE)).toHaveProperty("error");
  expect(parsePersona("## Name\n  \n")).toHaveProperty("error");
  expect(parsePersona("## Name\nOne\n## nAmE\nTwo")).toHaveProperty("error");
});
it("lists fresh file contents, both same-name personas and invalid files, sorted by name", () => {
  writeFileSync(join(paths.importPersonasDir, "one.md"), "## Name\nTraveller\n");
  writeFileSync(join(paths.importPersonasDir, "two.md"), "## Name\nTraveller\n");
  writeFileSync(join(paths.importPersonasDir, "ada.md"), "## Name\nAda\n");
  writeFileSync(join(paths.importPersonasDir, "invalid.md"), "No sections");
  writeFileSync(join(paths.importPersonasDir, "ignored.json"), "{}");
  mkdirSync(join(paths.importPersonasDir, "folder.md"));
  const items = listPersonas(paths);
  expect(items).toHaveLength(4);
  expect(items.filter((item) => "name" in item).map((item) => item.name)).toEqual([
    "Ada",
    "Traveller",
    "Traveller",
  ]);
  expect(
    items.filter((item) => "name" in item && item.name === "Traveller").map((item) => item.file),
  ).toEqual(["one.md", "two.md"]);
  expect(items.find((item) => item.file === "invalid.md")).toHaveProperty("error");
  writeFileSync(join(paths.importPersonasDir, "one.md"), "## Name\nChanged\n");
  expect(listPersonas(paths)).toContainEqual({ file: "one.md", name: "Changed", description: "" });
});
it("returns an empty list before the persona folder exists", () => {
  rmSync(paths.importPersonasDir, { recursive: true });
  expect(listPersonas(paths)).toEqual([]);
});
it("reads the active file afresh and returns a named notice for missing or invalid files", () => {
  expect(readActivePersona(paths)).toEqual({ persona: null });
  writeSettings(paths, { persona: null });
  expect(readActivePersona(paths)).toEqual({ persona: null });
  writeSettings(paths, { persona: "active.md", userName: "Fallback" });
  expect(readActivePersona(paths)).toMatchObject({
    persona: null,
    notice: expect.stringContaining("active.md"),
  });
  writeFileSync(
    join(paths.importPersonasDir, "active.md"),
    "## Name\nTraveller\n## Description\nA visitor.\n",
  );
  expect(readActivePersona(paths)).toEqual({
    persona: { name: "Traveller", description: "A visitor." },
  });
  writeFileSync(join(paths.importPersonasDir, "active.md"), "No name");
  expect(readActivePersona(paths)).toMatchObject({
    persona: null,
    notice: expect.stringContaining("active.md"),
  });
});
it("moves successful drafts unchanged to unique safe Markdown filenames", () => {
  const draft = join(home, "draft.md");
  const text =
    "<!-- Keep original bytes -->\r\n## Name\r\nTraveller\r\n## Description\r\nA visitor.\r\n";
  for (const file of ["traveller.md", "traveller-2.md"]) {
    writeFileSync(draft, text);
    expect(createPersonaFromDraft(paths, draft)).toEqual({ file });
    expect(existsSync(draft)).toBe(false);
    expect(readFileSync(join(paths.importPersonasDir, file), "utf8")).toBe(text);
  }
});
it("keeps unchanged, invalid and unwritable drafts and reports their outcome", () => {
  const draft = join(home, "draft.md");
  writeFileSync(draft, PERSONA_TEMPLATE);
  expect(createPersonaFromDraft(paths, draft)).toEqual({ cancelled: true });
  expect(readFileSync(draft, "utf8")).toBe(PERSONA_TEMPLATE);
  writeFileSync(draft, "## Description\nKeep this\n");
  expect(createPersonaFromDraft(paths, draft)).toMatchObject({
    error: expect.any(String),
    draftPath: draft,
  });
  expect(readFileSync(draft, "utf8")).toContain("Keep this");
  rmSync(paths.importPersonasDir, { recursive: true });
  writeFileSync(paths.importPersonasDir, "Blocked");
  writeFileSync(draft, "## Name\nTraveller\n");
  expect(createPersonaFromDraft(paths, draft)).toHaveProperty("error");
  expect(existsSync(draft)).toBe(true);
  expect(createPersonaFromDraft(paths, join(home, "missing.md"))).toHaveProperty("error");
});
