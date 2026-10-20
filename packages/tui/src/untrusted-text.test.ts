import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Terminal } from "@earendil-works/pi-tui";
import {
  ChatSession,
  DEFAULT_MODEL_ID,
  DEFAULT_SYSTEM_PROMPT,
  importFile,
  resolveAppPaths,
} from "@littletavern/engine";
import { afterEach, expect, it, vi } from "vitest";
import { createApp } from "./app.ts";
import { runCli } from "./cli.ts";

// A malicious card: OSC 52 writes the clipboard, OSC 0 sets the title, CSI 2J clears the screen.
const CLIPBOARD = "\x1b]52;c;cm0gLXJmIH4=\x07";
const EVIL = `${CLIPBOARD}\x1b]0;pwned\x07\x1b[2J`;
const DANGEROUS = ["\x1b]", "\x1b[2J"];

const terminal: Terminal = {
  columns: 100,
  rows: 30,
  kittyProtocolActive: false,
  start() {},
  stop() {},
  write() {},
  moveBy() {},
  hideCursor() {},
  showCursor() {},
  clearLine() {},
  clearFromCursor() {},
  clearScreen() {},
  setTitle() {},
  async drainInput() {},
  setProgress() {},
  setProgramStatus() {},
};

function writeEvilCard(home: string): string {
  const file = join(home, "evil.json");
  writeFileSync(
    file,
    JSON.stringify({
      spec: "chara_card_v3",
      data: {
        name: `Evil${EVIL}`,
        description: `desc${EVIL}`,
        first_mes: `Hello${EVIL}`,
        character_book: {
          name: `Book${EVIL}`,
          entries: [
            { keys: ["k"], content: `lore${EVIL}`, constant: true, comment: `entry${EVIL}` },
          ],
        },
      },
    }),
  );
  return file;
}

function expectSafe(text: string): void {
  for (const sequence of DANGEROUS) expect(text).not.toContain(sequence);
}

afterEach(() => vi.unstubAllEnvs());

it("never prints escape sequences from a card on the command line", async () => {
  const home = mkdtempSync(join(tmpdir(), "lt-untrusted-cli-"));
  vi.stubEnv("LITTLETAVERN_HOME", home);
  const output: string[] = [];
  const out = (text: string) => {
    output.push(text);
  };
  try {
    await runCli(["import", writeEvilCard(home)], out);
    await runCli(["list"], out);
    const id = output.join("\n").match(/\[id ([0-9a-f]{12})\]/)?.[1] ?? "";
    await runCli(["show", id], out);
    await runCli(["dry-run", id, "--message", "k"], out);
    expect(output.join("\n")).toContain("Evil");
    expectSafe(output.join("\n"));
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

it("never renders escape sequences from a card or a reply in the app", async () => {
  const home = mkdtempSync(join(tmpdir(), "lt-untrusted-app-"));
  const paths = resolveAppPaths({ LITTLETAVERN_HOME: home });
  const report = importFile(paths, writeEvilCard(home));
  if (!report.ok) throw new Error(report.reason);
  const app = createApp({
    terminal,
    env: { LITTLETAVERN_HOME: home, OPENROUTER_API_KEY: "synthetic-key" },
    session: new ChatSession({
      modelId: DEFAULT_MODEL_ID,
      systemPrompt: DEFAULT_SYSTEM_PROMPT,
      getApiKey: () => "synthetic-key",
      simulated: { replies: [`reply${EVIL}`] },
    }),
  });
  app.enterChat();
  const screen = () => app.tui.children.flatMap((component) => component.render(100)).join("\n");
  try {
    await app.submit("/characters");
    expectSafe(app.tui.getFocusedComponent()?.render(100).join("\n") ?? "");
    app.tui.getFocusedComponent()?.handleInput?.("\x1b");
    await app.submit(`/chat ${report.item.id}`);
    await app.submit("k");
    await vi.waitFor(() => expect(screen()).toContain("reply"));
    await app.submit("/trace");
    expectSafe(app.tui.getFocusedComponent()?.render(100).join("\n") ?? "");
    await app.submit(`/show ${report.item.id}`);
    expectSafe(screen());
    expect(screen()).toContain("Hello");
  } finally {
    await app.quit();
    rmSync(home, { recursive: true, force: true });
  }
});
