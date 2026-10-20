#!/usr/bin/env node
import { pathToFileURL } from "node:url";
import { getItem, importFile, listLibrary, resolveAppPaths } from "@littletavern/engine";
import { formatImportReport, formatItemDetails, formatLibraryList } from "./library-format.ts";
import { VERSION } from "./version.ts";

export const CLI_HELP = `Usage:
  littletavern              Start the terminal chat
  littletavern --version    Print version
  littletavern --help       Print help
  littletavern import <file…>  Import cards or lorebooks
  littletavern list            List the library
  littletavern show <id>       Inspect an item (unique prefix allowed)

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
  if (argv[0] === "import") {
    if (argv.length < 2) {
      out("Usage: littletavern import <file> [<file>…]");
      return 1;
    }
    const paths = resolveAppPaths();
    let failed = false;
    for (const file of argv.slice(1)) {
      const report = importFile(paths, file);
      for (const line of formatImportReport(report)) out(line);
      failed ||= !report.ok;
    }
    return failed ? 1 : 0;
  }
  if (argv[0] === "list") {
    for (const line of formatLibraryList(listLibrary(resolveAppPaths()))) out(line);
    return 0;
  }
  if (argv[0] === "show") {
    if (!argv[1]) {
      out("Usage: littletavern show <id>");
      return 1;
    }
    const item = getItem(resolveAppPaths(), argv[1]);
    if (item === "ambiguous") {
      out(`Ambiguous item prefix: ${argv[1]}`);
      return 1;
    }
    if (!item) {
      out(`Item not found: ${argv[1]}`);
      return 1;
    }
    for (const line of formatItemDetails(item)) out(line);
    return 0;
  }
  const { startApp } = await import("./app.ts");
  await startApp();
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await runCli(process.argv.slice(2));
}
