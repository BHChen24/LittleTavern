// Text from cards, lorebooks and model replies is untrusted. A terminal acts on escape
// sequences inside it (write the clipboard, change the title, clear the screen, fake links),
// so every untrusted string is passed through stripControls() before it is displayed.

/** OSC: ESC ] … terminated by BEL or ESC \ (clipboard, title, hyperlinks). */
// biome-ignore lint/suspicious/noControlCharactersInRegex: matching terminal control characters is the purpose of this pattern
const OSC = /\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)?/g;
/** CSI: ESC [ parameters, intermediates, final byte (cursor moves, clearing, colours). */
// biome-ignore lint/suspicious/noControlCharactersInRegex: matching terminal control characters is the purpose of this pattern
const CSI = /\x1b\[[0-?]*[ -/]*[@-~]/g;
/** Any other escape plus the character after it (DCS, charset switches, …). */
// biome-ignore lint/suspicious/noControlCharactersInRegex: matching terminal control characters is the purpose of this pattern
const OTHER_ESCAPE = /\x1b[\s\S]?/g;
/** Remaining C0/C1 controls except tab and newline, and DEL. */
// biome-ignore lint/suspicious/noControlCharactersInRegex: matching terminal control characters is the purpose of this pattern
const CONTROL = /[\x00-\x08\x0b-\x1f\x7f-\x9f]/g;

export function stripControls(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(OSC, "")
    .replace(CSI, "")
    .replace(OTHER_ESCAPE, "")
    .replace(CONTROL, "");
}
