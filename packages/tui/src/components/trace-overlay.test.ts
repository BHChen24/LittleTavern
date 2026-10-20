import { expect, it } from "vitest";
import { TraceOverlay } from "./trace-overlay.ts";

const lines = Array.from({ length: 10 }, (_, i) => `line ${i + 1}`);

it("renders a window of lines and a footer", () => {
  const overlay = new TraceOverlay(lines, 3);
  expect(overlay.render(80)).toEqual([
    "line 1",
    "line 2",
    "line 3",
    "lines 1–3 of 10 · ↑↓ PgUp PgDn · Esc to close",
  ]);
});

it("scrolls with the arrow, page, home and end keys within bounds", () => {
  const overlay = new TraceOverlay(lines, 3);
  overlay.handleInput("\x1b[A");
  expect(overlay.scrollOffset).toBe(0);
  overlay.handleInput("\x1b[B");
  expect(overlay.scrollOffset).toBe(1);
  overlay.handleInput("\x1b[6~");
  expect(overlay.scrollOffset).toBe(4);
  overlay.handleInput("\x1b[F");
  expect(overlay.scrollOffset).toBe(7);
  overlay.handleInput("\x1b[6~");
  expect(overlay.scrollOffset).toBe(7);
  expect(overlay.render(80)[0]).toBe("line 8");
  overlay.handleInput("\x1b[5~");
  expect(overlay.scrollOffset).toBe(4);
  overlay.handleInput("\x1b[H");
  expect(overlay.scrollOffset).toBe(0);
});

it("calls onClose on Esc", () => {
  const overlay = new TraceOverlay(lines, 3);
  let closed = false;
  overlay.onClose = () => {
    closed = true;
  };
  overlay.handleInput("\x1b");
  expect(closed).toBe(true);
});
