import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { resolveAppPaths } from "./paths.ts";
import { readSettings, writeSettings } from "./settings.ts";

it("round-trips the model preference and falls back for missing or malformed settings", () => {
  const home = mkdtempSync(join(tmpdir(), "lt-settings-"));
  const paths = resolveAppPaths({ LITTLETAVERN_HOME: home });
  try {
    expect(readSettings(paths)).toEqual({});
    writeSettings(paths, { model: "openai/gpt-4o-mini" });
    expect(readSettings(paths)).toEqual({ model: "openai/gpt-4o-mini" });
    for (const value of ["invalid", "null", "[]", '{"model":3}']) {
      writeFileSync(paths.settingsFile, value);
      expect(readSettings(paths)).toEqual({});
    }
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

it("validates each chat setting on its own", () => {
  const home = mkdtempSync(join(tmpdir(), "lt-settings-"));
  const paths = resolveAppPaths({ LITTLETAVERN_HOME: home });
  mkdirSync(paths.configDir, { recursive: true });
  try {
    writeFileSync(
      paths.settingsFile,
      JSON.stringify({
        userName: "Parker",
        loreBudget: 0,
        scanDepth: 3,
        replyReserve: "big",
        lorebookAttachments: { abc: ["def"] },
      }),
    );
    expect(readSettings(paths)).toEqual({
      userName: "Parker",
      scanDepth: 3,
      lorebookAttachments: { abc: ["def"] },
    });
    writeFileSync(paths.settingsFile, JSON.stringify({ userName: " ", scanDepth: 1.5 }));
    expect(readSettings(paths)).toEqual({});
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

it("merges on write and keeps unknown fields", () => {
  const home = mkdtempSync(join(tmpdir(), "lt-settings-"));
  const paths = resolveAppPaths({ LITTLETAVERN_HOME: home });
  mkdirSync(paths.configDir, { recursive: true });
  try {
    writeFileSync(
      paths.settingsFile,
      JSON.stringify({ future: true, model: "openai/gpt-4o-mini" }),
    );
    writeSettings(paths, { userName: "Parker" });
    expect(JSON.parse(readFileSync(paths.settingsFile, "utf8"))).toEqual({
      future: true,
      model: "openai/gpt-4o-mini",
      userName: "Parker",
    });
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});
