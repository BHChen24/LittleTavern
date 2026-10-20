import { messageStyles } from "./theme.ts";

/** Quotes end at their closing delimiter or at the end of the paragraph. */
export function colourDialogue(text: string): string {
  const closers: Record<string, string> = { '"': '"', "“": "”", "\u300c": "\u300d" };
  return text
    .split(/(\n[ \t]*\n)/)
    .map((paragraph) => {
      let result = "";
      for (let index = 0; index < paragraph.length; index++) {
        const closer = closers[paragraph[index] ?? ""];
        if (!closer) {
          result += paragraph[index];
          continue;
        }
        const closingIndex = paragraph.indexOf(closer, index + 1);
        const end = closingIndex < 0 ? paragraph.length : closingIndex + 1;
        result += messageStyles.dialogue(paragraph.slice(index, end));
        index = end - 1;
      }
      return result;
    })
    .join("");
}
