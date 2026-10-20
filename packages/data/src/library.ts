import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, extname, join } from "node:path";
import { detectFile } from "./cards/detect.ts";
import { isRecord, preservedUnusedFields, toCharacter, toLorebook } from "./cards/normalize.ts";
import type { ImportReport, LibraryItem } from "./cards/types.ts";
import type { AppPaths } from "./paths.ts";

export const MAX_IMPORT_BYTES = 20 * 1024 * 1024;

export function importFile(paths: AppPaths, filePath: string): ImportReport {
  let bytes: Buffer;
  try {
    const info = statSync(filePath);
    const reason = !info.isFile()
      ? "not a regular file"
      : info.size > MAX_IMPORT_BYTES
        ? "larger than 20 MB"
        : null;
    if (reason) return { ok: false, file: filePath, detected: "unreadable file", reason };
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

export function listLibrary(paths: AppPaths): LibraryItem[] {
  const items: LibraryItem[] = [];
  for (const group of ["characters", "lorebooks"]) {
    const directory = join(paths.dataDir, "library", group);
    let names: string[];
    try {
      names = readdirSync(directory);
    } catch {
      continue;
    }
    for (const name of names) {
      if (name.startsWith(".tmp-")) continue;
      try {
        const item: LibraryItem = JSON.parse(
          readFileSync(join(directory, name, "item.json"), "utf8"),
        );
        if (
          isRecord(item) &&
          item.v === 1 &&
          typeof item.id === "string" &&
          typeof item.importedAt === "string" &&
          typeof item.name === "string" &&
          (item.kind === "character" || item.kind === "lorebook")
        ) {
          items.push(item);
        }
      } catch {
        /* Unreadable or malformed items are skipped. */
      }
    }
  }
  return items.sort((left, right) => left.importedAt.localeCompare(right.importedAt));
}

export function getItem(paths: AppPaths, idOrPrefix: string): LibraryItem | "ambiguous" | null {
  const items = listLibrary(paths);
  const exact = items.find((item) => item.id === idOrPrefix);
  if (exact) return exact;
  const matches = items.filter((item) => item.id.startsWith(idOrPrefix));
  if (matches.length > 1) return "ambiguous";
  return matches[0] ?? null;
}
