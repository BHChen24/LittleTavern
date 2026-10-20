import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { FileBrowser } from "./file-browser.ts";

const homes: string[] = [];
function fixture() {
  const home = mkdtempSync(join(tmpdir(), "lt-browser-"));
  homes.push(home);
  return home;
}
afterEach(() => {
  for (const home of homes.splice(0)) rmSync(home, { recursive: true, force: true });
});
it("sorts folders first, filters supported files and navigates up and through symlinks", () => {
  const home = fixture();
  mkdirSync(join(home, "z-folder"));
  mkdirSync(join(home, "a-folder"));
  symlinkSync(join(home, "a-folder"), join(home, "linked"));
  for (const name of ["a.json", "b.PNG", "ignored.txt"]) writeFileSync(join(home, name), "{}");
  const browser = new FileBrowser(home, home);
  const rendered = browser.render(120).join("\n");
  expect(rendered).not.toContain("Go up");
  const positions = ["a-folder/", "linked/", "z-folder/", "a.json", "b.PNG"].map((name) =>
    rendered.indexOf(name),
  );
  expect(positions).toEqual([...positions].sort((a, b) => a - b));
  expect(rendered).not.toContain("ignored.txt");
  browser.handleInput("linked");
  browser.handleInput("\r");
  expect(browser.directory).toBe(join(home, "linked"));
  expect(browser.render(120).join("\n")).toContain(
    `No .json or .png files in ${join(home, "linked")}`,
  );
  browser.handleInput("\r");
  expect(browser.directory).toBe(home);
});
it("filters non-Latin filenames, selects a file and cancels without selecting", () => {
  const home = fixture();
  writeFileSync(join(home, "角色.json"), "{}");
  writeFileSync(join(home, "other.json"), "{}");
  const browser = new FileBrowser(home, home);
  let selected = "";
  let cancelled = false;
  browser.onSelect = (path) => {
    selected = path;
  };
  browser.onCancel = () => {
    cancelled = true;
  };
  browser.handleInput("角色");
  expect(browser.render(100).join("\n")).not.toContain("other.json");
  browser.handleInput("\r");
  expect(selected).toBe(join(home, "角色.json"));
  browser.handleInput("\x1b");
  expect(cancelled).toBe(true);
});
it("shows an unreadable directory error and stays put when a folder disappears", () => {
  const home = fixture();
  const folder = join(home, "disappearing");
  mkdirSync(folder);
  const browser = new FileBrowser(home, home);
  rmSync(folder, { recursive: true });
  browser.handleInput("disappearing");
  browser.handleInput("\r");
  expect(browser.directory).toBe(home);
  expect(browser.render(120).join("\n")).toContain("Could not read");
});
it("hides the go-up entry at the filesystem root", () => {
  const browser = new FileBrowser("/", "/");
  expect(browser.render(120).join("\n")).not.toContain("Go up");
});

it("filters a folder with hundreds of files without losing a supported match", () => {
  const home = fixture();
  for (let i = 0; i < 250; i++)
    writeFileSync(join(home, `card-${i.toString().padStart(3, "0")}.json`), "{}");
  const browser = new FileBrowser(home, home);
  browser.handleInput("card-249");
  expect(browser.render(100).join("\n")).toContain("card-249.json");
  let selected = "";
  browser.onSelect = (path) => {
    selected = path;
  };
  browser.handleInput("\r");
  expect(selected).toBe(join(home, "card-249.json"));
});

it("stops navigation at the configured import root", () => {
  const home = fixture();
  const root = join(home, "import");
  mkdirSync(join(root, "characters"), { recursive: true });
  const browser = new FileBrowser(root, root);
  expect(browser.render(120).join("\n")).not.toContain("Go up");
  browser.handleInput("characters");
  browser.handleInput("\r");
  expect(browser.directory).toBe(join(root, "characters"));
  expect(browser.render(120).join("\n")).toContain("Go up");
  browser.handleInput("\r");
  expect(browser.directory).toBe(root);
  expect(browser.render(120).join("\n")).not.toContain("Go up");
});
