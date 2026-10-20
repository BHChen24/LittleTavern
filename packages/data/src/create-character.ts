import { mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildV3Card,
  CHARACTER_TEMPLATE,
  parseCharacterTemplate,
  safeCardFileName,
} from "./cards/template.ts";
import type { ImportReport } from "./cards/types.ts";
import { importFile } from "./library.ts";
import type { AppPaths } from "./paths.ts";

export type CreateCharacterResult =
  | (Extract<ImportReport, { ok: true }> & { warnings: string[] })
  | { cancelled: true }
  | { error: string; draftPath: string };

export function createCharacterFromDraft(
  paths: AppPaths,
  draftPath: string,
  version: string,
  options: { keepSource?: boolean } = {},
): CreateCharacterResult {
  try {
    const text = readFileSync(draftPath, "utf8");
    if (text === CHARACTER_TEMPLATE) return { cancelled: true };
    const parsed = parseCharacterTemplate(text);
    if ("error" in parsed) return { error: parsed.error, draftPath };
    const card = buildV3Card(parsed.fields, parsed.entries, version);
    mkdirSync(paths.importCharactersDir, { recursive: true });
    const file = join(
      paths.importCharactersDir,
      safeCardFileName(parsed.fields.name, readdirSync(paths.importCharactersDir)),
    );
    writeFileSync(file, `${JSON.stringify(card, null, 2)}\n`, { flag: "wx" });
    const report = importFile(paths, file);
    if (!report.ok) return { error: report.reason, draftPath };
    if (!options.keepSource) unlinkSync(draftPath);
    return { ...report, warnings: parsed.warnings };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error), draftPath };
  }
}
