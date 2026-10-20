import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { resolveAppPaths } from "./paths.ts";
import { readRequestSettings, readSettings, writeSettings } from "./settings.ts";

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

it("reads request defaults, validates fields independently and preserves unrelated settings", () => {
  const home = mkdtempSync(join(tmpdir(), "lt-request-settings-"));
  const paths = resolveAppPaths({ LITTLETAVERN_HOME: home });
  try {
    expect(readRequestSettings(paths)).toEqual({
      replyTokens: 4096,
      runSpendUsd: 1,
      generation: {},
      warnings: [],
    });
    mkdirSync(paths.configDir, { recursive: true });
    const generation = {
      temperature: 1.1,
      topP: 0.9,
      topK: 40,
      minP: 0.05,
      repetitionPenalty: 1.05,
    };
    writeFileSync(
      paths.settingsFile,
      JSON.stringify({ userName: "Mira", limits: { replyTokens: 0, runSpendUsd: 0 }, generation }),
    );
    expect(readRequestSettings(paths)).toEqual({
      replyTokens: 0,
      runSpendUsd: 0,
      generation,
      warnings: [],
    });
    expect(readSettings(paths).userName).toBe("Mira");
    for (const [field, value] of Object.entries({
      temperature: -1,
      topP: 2,
      topK: 1.5,
      minP: "0.1",
      repetitionPenalty: 0,
    })) {
      writeFileSync(
        paths.settingsFile,
        JSON.stringify({ generation: { ...generation, [field]: value } }),
      );
      const result = readRequestSettings(paths);
      expect(result.generation).toEqual(
        Object.fromEntries(Object.entries(generation).filter(([key]) => key !== field)),
      );
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain(`Ignored generation.${field} in settings.json:`);
    }
    writeFileSync(
      paths.settingsFile,
      JSON.stringify({
        limits: { replyTokens: -1, runSpendUsd: "1" },
        generation: { temperature: 0, topK: 1 },
      }),
    );
    expect(readRequestSettings(paths)).toMatchObject({
      replyTokens: 4096,
      runSpendUsd: 1,
      generation: { temperature: 0, topK: 1 },
    });
    expect(readRequestSettings(paths).warnings).toHaveLength(2);
    writeSettings(paths, { userName: "Traveler" });
    expect(JSON.parse(readFileSync(paths.settingsFile, "utf8")).generation).toEqual({
      temperature: 0,
      topK: 1,
    });
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});
