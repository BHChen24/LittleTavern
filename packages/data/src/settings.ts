import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import type { AppPaths } from "./paths.ts";

export interface Settings {
  model?: string;
}

export function readSettings(paths: AppPaths): Settings {
  try {
    const settings: unknown = JSON.parse(readFileSync(paths.settingsFile, "utf8"));
    if (
      settings &&
      typeof settings === "object" &&
      "model" in settings &&
      typeof settings.model === "string"
    )
      return { model: settings.model };
  } catch {
    /* Missing or malformed settings use defaults. */
  }
  return {};
}

export function writeSettings(paths: AppPaths, settings: Settings): void {
  mkdirSync(paths.configDir, { recursive: true });
  writeFileSync(paths.settingsFile, `${JSON.stringify({ model: settings.model })}\n`);
}
