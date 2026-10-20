import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it, vi } from "vitest";
import { createApp } from "./app.ts";

it("shows slash suggestions, accepts Tab and leaves middle-of-message slashes alone", async () => {
  const home = mkdtempSync(join(tmpdir(), "lt-suggestions-"));
  const app = createApp({ env: { LITTLETAVERN_HOME: home, OPENROUTER_API_KEY: "synthetic" } });
  app.enterChat();
  app.tui.getFocusedComponent()?.handleInput?.("\x1b");
  try {
    app.editor.handleInput("/");
    await vi.waitFor(() =>
      expect(app.editor.render(100).join("\n")).toContain("Choose a character"),
    );
    app.editor.handleInput("im");
    await vi.waitFor(() => expect(app.editor.render(100).join("\n")).toContain("Import a card"));
    app.editor.handleInput("\t");
    expect(app.editor.getText()).toBe("/import ");
    app.editor.setText("");
    app.editor.handleInput("hello /");
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(app.editor.render(100).join("\n")).not.toContain("Choose a character");
    app.editor.setText("");
    app.editor.handleInput("/");
    await vi.waitFor(() =>
      expect(app.editor.render(100).join("\n")).toContain("Choose a character"),
    );
    app.editor.handleInput("\x1b");
    expect(app.editor.getText()).toBe("/");
    expect(app.editor.render(100).join("\n")).not.toContain("Choose a character");
  } finally {
    await app.quit();
    rmSync(home, { recursive: true, force: true });
  }
});
