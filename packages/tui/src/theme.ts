import { styleText } from "node:util";
import type { EditorTheme, MarkdownTheme, SelectListTheme } from "@earendil-works/pi-tui";

const dim = (text: string) => styleText("dim", text);
const cyan = (text: string) => styleText("cyan", text);
export const selectListTheme: SelectListTheme = {
  selectedPrefix: cyan,
  selectedText: (text) => styleText("bold", text),
  description: dim,
  scrollInfo: dim,
  noMatch: dim,
};
export const editorTheme: EditorTheme = { borderColor: dim, selectList: selectListTheme };
export const markdownTheme: MarkdownTheme = {
  heading: (text) => styleText(["bold", "cyan"], text),
  link: cyan,
  linkUrl: dim,
  code: (text) => styleText("yellow", text),
  codeBlock: (text) => styleText("green", text),
  codeBlockBorder: dim,
  quote: (text) => styleText("italic", text),
  quoteBorder: dim,
  hr: dim,
  listBullet: cyan,
  bold: (text) => styleText("bold", text),
  italic: (text) => styleText("italic", text),
  strikethrough: (text) => styleText("strikethrough", text),
  underline: (text) => styleText("underline", text),
};
