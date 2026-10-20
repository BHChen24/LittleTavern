import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  truncateSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Terminal } from "@earendil-works/pi-tui";
import {
  addExamplesOnce,
  ChatSession,
  DEFAULT_MODEL_ID,
  DEFAULT_SYSTEM_PROMPT,
  importFile,
  listLibrary,
  readSettings,
  resolveAppPaths,
  resolveAppPaths as resolveFixturePaths,
  writeSettings as writeFixtureSettings,
} from "@littletavern/engine";
import { expect, it, vi } from "vitest";
import { createApp } from "./app.ts";

function stubTerminal(): Terminal {
  return {
    columns: 80,
    rows: 24,
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
}

it("renders the title, accepts editor input and renders a simulated reply", async () => {
  const home = mkdtempSync(join(tmpdir(), "lt-app-"));
  writeFixtureSettings(resolveFixturePaths({ LITTLETAVERN_HOME: home }), { userName: "Traveler" });
  const key = "synthetic-key";
  const app = createApp({
    terminal: stubTerminal(),
    env: { LITTLETAVERN_HOME: home, OPENROUTER_API_KEY: key },
    session: new ChatSession({
      modelId: DEFAULT_MODEL_ID,
      systemPrompt: DEFAULT_SYSTEM_PROMPT,
      getApiKey: () => key,
      simulated: { replies: ["Hello there."] },
    }),
  });
  try {
    expect(app.tui.children.flatMap((component) => component.render(80)).join("\n")).toContain(
      "v0.1.0 · Terminal roleplay with character cards and lorebooks",
    );
    app.enterChat();
    await app.submit("/model");
    app.tui.getFocusedComponent()?.handleInput?.("\r");
    await app.submit("/innkeeper");
    app.editor.handleInput("hi");
    app.editor.handleInput("\r");
    await vi.waitFor(() =>
      expect(app.tui.children.flatMap((component) => component.render(80)).join("\n")).toContain(
        "Hello there.",
      ),
    );
    expect(app.tui.children.flatMap((component) => component.render(80)).join("\n")).toContain(
      "You:",
    );
    expect(app.tui.children.flatMap((component) => component.render(80)).join("\n")).toContain(
      "Innkeeper:",
    );
    expect(app.tui.children.flatMap((component) => component.render(80)).join("\n")).toContain(
      "Key: environment",
    );
  } finally {
    await app.quit();
    rmSync(home, { recursive: true, force: true });
  }
});

it("opens the chat on Enter with the editor focused and no character picker", async () => {
  const home = mkdtempSync(join(tmpdir(), "lt-home-"));
  writeFixtureSettings(resolveFixturePaths({ LITTLETAVERN_HOME: home }), { userName: "Traveler" });
  const app = createApp({
    terminal: stubTerminal(),
    env: { LITTLETAVERN_HOME: home, OPENROUTER_API_KEY: "synthetic" },
  });
  try {
    expect(app.tui.children).toHaveLength(1);
    expect(app.tui.children.flatMap((component) => component.render(100)).join("\n")).toContain(
      "Press Enter to start",
    );
    app.tui.getFocusedComponent()?.handleInput?.("\r");
    expect(app.tui.hasOverlay()).toBe(false);
    expect(app.chat).toBeNull();
    expect(app.tui.getFocusedComponent()).toBe(app.editor);
    expect(app.tui.children.flatMap((component) => component.render(100)).join("\n")).not.toContain(
      "Press Enter to start",
    );
    app.enterChat();
    expect(app.tui.children).toHaveLength(4);
  } finally {
    await app.quit();
    rmSync(home, { recursive: true, force: true });
  }
});

it("quits from the home screen on Ctrl+C", async () => {
  const home = mkdtempSync(join(tmpdir(), "lt-home-quit-"));
  writeFixtureSettings(resolveFixturePaths({ LITTLETAVERN_HOME: home }), { userName: "Traveler" });
  const terminal = stubTerminal();
  let input: ((data: string) => void) | undefined;
  terminal.start = (onInput) => {
    input = onInput;
  };
  const app = createApp({ terminal, env: { LITTLETAVERN_HOME: home } });
  try {
    app.start();
    input?.("\x03");
    await app.done;
  } finally {
    await app.quit();
    rmSync(home, { recursive: true, force: true });
  }
});

it("preserves input and sends nothing when Ctrl+R is pressed without a key", async () => {
  const home = mkdtempSync(join(tmpdir(), "lt-no-key-regenerate-"));
  writeFixtureSettings(resolveFixturePaths({ LITTLETAVERN_HOME: home }), { userName: "Traveler" });
  const paths = resolveAppPaths({ LITTLETAVERN_HOME: home });
  const terminal = stubTerminal();
  let input: ((data: string) => void) | undefined;
  terminal.start = (onInput) => {
    input = onInput;
  };
  const app = createApp({ terminal, paths, env: { LITTLETAVERN_HOME: home } });
  try {
    app.start();
    input?.("\r");
    app.editor.setText("keep this draft");
    input?.("\x12");
    expect(app.editor.getText()).toBe("keep this draft");
    expect(app.tui.children.flatMap((component) => component.render(100)).join("\n")).toContain(
      "No API key yet. Type /apikey",
    );
    expect(existsSync(paths.usageLedgerFile)).toBe(false);
  } finally {
    await app.quit();
    rmSync(home, { recursive: true, force: true });
  }
});

it("survives an import root that is a file and refuses app path arguments", async () => {
  const home = mkdtempSync(join(tmpdir(), "lt-broken-import-root-"));
  writeFixtureSettings(resolveFixturePaths({ LITTLETAVERN_HOME: home }), { userName: "Traveler" });
  const paths = resolveAppPaths({ LITTLETAVERN_HOME: home });
  writeFileSync(paths.importRoot, "existing file");
  const card = join(home, "mira.json");
  writeFileSync(card, JSON.stringify({ spec: "chara_card_v3", data: { name: "Mira" } }));
  const app = createApp({ terminal: stubTerminal(), paths, env: { LITTLETAVERN_HOME: home } });
  app.enterChat();
  try {
    expect(app.tui.children.flatMap((component) => component.render(120)).join("\n")).toContain(
      "Could not create import folders",
    );
    await app.submit("/import");
    const browser = app.tui.getFocusedComponent();
    expect(browser?.render(120).join("\n")).toContain("Could not read");
    browser?.handleInput?.("\x1b");
    expect(app.tui.hasOverlay()).toBe(false);
    await app.submit(`/import ${card}`);
    expect(listLibrary(paths)).toEqual([]);
    expect(importFile(paths, card).ok).toBe(true);
    expect(app.tui.children.flatMap((component) => component.render(120)).join("\n")).toContain(
      "Choose a file from the import folders",
    );
  } finally {
    await app.quit();
    rmSync(home, { recursive: true, force: true });
  }
});

it("prefixes failed commands and provider errors while keeping ordinary notices distinct", async () => {
  const home = mkdtempSync(join(tmpdir(), "lt-error-style-"));
  writeFixtureSettings(resolveFixturePaths({ LITTLETAVERN_HOME: home }), { userName: "Traveler" });
  const app = createApp({
    terminal: stubTerminal(),
    env: { LITTLETAVERN_HOME: home, OPENROUTER_API_KEY: "synthetic" },
    session: new ChatSession({
      modelId: DEFAULT_MODEL_ID,
      systemPrompt: DEFAULT_SYSTEM_PROMPT,
      getApiKey: () => "synthetic",
      simulated: { replies: [{ text: "", errorMessage: "Provider unavailable" }] },
    }),
  });
  app.enterChat();
  const screen = () => app.tui.children.flatMap((component) => component.render(100)).join("\n");
  try {
    await app.submit("/invalid-command");
    expect(screen()).toContain("Error: Unknown command");
    await app.submit("/innkeeper");
    expect(screen()).toContain(
      "· You are talking to the innkeeper. Use /characters to start a character chat.",
    );
    for (const removed of ["/plain", "/new-character"]) {
      const errors = screen().match(/Error: Unknown command/g) ?? [];
      await app.submit(removed);
      expect(screen().match(/Error: Unknown command/g)).toHaveLength(errors.length + 1);
    }
    await app.submit("/model");
    app.tui.getFocusedComponent()?.handleInput?.("\r");
    await app.submit("hello");
    expect(screen()).toContain("Error: The reply failed.");
  } finally {
    await app.quit();
    rmSync(home, { recursive: true, force: true });
  }
});

it.each(["file", "directory"])(
  "refuses a selected file outside the import root through a %s link",
  async (kind) => {
    const home = mkdtempSync(join(tmpdir(), "lt-import-boundary-"));
    writeFixtureSettings(resolveFixturePaths({ LITTLETAVERN_HOME: home }), {
      userName: "Traveler",
    });
    const paths = resolveAppPaths({ LITTLETAVERN_HOME: home });
    const app = createApp({ terminal: stubTerminal(), paths, env: { LITTLETAVERN_HOME: home } });
    app.enterChat();
    try {
      const outside = join(home, "outside.json");
      writeFileSync(outside, JSON.stringify({ spec: "chara_card_v3", data: { name: "Outside" } }));
      if (kind === "file") symlinkSync(outside, join(paths.importRoot, "linked.json"));
      else symlinkSync(home, join(paths.importRoot, "linked"), "dir");
      await app.submit("/import");
      let browser = app.tui.getFocusedComponent();
      browser?.handleInput?.("linked");
      browser?.handleInput?.("\r");
      if (kind === "directory") {
        browser = app.tui.getFocusedComponent();
        browser?.handleInput?.("outside");
        browser?.handleInput?.("\r");
      }
      expect(listLibrary(paths)).toEqual([]);
      expect(app.tui.children.flatMap((component) => component.render(160)).join("\n")).toContain(
        "is outside the import folders.",
      );
    } finally {
      await app.quit();
      rmSync(home, { recursive: true, force: true });
    }
  },
);

it("imports a regular card from the browser and refuses an oversized selection", async () => {
  const home = mkdtempSync(join(tmpdir(), "lt-import-browser-"));
  writeFixtureSettings(resolveFixturePaths({ LITTLETAVERN_HOME: home }), { userName: "Traveler" });
  const paths = resolveAppPaths({ LITTLETAVERN_HOME: home });
  const app = createApp({ terminal: stubTerminal(), paths, env: { LITTLETAVERN_HOME: home } });
  app.enterChat();
  try {
    writeFileSync(
      join(paths.importRoot, "card.json"),
      JSON.stringify({ spec: "chara_card_v3", data: { name: "Mira" } }),
    );
    const large = join(paths.importRoot, "large.json");
    writeFileSync(large, "{}");
    truncateSync(large, 20 * 1024 * 1024 + 1);
    for (const name of ["card", "large"]) {
      await app.submit("/import");
      const browser = app.tui.getFocusedComponent();
      browser?.handleInput?.(name);
      browser?.handleInput?.("\r");
    }
    expect(listLibrary(paths).map((item) => item.name)).toEqual(["Mira"]);
    expect(app.tui.children.flatMap((component) => component.render(160)).join("\n")).toContain(
      "larger than 20 MB",
    );
  } finally {
    await app.quit();
    rmSync(home, { recursive: true, force: true });
  }
});

it.each(["folders", "settings", "both"])(
  "shows one startup failure notice when %s fail and keeps marker retries available",
  async (failure) => {
    const home = mkdtempSync(join(tmpdir(), "lt-startup-failures-"));
    const paths = resolveAppPaths({ LITTLETAVERN_HOME: home });
    const examples = join(home, "examples");
    mkdirSync(join(examples, "characters"), { recursive: true });
    mkdirSync(join(examples, "lorebooks"), { recursive: true });
    writeFileSync(
      join(examples, "characters/alice.json"),
      JSON.stringify({ spec: "chara_card_v3", data: { name: "Alice" } }),
    );
    writeFileSync(
      join(examples, "lorebooks/wonderland.json"),
      JSON.stringify({ name: "Wonderland", entries: {} }),
    );
    const foldersFail = failure !== "settings";
    const settingsFail = failure !== "folders";
    if (foldersFail) writeFileSync(paths.importRoot, "not a directory");
    if (settingsFail) mkdirSync(paths.settingsFile, { recursive: true });
    const result = addExamplesOnce(paths, examples);
    const app = createApp({
      terminal: stubTerminal(),
      paths,
      env: { LITTLETAVERN_HOME: home },
      startupNotices: result.notice ? [result.notice] : [],
    });
    try {
      app.enterChat();
      const output = app.tui.children.flatMap((component) => component.render(180)).join("\n");
      expect(output.match(/· Could not/g)).toHaveLength(1);
      if (foldersFail) expect(output).toContain("Could not create import folders");
      if (settingsFail) expect(output).toContain("could not save settings");
      expect(readSettings(paths).examplesAdded).toBe(settingsFail ? undefined : true);
      await app.submit("/help");
      expect(app.tui.hasOverlay()).toBe(true);
      if (foldersFail) rmSync(paths.importRoot);
      if (settingsFail) rmSync(paths.settingsFile, { recursive: true });
      expect(addExamplesOnce(paths, examples)).toEqual({});
      expect(readSettings(paths).examplesAdded).toBe(true);
      expect(listLibrary(paths)).toHaveLength(settingsFail ? 2 : 0);
    } finally {
      await app.quit();
      rmSync(home, { recursive: true, force: true });
    }
  },
);
