import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ChatSession,
  DEFAULT_MODEL_ID,
  DEFAULT_SYSTEM_PROMPT,
  importFile,
  readUsageRecords,
  resolveAppPaths,
  saveKey,
  writeSettings,
} from "@littletavern/engine";
import { afterEach, expect, it, vi } from "vitest";
import { createApp } from "./app.ts";

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
});
function fixture({
  key = true,
  model,
  savedKey = false,
}: {
  key?: boolean;
  model?: string;
  savedKey?: boolean;
} = {}) {
  const home = mkdtempSync(join(tmpdir(), "lt-readiness-"));
  const paths = resolveAppPaths({ LITTLETAVERN_HOME: home });
  if (model) writeSettings(paths, { model });
  if (savedKey) saveKey(paths, "synthetic-saved-key");
  const session = new ChatSession({
    modelId: DEFAULT_MODEL_ID,
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    getApiKey: () => "synthetic-key",
    simulated: { replies: ["Ready reply.", "Regenerated reply."] },
  });
  const app = createApp({
    paths,
    env: { OPENROUTER_API_KEY: key ? "synthetic-key" : undefined },
    session,
  });
  cleanups.push(async () => {
    await app.quit();
    rmSync(home, { recursive: true, force: true });
  });
  const input = (text: string) => app.tui.getFocusedComponent()?.handleInput?.(text);
  const screen = () => app.tui.children.flatMap((component) => component.render(160)).join("\n");
  const selectModel = async () => {
    await app.submit("/model");
    input(DEFAULT_MODEL_ID);
    input("\r");
  };
  const card = join(home, "card.json");
  writeFileSync(card, JSON.stringify({ spec: "chara_card_v3", data: { name: "Mira" } }));
  const imported = importFile(paths, card);
  if (!imported.ok) throw new Error(imported.reason);
  app.enterChat();
  return { app, session, paths, screen, input, selectModel, characterId: imported.item.id };
}

it("starts without an overlay and lists every missing step without sending or losing input", async () => {
  const { app, session, paths, screen } = fixture({ key: false });
  const send = vi.spyOn(session, "send");
  expect(app.tui.hasOverlay()).toBe(false);
  expect(app.tui.getFocusedComponent()).toBe(app.editor);
  for (const command of ["/model", "/apikey", "/characters", "/innkeeper"])
    expect(screen()).toContain(command);
  await app.submit("keep my draft");
  expect(app.editor.getText()).toBe("keep my draft");
  expect(screen()).toContain("Chat is disabled");
  expect(screen()).not.toContain("You:");
  expect(screen()).not.toContain("is writing…");
  expect(send).not.toHaveBeenCalled();
  expect(readUsageRecords(paths.usageLedgerFile)).toEqual([]);
  await app.submit("/regenerate");
  expect(app.editor.getText()).toBe("/regenerate");
  expect(screen().match(/Chat is disabled/g)).toHaveLength(1);
  expect(send).not.toHaveBeenCalled();
  await app.submit("/library");
  expect(screen()).toContain("Mira");
});

it("requires an explicit model selection; cancelling the picker leaves chat blocked", async () => {
  const { app, paths, screen, input, selectModel } = fixture({ model: "missing/model" });
  await app.submit("/innkeeper");
  expect(screen()).toContain("No model — /model");
  await app.submit("/model");
  input("\x1b");
  await app.submit("still blocked");
  expect(app.editor.getText()).toBe("still blocked");
  expect(readUsageRecords(paths.usageLedgerFile)).toEqual([]);
  await selectModel();
  await app.submit("hello");
  expect(screen()).toContain("Innkeeper:");
  expect(screen()).toContain("Ready reply.");
  expect(readUsageRecords(paths.usageLedgerFile)).toHaveLength(1);
});

it("accepts a saved model and environment key but requires a mode even after cancelling characters", async () => {
  const { app, paths, screen, input } = fixture({ model: DEFAULT_MODEL_ID });
  await app.submit("/characters");
  input("\x1b");
  await app.submit("not an implicit innkeeper");
  expect(app.editor.getText()).toBe("not an implicit innkeeper");
  expect(readUsageRecords(paths.usageLedgerFile)).toEqual([]);
  await app.submit("/innkeeper");
  await app.submit("hello");
  expect(screen()).toContain("Ready reply.");
});

it("accepts saved credentials and a chosen character and blocks regenerate after the key is forgotten", async () => {
  const { app, session, paths, screen, input, characterId } = fixture({
    key: false,
    model: DEFAULT_MODEL_ID,
    savedKey: true,
  });
  await app.submit("/characters");
  app.tui.getFocusedComponent()?.handleInput?.(`${characterId}`);
  app.tui.getFocusedComponent()?.handleInput?.("\r");
  const generate = vi.spyOn(session, "generate");
  await app.submit("hello");
  expect(generate).toHaveBeenCalledOnce();
  expect(screen()).toContain("Ready reply.");
  expect(screen()).not.toContain("Chat is disabled");
  await app.submit("/apikey");
  input("\r");
  input("Forget saved key");
  input("\r");
  await app.submit("/regenerate");
  expect(generate).toHaveBeenCalledOnce();
  expect(readUsageRecords(paths.usageLedgerFile)).toHaveLength(1);
  expect(app.editor.getText()).toBe("/regenerate");
  expect(screen().match(/Chat is disabled/g)).toHaveLength(1);
  expect(screen()).toContain("No API key yet. Type /apikey");
  expect(screen()).not.toContain("Select a model with /model.");
});

it("keeps a selected character blocked without an API key", async () => {
  const { app, session, paths, characterId } = fixture({ key: false, model: DEFAULT_MODEL_ID });
  await app.submit("/characters");
  app.tui.getFocusedComponent()?.handleInput?.(`${characterId}`);
  app.tui.getFocusedComponent()?.handleInput?.("\r");
  const generate = vi.spyOn(session, "generate");
  await app.submit("keep this character draft");
  expect(generate).not.toHaveBeenCalled();
  expect(app.editor.getText()).toBe("keep this character draft");
  expect(readUsageRecords(paths.usageLedgerFile)).toEqual([]);
});

it("blocks character regeneration until a model is selected and permits it once all setup is complete", async () => {
  const { app, session, paths, screen, selectModel, characterId } = fixture();
  await app.submit("/characters");
  app.tui.getFocusedComponent()?.handleInput?.(`${characterId}`);
  app.tui.getFocusedComponent()?.handleInput?.("\r");
  const generate = vi.spyOn(session, "generate");
  await app.submit("/regenerate");
  expect(generate).not.toHaveBeenCalled();
  expect(app.editor.getText()).toBe("/regenerate");
  await selectModel();
  await app.submit("hello");
  await app.submit("/regenerate");
  expect(generate).toHaveBeenCalledTimes(2);
  expect(screen()).toContain("Regenerated reply.");
  expect(readUsageRecords(paths.usageLedgerFile)).toHaveLength(2);
});

it("adding a session key leaves model and mode selection explicit after cancelling the chained picker", async () => {
  const { app, paths, screen, input, selectModel } = fixture({ key: false });
  await app.submit("/apikey");
  input("\r");
  input("synthetic-session-key");
  input("\r");
  input("\r");
  expect(app.tui.getFocusedComponent()?.render(160).join("\n")).toContain("Choose a model");
  input("\x1b");
  await app.submit("not ready yet");
  expect(app.editor.getText()).toBe("not ready yet");
  expect(screen()).toContain("No model — /model");
  expect(screen()).not.toContain("No API key yet. Type /apikey");
  expect(screen().match(/Chat is disabled/g)).toHaveLength(1);
  expect(readUsageRecords(paths.usageLedgerFile)).toEqual([]);
  await selectModel();
  expect(screen()).not.toContain("Select a model with /model.");
  expect(screen()).toContain("Choose a character with /characters or enter /innkeeper mode.");
  await app.submit("still need a mode");
  expect(app.editor.getText()).toBe("still need a mode");
  expect(readUsageRecords(paths.usageLedgerFile)).toEqual([]);
  await app.submit("/innkeeper");
  await app.submit("hello");
  expect(screen()).toContain("Ready reply.");
  expect(readUsageRecords(paths.usageLedgerFile)).toHaveLength(1);
});

it("removes completed setup steps when the model is selected before the key", async () => {
  const { app, paths, screen, input, selectModel, characterId } = fixture({ key: false });
  await app.submit("/library");
  await selectModel();
  expect(screen()).not.toContain("Select a model with /model.");
  expect(screen()).toContain("No API key yet. Type /apikey");
  expect(screen()).toContain("Characters (1)");
  await app.submit("/apikey");
  input("\r");
  input("synthetic-session-key");
  input("\r");
  input("\r");
  input("\x1b");
  expect(screen()).not.toContain("No API key yet. Type /apikey");
  expect(screen()).not.toContain("Select a model with /model.");
  expect(screen()).toContain("Choose a character with /characters or enter /innkeeper mode.");
  expect(screen().match(/Chat is disabled/g)).toHaveLength(1);
  await app.submit("/characters");
  app.tui.getFocusedComponent()?.handleInput?.(`${characterId}`);
  app.tui.getFocusedComponent()?.handleInput?.("\r");
  expect(screen()).not.toContain("Chat is disabled");
  await app.submit("hello");
  expect(screen()).toContain("Ready reply.");
  expect(readUsageRecords(paths.usageLedgerFile)).toHaveLength(1);
});
