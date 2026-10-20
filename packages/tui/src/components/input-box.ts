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

  constructor(editor: Editor, placeholder: () => string) {
    super();
    this.editor = editor;
    this.placeholder = placeholder;
    this.addChild(editor);
  }

  handleInput(data: string): void {
    this.editor.handleInput(data);
  }

  override render(width: number): string[] {
    const lines = this.editor.render(width);
    if (this.editor.getText() || !lines[1]) return lines;
    const hint = messageStyles.muted(
      truncateToWidth(stripControls(this.placeholder()), Math.max(0, width - 1)),
    );
    const cursor = (this.editor.focused ? CURSOR_MARKER : "") + renderFakeCursor(" ");
    return [lines[0] ?? "", cursor + hint, ...lines.slice(2)];
  }
}
