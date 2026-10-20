import { matchesKey, Text } from "@earendil-works/pi-tui";
import { stripControls } from "../sanitize.ts";

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
  handleInput(data: string): void {
    if (matchesKey(data, "enter")) this.onEnter?.();
  }
}
