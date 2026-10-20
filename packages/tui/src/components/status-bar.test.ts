import type { SessionTotals } from "@littletavern/engine";
import { expect, it } from "vitest";
import { StatusBar } from "./status-bar.ts";

const totals: SessionTotals = {
  requests: 2,
  inputTokens: 3000,
  outputTokens: 494,
  cacheReadTokens: 1000,
  cacheWriteTokens: 0,
  cost: 0.0023,
  incomplete: false,
};

it("labels every field and shows the cache hit rate when the line fits", () => {
  const bar = new StatusBar({
    model: "google/gemini-2.5-flash",
    keySource: "session",
    character: "Seraphina",
    totals,
  });
  expect(bar.render(200)).toEqual([
    "Character: Seraphina | Model: google/gemini-2.5-flash | Key: session",
    "Tokens: 3000 in / 494 out | Cache: 25% | $0.0023",
  ]);
});

it("falls back to the compact form on a narrow terminal", () => {
  const bar = new StatusBar({
    model: "google/gemini-2.5-flash",
    keySource: "session",
    character: "Seraphina",
    totals,
  });
  expect(bar.render(60)).toEqual([
    "Seraphina | google/gemini-2.5-flash | Key: session",
    "Tokens: 3000 in / 494 out | Cache: 25% | $0.0023",
  ]);
});

it("omits usage before the first request", () => {
  expect(new StatusBar({ model: "m", keySource: "none" }).render(100)).toEqual([
    "No API key — /apikey",
  ]);
});

it("shows the active persona and omits it when it falls back", () => {
  const bar = new StatusBar({ model: "m", keySource: "session", persona: "Traveller" });
  expect(bar.render(100).join("\n")).toContain("Persona: Traveller");
  bar.update({ model: "m", keySource: "none" });
  expect(bar.render(100).join("\n")).not.toContain("Persona:");
  expect(bar.render(100).join("\n")).not.toContain("Model:");
});
