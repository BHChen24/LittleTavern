import { stripVTControlCharacters } from "node:util";
import { type Component, type Focusable, visibleWidth } from "@earendil-works/pi-tui";
import { afterEach, expect, it, vi } from "vitest";
import { Frame } from "./frame.ts";
import { ListPicker } from "./list-picker.ts";

afterEach(() => vi.unstubAllEnvs());

it.each([80, 40])("keeps wide and styled child lines inside a %s-column border", (width) => {
  const child: Component = {
    render: vi.fn(() => ["Short line", `\x1b[31m${"界".repeat(100)}\x1b[0m`]),
    invalidate() {},
  };
  const lines = new Frame(child).render(width);
  expect(child.render).toHaveBeenCalledWith(width - 4);
  expect(lines).toHaveLength(4);
  expect(lines.every((line) => visibleWidth(line) === width)).toBe(true);
  const plain = lines.map(stripVTControlCharacters);
  expect(plain[0]?.startsWith("┌")).toBe(true);
  expect(plain[0]?.endsWith("┐")).toBe(true);
  expect(plain.at(-1)?.startsWith("└")).toBe(true);
  expect(plain.at(-1)?.endsWith("┘")).toBe(true);
  expect(plain[1]).toContain("│ Short line");
  expect(plain[2]?.endsWith(" │")).toBe(true);
  expect(plain[2]).toContain("界");
});

it("forwards focus, input and invalidation to the wrapped child", () => {
  const child: Component & Focusable = {
    focused: false,
    render: () => ["Title"],
    handleInput: vi.fn(),
    invalidate: vi.fn(),
  };
  const frame = new Frame(child);
  expect(frame.focused).toBe(false);
  frame.focused = true;
  expect(child.focused).toBe(true);
  child.focused = false;
  expect(frame.focused).toBe(false);
  frame.handleInput("hello");
  expect(child.handleInput).toHaveBeenCalledWith("hello");
  frame.invalidate();
  expect(child.invalidate).toHaveBeenCalledOnce();
});

it("keeps a wrapping picker title and long entry inside the frame without color", () => {
  vi.stubEnv("NO_COLOR", "1");
  const title = "A long title for a character whose name needs several lines inside this panel";
  const picker = new ListPicker(title, [
    { value: "one", label: "A very long library item name ".repeat(5), search: "one" },
  ]);
  const lines = new Frame(picker).render(40);
  const plain = lines.map(stripVTControlCharacters);
  expect(lines.every((line) => visibleWidth(line) === 40)).toBe(true);
  expect(plain.filter((line) => line.startsWith("│ ")).length).toBeGreaterThan(4);
  expect(plain.join(" ")).toContain("A long title");
  expect(plain.join(" ")).toContain("panel");
  expect(plain[0]).toContain("┌");
  expect(plain.at(-1)).toContain("┘");
});
