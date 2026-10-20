import { styleText } from "node:util";
import type { EditorTheme, MarkdownTheme, SelectListTheme } from "@earendil-works/pi-tui";

type Format = Exclude<Parameters<typeof styleText>[0], readonly unknown[]>;
const attributes = new Set<Format>(["bold", "italic", "dim", "underline", "strikethrough"]);

function style(formats: Format[], text: string): string {
  if (process.env.NO_COLOR) {
    if (!process.stdout.isTTY) return text;
    const remaining = formats.filter((format) => attributes.has(format));
    return remaining.length ? styleText(remaining, text, { validateStream: false }) : text;
  }
  return styleText(formats, text);
}

export const messageStyles = {
  user: (text: string) => style(["green"], text),
  character: (text: string) => style(["magenta"], text),
  notice: (text: string) => style(["dim", "italic"], text),
  error: (text: string) => style(["red"], text),
  dialogue: (text: string) => style(["yellow"], text),
  accent: (text: string) => style(["cyan"], text),
  muted: (text: string) => style(["dim"], text),
};
const dim = messageStyles.muted;
const cyan = messageStyles.accent;
export const selectListTheme: SelectListTheme = {
  selectedPrefix: cyan,
  selectedText: (text) => style(["bold"], text),
  description: dim,
  scrollInfo: dim,
  noMatch: dim,
};
export const editorTheme: EditorTheme = { borderColor: dim, selectList: selectListTheme };
export const markdownTheme: MarkdownTheme = {
  heading: (text) => style(["bold", "cyan"], text),
  link: cyan,
  linkUrl: dim,
  code: (text) => style(["yellow"], text),
  codeBlock: (text) => style(["green"], text),
  codeBlockBorder: dim,
  quote: (text) => style(["italic"], text),
  quoteBorder: dim,
  hr: dim,
  listBullet: cyan,
  bold: (text) => style(["bold"], text),
  italic: (text) => style(["italic"], text),
  strikethrough: (text) => style(["strikethrough"], text),
  underline: (text) => style(["underline"], text),
};
