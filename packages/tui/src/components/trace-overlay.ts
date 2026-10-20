import { type Component, matchesKey, truncateToWidth } from "@earendil-works/pi-tui";

/**
 * A fixed-height window over the trace report. Scrolling is plain offset arithmetic:
 * render `height` lines starting at `offset`, plus a footer.
 */
export class TraceOverlay implements Component {
  private offset = 0;
  private readonly lines: string[];
  private readonly height: number;
  onClose?: () => void;

  constructor(lines: string[], height: number) {
    this.lines = lines;
    this.height = Math.max(1, height);
  }

  get scrollOffset(): number {
    return this.offset;
  }

  private scrollTo(offset: number): void {
    const last = Math.max(0, this.lines.length - this.height);
    this.offset = Math.min(Math.max(0, offset), last);
  }

  handleInput(data: string): void {
    if (matchesKey(data, "escape")) this.onClose?.();
    else if (matchesKey(data, "up")) this.scrollTo(this.offset - 1);
    else if (matchesKey(data, "down")) this.scrollTo(this.offset + 1);
    else if (matchesKey(data, "pageUp")) this.scrollTo(this.offset - this.height);
    else if (matchesKey(data, "pageDown")) this.scrollTo(this.offset + this.height);
    else if (matchesKey(data, "home")) this.scrollTo(0);
    else if (matchesKey(data, "end")) this.scrollTo(this.lines.length);
  }

  invalidate(): void {}

  render(width: number): string[] {
    const visible = this.lines.slice(this.offset, this.offset + this.height);
    const first = this.lines.length === 0 ? 0 : this.offset + 1;
    const footer = `lines ${first}–${this.offset + visible.length} of ${this.lines.length} · ↑↓ PgUp PgDn · Esc to close`;
    return [...visible, footer].map((line) => truncateToWidth(line, width));
  }
}
