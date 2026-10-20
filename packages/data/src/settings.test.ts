import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { resolveAppPaths } from "./paths.ts";
import { readSettings, writeSettings } from "./settings.ts";

it("persists a persona, clears it with null, and drops invalid values independently", () => {
  const home = mkdtempSync(join(tmpdir(), "lt-settings-"));
  const paths = resolveAppPaths({ LITTLETAVERN_HOME: home });
  try {
    writeSettings(paths, { userName: "Parker", persona: "traveller.md" });
    expect(readSettings(paths)).toEqual({ userName: "Parker", persona: "traveller.md" });
    writeSettings(paths, { persona: null });
    expect(readSettings(paths)).toEqual({ userName: "Parker", persona: null });
    for (const persona of ["", "  ", 3, [], {}]) {
      writeFileSync(paths.settingsFile, JSON.stringify({ persona, userName: "Parker" }));
      expect(readSettings(paths)).toEqual({ userName: "Parker" });
    }
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

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

it("validates mouse capture independently and defaults missing values to on at use", () => {
  const home = mkdtempSync(join(tmpdir(), "lt-settings-mouse-"));
  const paths = resolveAppPaths({ LITTLETAVERN_HOME: home });
  try {
    expect(readSettings(paths).mouse !== false).toBe(true);
    for (const mouse of [false, true]) {
      writeSettings(paths, { mouse });
      expect(readSettings(paths).mouse).toBe(mouse);
    }
    for (const mouse of ["false", 0, null, []]) {
      writeFileSync(paths.settingsFile, JSON.stringify({ mouse, userName: "Parker" }));
      expect(readSettings(paths)).toEqual({ userName: "Parker" });
    }
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

it("round-trips the examples marker and drops non-boolean markers independently", () => {
  const home = mkdtempSync(join(tmpdir(), "lt-settings-examples-"));
  const paths = resolveAppPaths({ LITTLETAVERN_HOME: home });
  try {
    expect(readSettings(paths).examplesAdded).toBeUndefined();
    for (const examplesAdded of [false, true]) {
      writeSettings(paths, { examplesAdded, userName: "Parker" });
      expect(readSettings(paths)).toEqual({ examplesAdded, userName: "Parker" });
    }
    for (const examplesAdded of ["true", 1, null, []]) {
      writeFileSync(paths.settingsFile, JSON.stringify({ examplesAdded, userName: "Parker" }));
      expect(readSettings(paths)).toEqual({ userName: "Parker" });
    }
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});
