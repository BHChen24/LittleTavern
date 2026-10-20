import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ChatSession,
  DEFAULT_MODEL_ID,
  DEFAULT_SYSTEM_PROMPT,
  readSavedKey,
  readUsageRecords,
  resolveAppPaths,
  saveKey,
} from "@littletavern/engine";
import { afterEach, expect, it, vi } from "vitest";
import { createApp } from "./app.ts";

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
});
function fixture(envKey?: string, savedKey?: string) {
  const home = mkdtempSync(join(tmpdir(), "lt-apikey-"));
  const paths = resolveAppPaths({ LITTLETAVERN_HOME: home });
  if (savedKey) saveKey(paths, savedKey);
  const app = createApp({
    paths,
    env: { LITTLETAVERN_HOME: home, OPENROUTER_API_KEY: envKey },
    session: new ChatSession({
      modelId: DEFAULT_MODEL_ID,
      systemPrompt: DEFAULT_SYSTEM_PROMPT,
      getApiKey: () => "synthetic",
      simulated: { replies: ["Hello."] },
    }),
  });
  cleanups.push(async () => {
    await app.quit();
    rmSync(home, { recursive: true, force: true });
  });
  const input = (data: string) => app.tui.getFocusedComponent()?.handleInput?.(data);
  const overlay = () => app.tui.getFocusedComponent()?.render(200).join("\n") ?? "";
  const screen = () => app.tui.children.flatMap((component) => component.render(200)).join("\n");
  return { app, paths, home, input, overlay, screen };
}
it("has no startup prompt and restores messages and regenerate commands without sending", async () => {
  const { app, paths, screen } = fixture();
  expect(screen()).toContain("No API key yet — use /apikey");
  expect(app.tui.getFocusedComponent()).not.toBeUndefined();
  app.enterChat();
  expect(app.tui.getFocusedComponent()).toBe(app.editor);
  app.editor.handleInput("hello");
  app.editor.handleInput("\r");
  await vi.waitFor(() => expect(screen()).toContain("No API key yet. Type /apikey"));
  expect(app.editor.getText()).toBe("hello");
  expect(readUsageRecords(paths.usageLedgerFile)).toHaveLength(0);
  await app.submit("/regenerate");
  expect(app.editor.getText()).toBe("/regenerate");
  expect(readUsageRecords(paths.usageLedgerFile)).toHaveLength(0);
  expect(app.tui.getFocusedComponent()).toBe(app.editor);
});
it("offers only OpenRouter, masks the key and defaults to session only without writing credentials", async () => {
  const { app, paths, home, input, overlay, screen } = fixture();
  app.enterChat();
  await app.submit("/apikey");
  expect(overlay()).toContain("OpenRouter");
  expect(overlay()).not.toContain("Enter a new key");
  expect(overlay()).not.toContain("Forget saved key");
  input("\r");
  input("synthetic-new-key-1234");
  expect(overlay()).not.toContain("synthetic-new-key");
  input("\r");
  const choices = overlay();
  expect(choices.indexOf("Use for this session only")).toBeLessThan(choices.indexOf("Save to"));
  expect(choices).toContain(paths.credentialsFile);
  expect(choices).toContain("readable only by you");
  input("\r");
  expect(overlay()).toContain("Choose a model");
  input("\x1b");
  expect(app.tui.getFocusedComponent()).toBe(app.editor);
  expect(app.tui.hasOverlay()).toBe(false);
  expect(existsSync(paths.credentialsFile)).toBe(false);
  expect(screen()).toContain("Key: session");
  await app.submit("hello");
  expect(screen()).toContain("Hello.");
  expect(readFileSync(paths.usageLedgerFile, "utf8")).not.toContain("synthetic-new-key");
  await app.quit();
  for (const name of readdirSync(home, { recursive: true })) {
    const file = join(home, name);
    if (statSync(file).isFile())
      expect(readFileSync(file, "utf8")).not.toContain("synthetic-new-key-1234");
  }
  expect(readSavedKey(paths).key).toBeNull();
});
it("writes a saved key only when explicitly selected, with mode 0600, and can forget it", async () => {
  const { app, paths, input, overlay, screen } = fixture();
  app.enterChat();
  await app.submit("/apikey");
  input("\r");
  input("synthetic-saved-key");
  input("\r");
  input("\x1b[B");
  input("\r");
  expect(overlay()).toContain("Choose a model");
  input("\x1b");
  expect(readSavedKey(paths).key).toBe("synthetic-saved-key");
  expect(statSync(paths.credentialsFile).mode & 0o777).toBe(0o600);
  await app.submit("/apikey");
  expect(overlay()).toContain("saved");
  input("\r");
  expect(overlay()).toContain("API key (saved)");
  expect(overlay()).toContain("Enter a new key");
  expect(overlay()).toContain("Forget saved key");
  input("\x1b[B");
  input("\r");
  expect(readSavedKey(paths).key).toBeNull();
  expect(screen()).toContain("No API key — /apikey");
  await app.submit("/apikey");
  input("\r");
  expect(overlay()).not.toContain("Forget saved key");
});
it("keeps environment keys active when forgetting a saved key and explains replacement on next launch", async () => {
  const { app, paths, input, overlay, screen } = fixture(
    "synthetic-env-key",
    "synthetic-old-saved-key",
  );
  app.enterChat();
  await app.submit("/apikey");
  expect(overlay()).toContain("environment");
  input("\r");
  input("\x1b[B");
  input("\r");
  expect(readSavedKey(paths).key).toBeNull();
  expect(screen()).toContain("environment key remains active");
  await app.submit("/apikey");
  input("\r");
  expect(overlay()).not.toContain("Forget saved key");
  input("\r");
  input("synthetic-replacement");
  input("\r");
  input("\r");
  expect(screen()).toContain("Key: session");
  expect(screen()).toContain(
    "OPENROUTER_API_KEY in the environment will be used again next launch.",
  );
  expect(readSavedKey(paths).key).toBeNull();
});
it("redirects old key commands and keeps key-free commands available", async () => {
  const { app, input, overlay, screen } = fixture();
  app.enterChat();
  for (const command of ["/key", "/forget-key"]) {
    await app.submit(command);
    expect(screen()).toContain(`${command} was replaced by /apikey.`);
    expect(app.tui.getFocusedComponent()).toBe(app.editor);
  }
  await app.submit("/model");
  expect(overlay()).toContain("Choose a model");
  input("\x1b");
  await app.submit("/help");
  expect(overlay()).toContain("/apikey");
});
it("cancels both the provider list and masked input without changing the active key", async () => {
  const { app, input, screen } = fixture("synthetic-env");
  app.enterChat();
  await app.submit("/apikey");
  input("\x1b");
  expect(app.tui.getFocusedComponent()).toBe(app.editor);
  await app.submit("/apikey");
  input("\r");
  input("\r");
  input("\x1b");
  expect(app.tui.getFocusedComponent()).toBe(app.editor);
  expect(screen()).toContain("Key: environment");
});
