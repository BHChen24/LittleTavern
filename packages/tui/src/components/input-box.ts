import {
  Container,
  CURSOR_MARKER,
  type Editor,
  renderFakeCursor,
  truncateToWidth,
} from "@earendil-works/pi-tui";
import { stripControls } from "../sanitize.ts";
import { messageStyles } from "../theme.ts";

/** Keep Editor's input handling, borders and cursor; replace its empty content with a hint. */
export class InputBox extends Container {
  private editor: Editor;
  private placeholder: () => string;
  private banner?: () => string | undefined;

  constructor(editor: Editor, placeholder: () => string, banner?: () => string | undefined) {
    super();
    this.editor = editor;
    this.placeholder = placeholder;
    this.banner = banner;
    this.addChild(editor);
  }

  handleInput(data: string): void {
    this.editor.handleInput(data);
  }

  override render(width: number): string[] {
    let lines = this.editor.render(width);
    if (!this.editor.getText() && lines[1]) {
      const hint = messageStyles.muted(
        truncateToWidth(stripControls(this.placeholder()), Math.max(0, width - 1)),
      );
      const cursor = (this.editor.focused ? CURSOR_MARKER : "") + renderFakeCursor(" ");
      lines = [lines[0] ?? "", cursor + hint, ...lines.slice(2)];
    }
    const banner = this.banner?.();
    return banner
      ? [messageStyles.muted(truncateToWidth(stripControls(banner), Math.max(0, width))), ...lines]
      : lines;
  }
}
