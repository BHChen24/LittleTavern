import { Text, truncateToWidth } from "@earendil-works/pi-tui";

export class StatusBar extends Text {
  private line = "";
  constructor(model: string, source: string) {
    super("");
    this.update(model, source);
  }
  update(model: string, source: string, usage = "—", character?: string): void {
    this.line = `${character ? `${character} | ` : ""}${model} | key: ${source} | ${usage}`;
    this.setText(this.line);
  }
  override render(width: number): string[] {
    return [truncateToWidth(this.line, Math.max(0, width))];
  }
}
