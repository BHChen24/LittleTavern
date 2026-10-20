import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import envPaths from "env-paths";

export interface AppPaths {
  configDir: string;
  dataDir: string;
  logDir: string;
  credentialsFile: string;
  settingsFile: string;
  usageLedgerFile: string;
  logFile: string;
  importRoot: string;
  importCharactersDir: string;
  importLorebooksDir: string;
}

export function resolveAppPaths(
  env: Readonly<Record<string, string | undefined>> = process.env,
): AppPaths {
  const defaults = envPaths("littletavern", { suffix: "" });
  const home = env.LITTLETAVERN_HOME ? resolve(env.LITTLETAVERN_HOME) : undefined;
  const configDir = home ? join(home, "config") : defaults.config;
  const dataDir = home ? join(home, "data") : defaults.data;
  const logDir = home ? join(home, "log") : defaults.log;
  const importRoot = home ? join(home, "import") : join(homedir(), ".littletavern");
  return {
    importRoot,
    importCharactersDir: join(importRoot, "characters"),
    importLorebooksDir: join(importRoot, "lorebooks"),
    configDir,
    dataDir,
    logDir,
    credentialsFile: join(configDir, "credentials.json"),
    settingsFile: join(configDir, "settings.json"),
    usageLedgerFile: join(dataDir, "usage.jsonl"),
    logFile: join(logDir, "littletavern.log"),
  };
}

export function ensureImportFolders(paths: AppPaths): string | null {
  try {
    mkdirSync(paths.importCharactersDir, { recursive: true });
    mkdirSync(paths.importLorebooksDir, { recursive: true });
    return null;
  } catch {
    return `Could not create import folders under ${paths.importRoot}. You can still use /import <path>.`;
  }
}
