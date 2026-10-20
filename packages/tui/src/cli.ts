#!/usr/bin/env node
import { pathToFileURL } from "node:url";
import { VERSION } from "./version.ts";

export const CLI_HELP = `Usage:
  littletavern              Start the terminal chat
  littletavern --version    Print version
  littletavern --help       Print help

Environment:
  OPENROUTER_API_KEY        Overrides a saved key; blank counts as unset
  LITTLETAVERN_HOME         Override config, data and log directories
`;

export async function runCli(
  argv: string[],
  out: (text: string) => void = console.log,
): Promise<number> {
  if (argv.includes("--version")) {
    out(`LittleTavern ${VERSION}`);
    return 0;
  }
  if (argv.includes("--help")) {
    out(CLI_HELP);
    return 0;
  }
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await runCli(process.argv.slice(2));
}
