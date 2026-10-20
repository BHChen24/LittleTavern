import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { basename, extname, join } from "node:path";
import { detectFile } from "./cards/detect.ts";
import { preservedUnusedFields, toCharacter, toLorebook } from "./cards/normalize.ts";
import type { ImportReport, LibraryItem } from "./cards/types.ts";
import type { AppPaths } from "./paths.ts";

export function importFile(paths: AppPaths, filePath: string): ImportReport {
  let bytes: Buffer;
  try {
    bytes = readFileSync(filePath);
  } catch {
    return {
      ok: false,
      file: filePath,
      detected: "unreadable file",
      reason: "file not found or not readable",
    };
  }
  const detected = detectFile(bytes, basename(filePath));
  if ("rejected" in detected)
    return { ok: false, file: filePath, detected: detected.detected, reason: detected.reason };
  const normalized =
    detected.kind === "character"
      ? toCharacter(detected.raw.data as Record<string, unknown>)
      : toLorebook(detected.raw, basename(filePath, extname(filePath)));
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const id = sha256.slice(0, 12);
  const library = join(paths.dataDir, "library");
  const group = join(library, detected.kind === "character" ? "characters" : "lorebooks");
  const folder = join(group, id);
  if (existsSync(folder)) {
    try {
      return {
        ok: true,
        status: "already-imported",
        item: JSON.parse(readFileSync(join(folder, "item.json"), "utf8")) as LibraryItem,
      };
    } catch {
      return {
        ok: false,
        file: filePath,
        detected: detected.format,
        reason: "existing library item could not be read",
      };
    }
  }
  const itemBase = {
    v: 1 as const,
    id,
    name: normalized.value.name,
    format: detected.format,
    importedAt: new Date().toISOString(),
    sourceFileName: basename(filePath),
    originalFile: detected.format.endsWith("(PNG)") ? "original.png" : "original.json",
    sha256,
    warnings: normalized.warnings,
    preservedUnused: preservedUnusedFields(detected.raw),
    raw: detected.raw,
  };
  // Normalize separately by kind so consumers receive the matching discriminated value.
  const item: LibraryItem =
    detected.kind === "character"
      ? {
          ...itemBase,
          kind: "character",
          character: normalized.value as ReturnType<typeof toCharacter>["value"],
        }
      : {
          ...itemBase,
          kind: "lorebook",
          lorebook: normalized.value as ReturnType<typeof toLorebook>["value"],
        };
  const hadLibrary = existsSync(library);
  const hadGroup = existsSync(group);
  let temporary: string | undefined;
  try {
    mkdirSync(group, { recursive: true });
    temporary = mkdtempSync(join(library, ".tmp-"));
    writeFileSync(join(temporary, item.originalFile), bytes);
    writeFileSync(join(temporary, "item.json"), `${JSON.stringify(item, null, 2)}\n`);
    renameSync(temporary, folder);
    return { ok: true, status: "imported", item };
  } catch {
    if (temporary) rmSync(temporary, { recursive: true, force: true });
    // Remove only directories we created, and only while they are still empty.
    for (const [directory, existed] of [
      [group, hadGroup],
      [library, hadLibrary],
    ] as const) {
      if (!existed) {
        try {
          rmdirSync(directory);
        } catch {
          /* Leave any existing contents intact. */
        }
      }
    }
    return {
      ok: false,
      file: filePath,
      detected: detected.format,
      reason: "could not write the library item",
    };
  }
}
