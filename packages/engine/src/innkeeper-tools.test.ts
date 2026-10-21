import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  importFile,
  readRequestSettings,
  resolveAppPaths,
  saveKey,
  writeSettings,
} from "@littletavern/data";
import { afterEach, expect, it, vi } from "vitest";
import { createInnkeeperTools, type InnkeeperToolContext } from "./innkeeper-tools.ts";

const homes: string[] = [];
afterEach(() => {
  vi.unstubAllEnvs();
  for (const home of homes.splice(0)) rmSync(home, { recursive: true, force: true });
});

function fixture() {
  const home = mkdtempSync(join(tmpdir(), "lt-tools-"));
  homes.push(home);
  const paths = resolveAppPaths({ LITTLETAVERN_HOME: home });
  writeSettings(paths, { userName: "Traveler", model: "openai/gpt-4o-mini" });
  const active = readRequestSettings(paths);
  const context: InnkeeperToolContext = {
    paths,
    help: () => "Commands and folders.",
    requestSettings: () => active,
    confirm: vi.fn(async () => false),
    openChat: vi.fn(),
    applied: vi.fn(),
  };
  const call = async (name: string, args: Record<string, unknown> = {}, signal?: AbortSignal) => {
    const tool = createInnkeeperTools(context).find((item) => item.name === name);
    if (!tool) throw new Error(`Missing tool ${name}`);
    return tool.execute("test-call", args, signal);
  };
  return { home, paths, active, context, call };
}

it("reports active limits and generation, current lore and persona, and never credentials", async () => {
  const f = fixture();
  const secret = "synthetic-key";
  saveKey(f.paths, secret);
  vi.stubEnv("OPENROUTER_API_KEY", secret);
  mkdirSync(f.paths.importPersonasDir, { recursive: true });
  writeFileSync(
    join(f.paths.importPersonasDir, "mira.md"),
    "## Name\nMira\n## Description\nA traveler.\n",
  );
  writeFileSync(
    f.paths.settingsFile,
    JSON.stringify({
      model: "openai/gpt-4o-mini",
      userName: "Traveler",
      persona: "mira.md",
      loreBudget: 42,
      limits: { replyTokens: 99 },
      generation: { temperature: 2 },
      unknownSecret: secret,
    }),
  );
  f.active.generation.temperature = 0.3;
  const result = await f.call("read_settings");
  const text = result.content.map((block) => (block.type === "text" ? block.text : "")).join("");
  expect(JSON.parse(text)).toMatchObject({
    limits: { replyTokens: 4096, runSpendUsd: 1, toolRounds: 5 },
    generation: { temperature: 0.3 },
    loreBudget: 42,
    scanDepth: 2,
    replyReserve: 4000,
    persona: "Mira",
    userName: "Traveler",
  });
  for (const tool of ["read_settings", "list_characters", "list_personas", "get_help"])
    expect(JSON.stringify(await f.call(tool))).not.toContain(secret);
  expect(JSON.stringify(result)).not.toContain(f.paths.credentialsFile);
  expect(JSON.stringify(await f.call("list_personas"))).toContain('"active\\":true');
});

it("lists only characters and returns built-in help", async () => {
  const f = fixture();
  const file = join(f.home, "card.json");
  writeFileSync(
    file,
    JSON.stringify({ spec: "chara_card_v3", data: { name: "Alice", description: "Keeper" } }),
  );
  expect(importFile(f.paths, file).ok).toBe(true);
  expect(JSON.stringify(await f.call("list_characters"))).toContain("Alice");
  expect(await f.call("get_help")).toMatchObject({
    content: [{ type: "text", text: f.context.help() }],
  });
  expect(readFileSync(f.paths.settingsFile, "utf8")).not.toContain("Alice");
});
