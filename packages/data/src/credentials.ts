import { chmodSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import type { AppPaths } from "./paths.ts";

export interface SavedKeyResult {
  key: string | null;
  warning?: "permissions-too-open";
  error?: string;
}

export function readSavedKey(paths: AppPaths): SavedKeyResult {
  try {
    const mode = statSync(paths.credentialsFile).mode;
    const warning = (mode & 0o077) !== 0 ? ("permissions-too-open" as const) : undefined;
    const data: unknown = JSON.parse(readFileSync(paths.credentialsFile, "utf8"));
    if (!data || typeof data !== "object" || Array.isArray(data))
      return { key: null, warning, error: "Saved credentials must be a JSON object" };
    if ("openrouter" in data && typeof data.openrouter !== "string")
      return { key: null, warning, error: "Saved OpenRouter key must be a string" };
    return { key: "openrouter" in data ? (data.openrouter as string) : null, warning };
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT")
      return { key: null };
    return {
      key: null,
      error: "Could not read saved credentials; the file may be unreadable or malformed",
    };
  }
}

function writeCredentials(paths: AppPaths, data: object): void {
  mkdirSync(paths.configDir, { recursive: true, mode: 0o700 });
  chmodSync(paths.configDir, 0o700);
  // Tighten an existing file before replacing its contents: creation mode alone is insufficient.
  if (existsSync(paths.credentialsFile)) chmodSync(paths.credentialsFile, 0o600);
  writeFileSync(paths.credentialsFile, `${JSON.stringify(data)}\n`, { mode: 0o600 });
}

export function saveKey(paths: AppPaths, key: string): void {
  writeCredentials(paths, { openrouter: key });
}

export function forgetKey(paths: AppPaths): void {
  if (!existsSync(paths.credentialsFile)) return;
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(readFileSync(paths.credentialsFile, "utf8"));
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error();
  } catch {
    throw new Error("Could not read saved credentials to forget the key");
  }
  delete data.openrouter;
  writeCredentials(paths, data);
}
