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

it("renders a sanitized editing banner above both empty and populated editor lines", () => {
  const editor = new Editor(new TuiAltScreen(new ProcessTerminal()), editorTheme);
  editor.focused = true;
  let banner: string | undefined = "Editing \x1b[31mAlice\x1b[0m · Enter saves · Esc cancels";
  const box = new InputBox(
    editor,
    () => "Placeholder",
    () => banner,
  );
  for (const text of ["", "A multi-line\nreply"]) {
    editor.setText(text);
    const lines = box.render(80);
    expect(lines[0]).toContain("Editing Alice");
    expect(lines[0]).not.toContain("\x1b[31m");
    expect(lines.slice(1).join("\n")).toContain(text ? "A multi-line" : "Placeholder");
    expect(box.render(15).every((line) => visibleWidth(line) <= 15)).toBe(true);
  }
  banner = undefined;
  expect(box.render(80)).toEqual(editor.render(80));
});
