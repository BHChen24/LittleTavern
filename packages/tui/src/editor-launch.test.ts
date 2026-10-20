import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { openInEditor } from "./editor-launch.ts";

const home = mkdtempSync(join(tmpdir(), "lt-editor-"));
afterEach(() => vi.unstubAllEnvs());

import { afterAll } from "vitest";

afterAll(() => rmSync(home, { recursive: true, force: true }));
it("uses VISUAL with arguments and passes a spaced draft path intact", () => {
  const script = join(home, "editor.cjs");
  const file = join(home, "my draft.md");
  writeFileSync(script, 'require("node:fs").appendFileSync(process.argv[2], "## Name\\nMira\\n");');
  writeFileSync(file, "");
  vi.stubEnv("VISUAL", `${process.execPath} ${script}`);
  vi.stubEnv("EDITOR", "missing-editor-do-not-launch");
  expect(openInEditor(file)).toEqual({ ok: true });
  expect(readFileSync(file, "utf8")).toBe("## Name\nMira\n");
});
it("falls back to EDITOR and reports nonzero exits", () => {
  const script = join(home, "failure.cjs");
  writeFileSync(script, "process.exit(7);");
  vi.stubEnv("VISUAL", "");
  vi.stubEnv("EDITOR", `${process.execPath} ${script}`);
  expect(openInEditor(join(home, "draft.md"))).toMatchObject({
    ok: false,
    reason: expect.stringContaining("7"),
  });
});
it("names a missing program and explains how to set EDITOR", () => {
  const result = openInEditor(join(home, "draft.md"), "lt-missing-editor-007");
  expect(result).toMatchObject({
    ok: false,
    reason: expect.stringContaining("lt-missing-editor-007"),
  });
  expect(!result.ok && result.reason).toContain("$EDITOR");
});
