import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import type { AppPaths } from "./paths.ts";

export interface Settings {
  model?: string;
  userName?: string;
  persona?: string | null;
  loreBudget?: number;
  scanDepth?: number;
  replyReserve?: number;
  lorebookAttachments?: Record<string, string[]>;
}

function readFile(paths: AppPaths): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(readFileSync(paths.settingsFile, "utf8"));
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
      return parsed as Record<string, unknown>;
  } catch {
    /* Missing or malformed settings use defaults. */
  }
  return {};
}

function isAttachments(value: unknown): value is Record<string, string[]> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.values(value).every(
    (ids) => Array.isArray(ids) && ids.every((id) => typeof id === "string"),
  );
}

/** Each field is validated on its own; an invalid field is dropped and the rest still apply. */
export function readSettings(paths: AppPaths): Settings {
  const raw = readFile(paths);
  const settings: Settings = {};
  if (typeof raw.model === "string") settings.model = raw.model;
  if (typeof raw.userName === "string" && raw.userName.trim()) settings.userName = raw.userName;
  if (raw.persona === null || (typeof raw.persona === "string" && raw.persona.trim()))
    settings.persona = raw.persona;
  if (typeof raw.loreBudget === "number" && raw.loreBudget > 0)
    settings.loreBudget = raw.loreBudget;
  if (typeof raw.scanDepth === "number" && Number.isInteger(raw.scanDepth) && raw.scanDepth >= 0)
    settings.scanDepth = raw.scanDepth;
  if (typeof raw.replyReserve === "number" && raw.replyReserve >= 0)
    settings.replyReserve = raw.replyReserve;
  if (isAttachments(raw.lorebookAttachments))
    settings.lorebookAttachments = raw.lorebookAttachments;
  return settings;
}

/** Merges the patch into the existing file, keeping fields this version does not know about. */
export function writeSettings(paths: AppPaths, patch: Settings): void {
  mkdirSync(paths.configDir, { recursive: true });
  const merged = { ...readFile(paths), ...patch };
  writeFileSync(paths.settingsFile, `${JSON.stringify(merged, null, 2)}\n`);
}
