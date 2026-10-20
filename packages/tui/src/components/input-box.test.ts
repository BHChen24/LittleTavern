import {
  CURSOR_MARKER,
  Editor,
  ProcessTerminal,
  TuiAltScreen,
  visibleWidth,
} from "@earendil-works/pi-tui";
import { expect, it } from "vitest";
import { editorTheme } from "../theme.ts";
import { InputBox } from "./input-box.ts";

it("shows the state placeholder while preserving the editor border and cursor", () => {
  const tui = new TuiAltScreen(new ProcessTerminal());
  const editor = new Editor(tui, editorTheme);
  editor.focused = true;
  let placeholder = "Talk to the innkeeper… (/ for commands)";
  const box = new InputBox(editor, () => placeholder);
  for (const text of [
    placeholder,
    "Talk to Mira… (/ for commands)",
    "Add your key with /apikey to start talking",
  ]) {
    placeholder = text;
    const lines = box.render(80);
    expect(lines.join("\n")).toContain(text);
    expect(lines[0]).toBe(editor.render(80)[0]);
    expect(lines[1]).toContain(CURSOR_MARKER);
    expect(box.render(30).every((line) => visibleWidth(line) <= 30)).toBe(true);
  }
  box.handleInput("hello");
  expect(box.render(80).join("\n")).toContain("hello");
  expect(box.render(80).join("\n")).not.toContain(placeholder);
});
