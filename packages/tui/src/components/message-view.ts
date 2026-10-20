import { type Component, Markdown, truncateToWidth } from "@earendil-works/pi-tui";
import { colourDialogue } from "../dialogue.ts";
import { stripControls } from "../sanitize.ts";
import { markdownTheme, messageStyles } from "../theme.ts";

export class MessageView implements Component {
  private body = new Markdown("", 0, 0, markdownTheme);
  private role: "user" | "character";
  private label: string;

  constructor(role: "user" | "character", label: string, text: string) {
    this.role = role;
    this.label = stripControls(label);
    this.setText(text);
  }

  setText(text: string): void {
    this.body.setText(colourDialogue(stripControls(text)));
  }

  invalidate(): void {
    this.body.invalidate();
  }

  render(width: number): string[] {
    const capped = Math.max(1, Math.min(width, 100));
    const speaker = messageStyles[this.role];
    const label = speaker(markdownTheme.bold(truncateToWidth(`${this.label}:`, capped)));
    const prefix = speaker(capped > 1 ? "│ " : "│");
    return [
      label,
      ...this.body
        .render(Math.max(1, capped - 2))
        .map((line) => truncateToWidth(prefix + line, capped)),
    ];
  }
}
