import { readdirSync, statSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { type Component, Text } from "@earendil-works/pi-tui";
import { stripControls } from "../sanitize.ts";
import { ListPicker, type PickerItem } from "./list-picker.ts";

interface Entry {
  path: string;
  directory: boolean;
}

export class FileBrowser implements Component {
  private currentDirectory: string;
  private picker = new ListPicker<Entry>("", []);
  private empty = false;
  private error = "";
  onSelect?: (path: string) => void;
  onCancel?: () => void;

  constructor(directory: string) {
    this.currentDirectory = resolve(directory);
    this.open(this.currentDirectory);
  }
  get directory(): string {
    return this.currentDirectory;
  }
  get focused(): boolean {
    return this.picker.focused;
  }
  set focused(value: boolean) {
    this.picker.focused = value;
  }

  private open(directory: string): void {
    try {
      const items: PickerItem<Entry>[] = [];
      for (const name of readdirSync(directory)) {
        const path = join(directory, name);
        try {
          const info = statSync(path);
          if (info.isDirectory() || (info.isFile() && /^(\.json|\.png)$/i.test(extname(name)))) {
            items.push({
              value: { path, directory: info.isDirectory() },
              label: stripControls(name) + (info.isDirectory() ? "/" : ""),
              search: name,
            });
          }
        } catch {
          /* Skip broken links or entries removed during listing. */
        }
      }
      items.sort(
        (a, b) =>
          Number(b.value.directory) - Number(a.value.directory) || a.label.localeCompare(b.label),
      );
      this.empty = items.length === 0;
      if (dirname(directory) !== directory)
        items.unshift({
          value: { path: dirname(directory), directory: true },
          label: "..",
          description: "Go up",
          search: "..",
        });
      const focused = this.picker.focused;
      const picker = new ListPicker(
        `Import from ${stripControls(directory)} (Esc cancels)`,
        items,
        "Filter files",
      );
      picker.focused = focused;
      picker.onCancel = () => this.onCancel?.();
      picker.onSelect = (entry) => {
        if (entry.directory) this.open(entry.path);
        else this.onSelect?.(entry.path);
      };
      this.currentDirectory = directory;
      this.error = "";
      this.picker = picker;
    } catch (error) {
      this.error = `Could not read ${directory}: ${error instanceof Error ? error.message : String(error)}`;
      this.picker.onCancel = () => this.onCancel?.();
    }
  }
  handleInput(data: string): void {
    this.picker.handleInput(data);
  }
  invalidate(): void {
    this.picker.invalidate();
  }
  render(width: number): string[] {
    return [
      ...this.picker.render(width),
      ...(this.empty
        ? new Text(`No .json or .png files in ${stripControls(this.directory)}`).render(width)
        : []),
      ...(this.error ? new Text(stripControls(this.error)).render(width) : []),
    ];
  }
}
