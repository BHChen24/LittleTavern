#!/usr/bin/env node
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  createCharacterFromDraft,
  DEFAULT_ASSEMBLY_SETTINGS,
  dryRun,
  getItem,
  importFile,
  listLibrary,
  readSettings,
  resolveAppPaths,
} from "@littletavern/engine";
import { formatImportReport, formatItemDetails, formatLibraryList } from "./library-format.ts";
import { stripControls } from "./sanitize.ts";
import { formatAssembledPrompt, formatTraceReport } from "./trace-format.ts";
import { VERSION } from "./version.ts";

export const CLI_HELP = `Usage:
  littletavern              Start the terminal chat
  littletavern --version    Print version
  littletavern --help       Print help
  littletavern create <file.md>  Create and import a character from Markdown
  littletavern import <file…>  Import cards or lorebooks
  littletavern list            List the library
  littletavern show <id>       Inspect an item (unique prefix allowed)
  littletavern dry-run <character-id> [--message <text>] [--session <id-or-path>] [--json]
                               Show the next request and its lore trace; sends nothing

Environment:
  OPENROUTER_API_KEY        Overrides a saved key; blank counts as unset
  LITTLETAVERN_HOME         Override config, data and log directories
`;

export async function runCli(
  argv: string[],
  print: (text: string) => void = console.log,
): Promise<number> {
  // Card and lore text is untrusted: never let it reach the terminal with escape sequences.
  const out = (text: string) => print(stripControls(text));
  if (argv.includes("--version")) {
    out(`LittleTavern ${VERSION}`);
    return 0;
  }
  if (argv.includes("--help")) {
    out(CLI_HELP);
    return 0;
  }
  if (argv[0] === "create") {
    if (argv.length !== 2 || !argv[1]) {
      out("Usage: littletavern create <file.md>");
      return 1;
    }
    const result = createCharacterFromDraft(resolveAppPaths(), argv[1], VERSION, {
      keepSource: true,
    });
    if ("error" in result) {
      out(`${result.error} Draft kept at ${result.draftPath}`);
      return 1;
    }
    if ("cancelled" in result) out("Cancelled — the template was not changed.");
    else {
      for (const line of formatImportReport(result)) out(line);
      out(`Created with LittleTavern ${VERSION}.`);
      for (const warning of result.warnings) out(`Warning: ${warning}`);
    }
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
  if (argv[0] === "dry-run") return runDryRun(argv.slice(1), out);
  const { startApp } = await import("./app.ts");
  await startApp();
  return 0;
}

/** `dry-run <character-id> [--message <text>] [--session <id-or-path>] [--json]` */
async function runDryRun(args: string[], out: (text: string) => void): Promise<number> {
  const characterId = args[0];
  const flag = (name: string) => {
    const index = args.indexOf(name);
    return index > 0 ? args[index + 1] : undefined;
  };
  if (!characterId || characterId.startsWith("--")) {
    out("Usage: littletavern dry-run <character-id> [--message <text>] [--session <id>] [--json]");
    return 1;
  }
  const paths = resolveAppPaths();
  const result = await dryRun({
    paths,
    characterId,
    message: flag("--message"),
    session: flag("--session"),
  });
  if (!result.ok) {
    out(result.error);
    return 1;
  }
  if (args.includes("--json")) {
    out(JSON.stringify({ prompt: result.prompt, trace: result.trace }, null, 2));
    return 0;
  }
  const meta = {
    characterName: result.item.name,
    modelId: result.modelId,
    loreBudget: readSettings(paths).loreBudget ?? DEFAULT_ASSEMBLY_SETTINGS.loreBudget,
  };
  for (const notice of result.notices) out(notice);
  if (!flag("--message") && !flag("--session"))
    out("(No message given: this is the opening of a new chat, greeting only.)");
  for (const line of formatTraceReport(result.trace, meta)) out(line);
  out("── Request ──");
  for (const line of formatAssembledPrompt(result.prompt)) out(line);
  return 0;
}

/**
 * True when this file is the program being run. An installed `littletavern` command reaches
 * this file through a symlink, so compare real paths, not the path as typed.
 */
function isEntryPoint(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return realpathSync(entry) === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
}

if (isEntryPoint()) {
  process.exitCode = await runCli(process.argv.slice(2));
}
