import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
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
  toolRounds: number;
  generation: GenerationSettings;
  warnings: string[];
}

interface SettingRule {
  rule: string;
  removable: boolean;
  valid(value: unknown): boolean;
}

function numeric(rule: string, removable: boolean, valid: (value: number) => boolean): SettingRule {
  return { rule, removable, valid: (value) => typeof value === "number" && valid(value) };
}

export const SETTING_RULES: Record<string, SettingRule> = {
  "limits.replyTokens": numeric("whole number ≥ 0", false, (n) => Number.isInteger(n) && n >= 0),
  "limits.runSpendUsd": numeric("number ≥ 0", false, (n) => n >= 0),
  "limits.toolRounds": numeric("whole number ≥ 1", false, (n) => Number.isInteger(n) && n >= 1),
  "generation.temperature": numeric("number 0–2", true, (n) => n >= 0 && n <= 2),
  "generation.topP": numeric("number 0–1", true, (n) => n >= 0 && n <= 1),
  "generation.topK": numeric("whole number ≥ 1", true, (n) => Number.isInteger(n) && n >= 1),
  "generation.minP": numeric("number 0–1", true, (n) => n >= 0 && n <= 1),
  "generation.repetitionPenalty": numeric("number > 0", true, (n) => n > 0),
  loreBudget: numeric("number > 0", true, (n) => n > 0),
  scanDepth: numeric("whole number ≥ 0", true, (n) => Number.isInteger(n) && n >= 0),
  replyReserve: numeric("number ≥ 0", true, (n) => n >= 0),
  mouse: { rule: "true or false", removable: false, valid: (value) => typeof value === "boolean" },
};

export function checkSettingChange(setting: string, value: unknown): string | null {
  const rule = Object.hasOwn(SETTING_RULES, setting) ? SETTING_RULES[setting] : undefined;
  if (!rule) return "a supported setting";
  if (value === null && rule.removable) return null;
  if (typeof value === "number" && !Number.isFinite(value)) return rule.rule;
  return rule.valid(value) ? null : rule.rule;
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
  ): number | undefined {
    const value = values[key];
    if (value === undefined) return undefined;
    const rule = checkSettingChange(`${prefix}.${key}`, value);
    if (typeof value === "number" && rule === null) return value;
    warnings.push(
      `Ignored ${prefix}.${key} in settings.json: ${rule ?? SETTING_RULES[`${prefix}.${key}`]?.rule}.`,
    );
    return undefined;
  }
  const limits = section("limits");
  const generation = section("generation");
  const result: RequestSettings = {
    replyTokens: number(limits, "replyTokens", "limits") ?? 4096,
    runSpendUsd: number(limits, "runSpendUsd", "limits") ?? 1,
    toolRounds: number(limits, "toolRounds", "limits") ?? 5,
    generation: {},
    warnings,
  };
  for (const key of ["temperature", "topP", "topK", "minP", "repetitionPenalty"] as const) {
    const value = number(generation, key, "generation");
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
  if (SETTING_RULES.mouse?.valid(raw.mouse)) settings.mouse = raw.mouse as boolean;
  if (typeof raw.model === "string") settings.model = raw.model;
  if (typeof raw.userName === "string" && raw.userName.trim()) settings.userName = raw.userName;
  if (raw.persona === null || (typeof raw.persona === "string" && raw.persona.trim()))
    settings.persona = raw.persona;
  for (const key of ["loreBudget", "scanDepth", "replyReserve"] as const) {
    if (SETTING_RULES[key]?.valid(raw[key])) settings[key] = raw[key] as number;
  }
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

export interface SettingChange {
  setting: string;
  value: number | boolean | null;
}

/** Strict read, exclusive backup, nested changes, then replace the complete file. */
export function updateSettings(
  paths: AppPaths,
  changes: SettingChange[],
): { backupPath: string | null } {
  for (const { setting, value } of changes) {
    const rule = checkSettingChange(setting, value);
    if (rule) throw new Error(`${setting} must be ${rule}.`);
  }
  let original: Buffer | undefined;
  try {
    original = readFileSync(paths.settingsFile);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  let parsed: Record<string, unknown> = {};
  if (original) {
    try {
      const value: unknown = JSON.parse(original.toString("utf8"));
      if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
      parsed = value as Record<string, unknown>;
    } catch {
      throw new Error("settings.json is not valid JSON. Fix or remove it first.");
    }
  }
  mkdirSync(paths.configDir, { recursive: true });
  let backupPath: string | null = null;
  if (original) {
    const directory = join(paths.configDir, "backups");
    mkdirSync(directory, { recursive: true });
    const timestamp = new Date()
      .toISOString()
      .replace(/[-:]/g, "")
      .replace("T", "-")
      .replace(".", "-")
      .replace("Z", "");
    for (let suffix = 0; ; suffix++) {
      const candidate = join(directory, `settings-${timestamp}${suffix ? `-${suffix}` : ""}.json`);
      try {
        writeFileSync(candidate, original, { flag: "wx" });
        backupPath = candidate;
        break;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      }
    }
  }
  for (const { setting, value } of changes) {
    const [section, key] = setting.split(".");
    if (!section) continue;
    let target = parsed;
    if (key) {
      const existing = parsed[section];
      if (!existing || typeof existing !== "object" || Array.isArray(existing))
        parsed[section] = {};
      target = parsed[section] as Record<string, unknown>;
    }
    if (value === null) delete target[key ?? section];
    else target[key ?? section] = value;
  }
  // A failed write must leave the original file intact.
  const temporary = `${paths.settingsFile}.${process.pid}.tmp`;
  try {
    writeFileSync(temporary, `${JSON.stringify(parsed, null, 2)}\n`, { flag: "wx" });
    renameSync(temporary, paths.settingsFile);
  } finally {
    rmSync(temporary, { force: true });
  }
  return { backupPath };
}
