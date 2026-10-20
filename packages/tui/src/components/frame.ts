import {
  type Component,
  type Focusable,
  isFocusable,
  truncateToWidth,
  visibleWidth,
} from "@earendil-works/pi-tui";
import { frameBorder } from "../theme.ts";

/** A border and one column of padding around an overlay's existing content. */
export class Frame implements Component, Focusable {
  private readonly child: Component;
  private readonly maxHeight?: () => number;

  constructor(child: Component, maxHeight?: () => number) {
    this.child = child;
    this.maxHeight = maxHeight;
  }
  get focused(): boolean {
    return isFocusable(this.child) && this.child.focused;
  }
  set focused(value: boolean) {
    if (isFocusable(this.child)) this.child.focused = value;
  }
  handleInput(data: string): void {
    this.child.handleInput?.(data);
  }
  invalidate(): void {
    this.child.invalidate();
  }
  render(width: number): string[] {
    const innerWidth = Math.max(0, width - 4);
    const horizontal = "─".repeat(Math.max(0, width - 2));
    const side = frameBorder("│");
    let lines = this.child.render(innerWidth);
    const maxHeight = this.maxHeight?.();
    if (maxHeight !== undefined && lines.length + 2 > maxHeight) {
      const available = Math.max(0, maxHeight - 2);
      lines = lines.slice(0, available);
      if (lines.length) lines[lines.length - 1] = "…";
    }
    const content = lines.map((line) => {
      const text = truncateToWidth(line, innerWidth);
      return `${side} ${text}${" ".repeat(Math.max(0, innerWidth - visibleWidth(text)))} ${side}`;
    });
    return [frameBorder(`┌${horizontal}┐`), ...content, frameBorder(`└${horizontal}┘`)];
  }
}
