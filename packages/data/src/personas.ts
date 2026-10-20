import {
  constants,
  copyFileSync,
  type Dirent,
  mkdirSync,
  readdirSync,
  readFileSync,
  unlinkSync,
} from "node:fs";
import { basename, join } from "node:path";
import { parseMarkdownSections, safeCardFileName } from "./cards/template.ts";
import type { AppPaths } from "./paths.ts";
import { readSettings } from "./settings.ts";

export const PERSONA_TEMPLATE = `<!-- LittleTavern persona. This is you in the story. Fill in the sections, save and close. -->

## Name
<!-- Your name in the story. Used for {{user}}. -->

## Description
<!-- Who you are: appearance, background, how others see you. Sent to the model. -->
`;

export interface Persona {
  name: string;
  description: string;
}

export type PersonaItem = ({ file: string } & Persona) | { file: string; error: string };

export function parsePersona(text: string): Persona | { error: string } {
  const persona: Persona = { name: "", description: "" };
  const seen = new Set<string>();
  for (const { title, key, body } of parseMarkdownSections(text)) {
    if (key !== "name" && key !== "description") continue;
    if (seen.has(key)) return { error: `Duplicate section: ${title}.` };
    seen.add(key);
    persona[key] = body;
  }
  return persona.name.trim() ? persona : { error: "A persona needs a name." };
}

function readPersona(file: string): Persona | { error: string } {
  try {
    return parsePersona(readFileSync(file, "utf8"));
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

export function listPersonas(paths: AppPaths): PersonaItem[] {
  let entries: Dirent[];
  try {
    entries = readdirSync(paths.importPersonasDir, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => ({
      file: entry.name,
      ...readPersona(join(paths.importPersonasDir, entry.name)),
    }))
    .sort((left, right) => {
      const leftName = "name" in left ? left.name : left.file;
      const rightName = "name" in right ? right.name : right.file;
      return leftName.localeCompare(rightName) || left.file.localeCompare(right.file);
    });
}

export function readActivePersona(paths: AppPaths): { persona: Persona | null; notice?: string } {
  const file = readSettings(paths).persona;
  if (!file) return { persona: null };
  const result =
    basename(file) === file && file.endsWith(".md")
      ? readPersona(join(paths.importPersonasDir, file))
      : { error: "Expected a Markdown file name in the personas folder." };
  if ("error" in result)
    return {
      persona: null,
      notice: `Could not use persona ${file}: ${result.error} Using the default user name.`,
    };
  return { persona: result };
}

export function createPersonaFromDraft(
  paths: AppPaths,
  draftPath: string,
): { file: string } | { cancelled: true } | { error: string; draftPath: string } {
  try {
    const text = readFileSync(draftPath, "utf8");
    if (text === PERSONA_TEMPLATE) return { cancelled: true };
    const persona = parsePersona(text);
    if ("error" in persona) return { error: persona.error, draftPath };
    mkdirSync(paths.importPersonasDir, { recursive: true });
    const file = safeCardFileName(persona.name, readdirSync(paths.importPersonasDir), ".md");
    copyFileSync(draftPath, join(paths.importPersonasDir, file), constants.COPYFILE_EXCL);
    unlinkSync(draftPath);
    return { file };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error), draftPath };
  }
}
