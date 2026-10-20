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
}

export function resolveAppPaths(
  env: Readonly<Record<string, string | undefined>> = process.env,
): AppPaths {
  const defaults = envPaths("littletavern", { suffix: "" });
  const home = env.LITTLETAVERN_HOME ? resolve(env.LITTLETAVERN_HOME) : undefined;
  const configDir = home ? join(home, "config") : defaults.config;
  const dataDir = home ? join(home, "data") : defaults.data;
  const logDir = home ? join(home, "log") : defaults.log;
  return {
    configDir,
    dataDir,
    logDir,
    credentialsFile: join(configDir, "credentials.json"),
    settingsFile: join(configDir, "settings.json"),
    usageLedgerFile: join(dataDir, "usage.jsonl"),
    logFile: join(logDir, "littletavern.log"),
  };
}
