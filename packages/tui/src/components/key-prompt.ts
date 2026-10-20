import { type Component, SelectList, Text } from "@earendil-works/pi-tui";
import { isBlank } from "@littletavern/engine";
import { selectListTheme } from "../theme.ts";
import { MaskedKeyInput } from "./masked-key-input.ts";

export interface KeyPromptResult {
  key: string;
  save: boolean;
}
export class KeyPrompt implements Component {
  private input = new MaskedKeyInput();
  private choice?: SelectList;
  private key = "";
  private error = "";
  private credentialsFile: string;
  onResult?: (result: KeyPromptResult) => void;
  constructor(credentialsFile: string) {
    this.credentialsFile = credentialsFile;
    this.input.onSubmit = (key) => {
      if (isBlank(key)) {
        this.error = "Key cannot be empty";
        return;
      }
      this.key = key;
      this.error = "";
      this.choice = new SelectList(
        [
          { value: "save", label: "Save" },
          { value: "session", label: "This session only" },
        ],
        2,
        selectListTheme,
      );
      this.choice.onSelect = (item) =>
        this.onResult?.({ key: this.key, save: item.value === "save" });
    };
  }
  get focused(): boolean {
    return this.input.focused;
  }
  set focused(value: boolean) {
    this.input.focused = value;
  }
  handleInput(data: string): void {
    (this.choice ?? this.input).handleInput(data);
  }
  invalidate(): void {
    this.input.invalidate();
    this.choice?.invalidate();
  }
  render(width: number): string[] {
    const explanation = this.choice
      ? `The key will be saved to ${this.credentialsFile}, readable only by your user account`
      : "An OpenRouter API key is needed. Get one at https://openrouter.ai/keys";
    return [
      ...new Text(explanation).render(width),
      ...(this.error ? new Text(this.error).render(width) : []),
      ...(this.choice ?? this.input).render(width),
    ];
  }
}
