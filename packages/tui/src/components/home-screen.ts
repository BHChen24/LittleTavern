import { matchesKey, Text } from "@earendil-works/pi-tui";
import { stripControls } from "../sanitize.ts";
import { messageStyles } from "../theme.ts";

// Original block-letter artwork; no font or third-party artwork.
const LOGO = [
  "  l i t t l e",
  "▀▀█▀▀ ▄▀▀▀▄ █   █ █▀▀▀▀ █▀▀▀▄ █▄  █",
  "  █   █▀▀▀█ ▀▄ ▄▀ █▀▀▀  █▀▀▀▄ █ ▀▄█",
  "  ▀   ▀   ▀   ▀   ▀▀▀▀▀ ▀   ▀ ▀   ▀",
];
const LOGO_WIDTH = Math.max(...LOGO.map((line) => line.length));

export interface HomeScreenOptions {
  version: string;
  keyStatus: string;
  libraryEmpty: boolean;
  importDirs: string[];
}
export class HomeScreen extends Text {
  onEnter?: () => void;
  constructor({ version, keyStatus, libraryEmpty, importDirs }: HomeScreenOptions) {
    super(
      stripControls(
        [
          `v${version} · Terminal roleplay with character cards and lorebooks`,
          "",
          "Press Enter to start",
          "Type / for commands",
          keyStatus === "none" ? "No API key yet — use /apikey" : `API key: ${keyStatus}`,
          ...(libraryEmpty ? ["", "Put files to import in:", ...importDirs] : []),
        ].join("\n"),
      ),
    );
  }
  override render(width: number): string[] {
    const content = super.render(width);
    const heading = width >= LOGO_WIDTH ? LOGO : ["LittleTavern"];
    return [...heading.map((line) => messageStyles.accent(line)), ...content];
  }
  handleInput(data: string): void {
    if (matchesKey(data, "enter")) this.onEnter?.();
  }
}
