import { matchesKey, Text } from "@earendil-works/pi-tui";
import { stripControls } from "../sanitize.ts";
import { messageStyles } from "../theme.ts";

// Original tavern sign; no font or third-party artwork.
const LOGO = [
  "                       /\\",
  "              ________/  \\________",
  ".------------------------------------------------------.",
  "|                    LittleTavern                       |",
  "'------------------------------------------------------'",
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
          `LittleTavern ${version}`,
          "Terminal roleplay with character cards and lorebooks",
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
    if (width < LOGO_WIDTH + 4) return content;
    const padding = " ".repeat(Math.floor((width - LOGO_WIDTH) / 2));
    return [...LOGO.map((line) => padding + messageStyles.accent(line)), ...content];
  }
  handleInput(data: string): void {
    if (matchesKey(data, "enter")) this.onEnter?.();
  }
}
