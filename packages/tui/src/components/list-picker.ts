import {
  type Component,
  fuzzyFilter,
  Input,
  matchesKey,
  SelectList,
  Text,
} from "@earendil-works/pi-tui";
import { selectListTheme } from "../theme.ts";

export interface PickerItem<T> {
  value: T;
  label: string;
  description?: string;
  /** Text the filter matches against. */
  search: string;
}

/** An overlay with a filter line above a selectable list (the character and chat pickers). */
export class ListPicker<T> implements Component {
  private input: Input;
  private list: SelectList;
  private readonly title: string;
  private readonly items: PickerItem<T>[];
  onSelect?: (value: T) => void;
  onCancel?: () => void;

  constructor(title: string, items: PickerItem<T>[], placeholder = "Filter") {
    this.title = title;
    this.items = items;
    this.input = new Input({ placeholder });
    this.list = this.createList();
  }
  get focused(): boolean {
    return this.input.focused;
  }
  set focused(value: boolean) {
    this.input.focused = value;
  }
  private createList(): SelectList {
    const matches = fuzzyFilter(this.items, this.input.getValue(), (item) => item.search);
    const list = new SelectList(
      matches.map((item) => ({
        value: String(this.items.indexOf(item)),
        label: item.label,
        description: item.description ?? "",
      })),
      10,
      selectListTheme,
    );
    list.onSelect = (selected) => {
      const item = this.items[Number(selected.value)];
      if (item) this.onSelect?.(item.value);
    };
    list.onCancel = () => this.onCancel?.();
    return list;
  }
  handleInput(data: string): void {
    if (matchesKey(data, "escape")) {
      this.onCancel?.();
      return;
    }
    if (matchesKey(data, "up") || matchesKey(data, "down") || matchesKey(data, "enter")) {
      this.list.handleInput(data);
      return;
    }
    const previous = this.input.getValue();
    this.input.handleInput(data);
    if (previous !== this.input.getValue()) this.list = this.createList();
  }
  invalidate(): void {
    this.input.invalidate();
    this.list.invalidate();
  }
  render(width: number): string[] {
    const lines = [...new Text(this.title).render(width), ...this.input.render(width)];
    if (this.items.length === 0) return [...lines, ...new Text("(nothing here yet)").render(width)];
    return [...lines, ...this.list.render(width)];
  }
}
