import { visibleWidth } from "@earendil-works/pi-tui";
import type { AssemblyTrace, LoreDecision } from "@littletavern/engine";
import { describe, expect, it } from "vitest";
import { formatAssembledPrompt, formatTraceReport } from "./trace-format.ts";

const meta = { characterName: "Mira", modelId: "google/gemini-2.5-flash", loreBudget: 4000 };

function decision(index: number, overrides: Partial<LoreDecision>): LoreDecision {
  return {
    lorebook: "Town",
    index,
    entry: `Entry ${index}`,
    included: false,
    reason: { kind: "no-match", depth: 2 },
    ignoredFeatures: [],
    ...overrides,
  };
}

function trace(lore: LoreDecision[], notes: string[] = []): AssemblyTrace {
  return {
    tokensAreEstimates: true,
    parts: [
      { source: "main", tokens: 20 },
      { source: "lore-after", tokens: 30, detail: "1 entries" },
      { source: "history", tokens: 15, detail: "2 messages" },
    ],
    lore,
    history: { included: 2, leftOut: 1 },
    notes,
    totalTokens: 65,
  };
}

function countOccurrences(lines: string[], text: string): number {
  return lines.join("\n").split(text).length - 1;
}

describe("formatTraceReport", () => {
  const lore = [
    decision(0, { included: true, reason: { kind: "constant" }, tokens: 10, placement: "after" }),
    decision(1, {
      included: true,
      reason: { kind: "keyword", key: "灯塔", message: 3 },
      tokens: 20,
      placement: "before",
      ignoredFeatures: ["secondary keys", "probability"],
    }),
    decision(2, { entry: "" }),
    decision(3, { reason: { kind: "budget" }, tokens: 50 }),
    decision(4, { reason: { kind: "disabled" } }),
    decision(5, { reason: { kind: "no-keywords" } }),
  ];
  const lines = formatTraceReport(trace(lore, ["request exceeds the context window"]), meta);

  it("starts with the summary, then notes and parts", () => {
    expect(lines[0]).toBe(
      "Mira · google/gemini-2.5-flash · ~65 tokens (estimate) · lore ~30/4000 · history 2 kept, 1 left out",
    );
    expect(lines[1]).toBe("Notes: request exceeds the context window");
    expect(lines[2]).toBe("Parts (estimated tokens)");
    expect(lines[4]).toContain("lore-after");
    expect(lines[4]).toContain("~30   1 entries");
  });

  it("lists fired entries with reason sentences, tokens and ignored features", () => {
    expect(lines).toContain("Lore fired (2)");
    expect(lines.join("\n")).toContain("always on   ~10");
    expect(lines.join("\n")).toContain("keyword `灯塔` in message 3   ~20");
  });

  it("groups not-fired entries by reason with counts and names unnamed entries", () => {
    expect(lines).toContain("Lore not fired (4)");
    expect(lines).toContain("  no keyword in the last 2 messages (1):");
    expect(lines).toContain("    Town · entry #3");
    expect(lines).toContain("  over budget (1):");
    expect(lines).toContain("  disabled (1):");
    expect(lines).toContain("  no keywords defined (1):");
  });

  it("shows every entry exactly once", () => {
    for (const name of ["Entry 0", "Entry 1", "entry #3", "Entry 3", "Entry 4", "Entry 5"])
      expect(countOccurrences(lines, name)).toBe(1);
  });

  it("omits the notes line when there are none and handles no lorebooks", () => {
    const empty = formatTraceReport(trace([]), meta);
    expect(empty.some((line) => line.startsWith("Notes:"))).toBe(false);
    expect(empty.at(-1)).toBe("No lorebooks.");
  });

  it("aligns and truncates by display width for Chinese names", () => {
    const wide = formatTraceReport(
      trace([
        decision(0, {
          lorebook: "灯塔镇",
          entry: "非常非常非常非常非常非常长的条目名字",
          included: true,
          reason: { kind: "constant" },
          tokens: 5,
        }),
        decision(1, {
          lorebook: "灯塔镇",
          entry: "短",
          included: true,
          reason: { kind: "constant" },
          tokens: 5,
        }),
      ]),
      meta,
      60,
    );
    const firedLines = wide.filter((line) => line.includes("always on"));
    const offsets = firedLines.map((line) =>
      visibleWidth(line.slice(0, line.indexOf("always on"))),
    );
    expect(offsets[0]).toBe(offsets[1]);
    expect(firedLines[0]).toContain("…");
  });

  it("stays readable with 30 entries: summary and all fired entries come first", () => {
    const many = [
      ...Array.from({ length: 3 }, (_, i) =>
        decision(i, { included: true, reason: { kind: "constant" }, tokens: 10 }),
      ),
      ...Array.from({ length: 20 }, (_, i) => decision(3 + i, {})),
      ...Array.from({ length: 4 }, (_, i) => decision(23 + i, { reason: { kind: "budget" } })),
      ...Array.from({ length: 3 }, (_, i) => decision(27 + i, { reason: { kind: "disabled" } })),
    ];
    const report = formatTraceReport(trace(many), meta);
    const firedHeader = report.indexOf("Lore fired (3)");
    expect(
      report.slice(firedHeader + 1, firedHeader + 4).every((line) => line.includes("always on")),
    ).toBe(true);
    expect(report).toContain("  no keyword in the last 2 messages (20):");
    expect(report).toContain("  over budget (4):");
    expect(report).toContain("  disabled (3):");
    const text = report.join("\n");
    for (let i = 0; i < 30; i += 1)
      expect(text.match(new RegExp(`Entry ${i}(?!\\d)`, "g"))).toHaveLength(1);
    expect(report.every((line) => visibleWidth(line) <= 80 || line.startsWith("Mira"))).toBe(true);
    expect(report[0]).toContain("(estimate)");
    expect(report.filter((line) => line.includes("~")).length).toBeGreaterThan(0);
  });
});

describe("formatAssembledPrompt", () => {
  it("prints the system text, each history message with its role, and the post-history text", () => {
    expect(
      formatAssembledPrompt({
        system: "You are Mira.\nStay kind.",
        history: [
          { role: "character", text: "Welcome." },
          { role: "user", text: "Hi." },
        ],
        afterHistory: "Be brief.",
      }),
    ).toEqual([
      "[system]",
      "You are Mira.",
      "Stay kind.",
      "",
      "[character]",
      "Welcome.",
      "",
      "[user]",
      "Hi.",
      "",
      "[after history]",
      "Be brief.",
    ]);
  });
});
