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

  constructor(child: Component) {
    this.child = child;
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
    const content = this.child.render(innerWidth).map((line) => {
      const text = truncateToWidth(line, innerWidth);
      return `${side} ${text}${" ".repeat(Math.max(0, innerWidth - visibleWidth(text)))} ${side}`;
    });
    return [frameBorder(`┌${horizontal}┐`), ...content, frameBorder(`└${horizontal}┘`)];
  }
}
