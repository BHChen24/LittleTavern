import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import type { AppPaths } from "./paths.ts";

export interface Settings {
  mouse?: boolean;
  examplesAdded?: boolean;
  model?: string;
  userName?: string;
  persona?: string | null;
  loreBudget?: number;
  scanDepth?: number;
  replyReserve?: number;
  lorebookAttachments?: Record<string, string[]>;
}

export interface GenerationSettings {
  temperature?: number;
  topP?: number;
  topK?: number;
  minP?: number;
  repetitionPenalty?: number;
}

export interface RequestSettings {
  replyTokens: number;
  runSpendUsd: number;
  generation: GenerationSettings;
  warnings: string[];
}

/** Request settings are read separately so existing settings consumers stay unchanged. */
export function readRequestSettings(paths: AppPaths): RequestSettings {
  const raw = readFile(paths);
  const warnings: string[] = [];
  function section(name: string): Record<string, unknown> {
    const value = raw[name];
    if (value === undefined) return {};
    if (value && typeof value === "object" && !Array.isArray(value))
      return value as Record<string, unknown>;
    warnings.push(`Ignored ${name} in settings.json: must be an object.`);
    return {};
  }
  function number(
    values: Record<string, unknown>,
    key: string,
    prefix: string,
    valid: (value: number) => boolean,
    rule: string,
  ): number | undefined {
    const value = values[key];
    if (value === undefined) return undefined;
    if (typeof value === "number" && Number.isFinite(value) && valid(value)) return value;
    warnings.push(`Ignored ${prefix}.${key} in settings.json: ${rule}.`);
    return undefined;
  }
  const limits = section("limits");
  const generation = section("generation");
  const result: RequestSettings = {
    replyTokens:
      number(
        limits,
        "replyTokens",
        "limits",
        (n) => Number.isInteger(n) && n >= 0,
        "whole number ≥ 0",
      ) ?? 4096,
    runSpendUsd: number(limits, "runSpendUsd", "limits", (n) => n >= 0, "number ≥ 0") ?? 1,
    generation: {},
    warnings,
  };
  const rules: [keyof GenerationSettings, (value: number) => boolean, string][] = [
    ["temperature", (n) => n >= 0 && n <= 2, "number 0–2"],
    ["topP", (n) => n >= 0 && n <= 1, "number 0–1"],
    ["topK", (n) => Number.isInteger(n) && n >= 1, "whole number ≥ 1"],
    ["minP", (n) => n >= 0 && n <= 1, "number 0–1"],
    ["repetitionPenalty", (n) => n > 0, "number > 0"],
  ];
  for (const [key, valid, rule] of rules) {
    const value = number(generation, key, "generation", valid, rule);
    if (value !== undefined) result.generation[key] = value;
  }
  return result;
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
  if (typeof raw.examplesAdded === "boolean") settings.examplesAdded = raw.examplesAdded;
  if (typeof raw.mouse === "boolean") settings.mouse = raw.mouse;
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
