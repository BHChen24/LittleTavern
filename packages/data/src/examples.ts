import { constants, copyFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { importFile } from "./library.ts";
import { type AppPaths, ensureImportFolders } from "./paths.ts";
import { readSettings, type Settings, writeSettings } from "./settings.ts";

/** Adds the shipped examples once; setup failures must never prevent interactive startup. */
export function addExamplesOnce(paths: AppPaths, examplesDir: string | null): { notice?: string } {
  const settings = readSettings(paths);
  if (settings.examplesAdded === true || examplesDir === null) return {};
  const characterFile = join(examplesDir, "characters", "alice.json");
  const lorebookFile = join(examplesDir, "lorebooks", "wonderland.json");
  if (!existsSync(characterFile) || !existsSync(lorebookFile)) return {};

  const patch: Settings = { examplesAdded: true };
  let notice: string | undefined;
  try {
    // createApp reports folder-creation failures once, after this step returns.
    if (!ensureImportFolders(paths)) {
      for (const [source, destination] of [
        [characterFile, join(paths.importCharactersDir, "alice.json")],
        [lorebookFile, join(paths.importLorebooksDir, "wonderland.json")],
      ] as const) {
        try {
          copyFileSync(source, destination, constants.COPYFILE_EXCL);
        } catch (error) {
          if (!(error instanceof Error && "code" in error && error.code === "EEXIST")) throw error;
        }
      }
      const character = importFile(paths, characterFile);
      if (!character.ok) throw new Error(`Alice: ${character.reason}`);
      const lorebook = importFile(paths, lorebookFile);
      if (!lorebook.ok) throw new Error(`Wonderland: ${lorebook.reason}`);
      if (character.item.kind !== "character" || lorebook.item.kind !== "lorebook") {
        throw new Error("the example files have the wrong kind");
      }
      const attachments = settings.lorebookAttachments ?? {};
      const ids = attachments[character.item.id] ?? [];
      patch.lorebookAttachments = {
        ...attachments,
        [character.item.id]: [...new Set([...ids, lorebook.item.id])],
      };
    }
  } catch (error) {
    notice = `Could not add the example character: ${error instanceof Error ? error.message : String(error)}`;
  }
  try {
    writeSettings(paths, patch);
  } catch (error) {
    notice = `Could not add the example character: could not save settings (${error instanceof Error ? error.message : String(error)})`;
  }
  return notice ? { notice } : {};
}
