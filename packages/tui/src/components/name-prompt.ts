import { type Component, Input, Text } from "@earendil-works/pi-tui";

export class NamePrompt implements Component {
  private input = new Input();
  error = "";
  onSubmit?: (value: string) => void;
  onCancel?: () => void;

  constructor() {
    this.input.handleInput("Traveler");
    this.input.onSubmit = (value) => this.onSubmit?.(value);
    this.input.onEscape = () => this.onCancel?.();
  }
  get focused(): boolean {
    return this.input.focused;
  }
  set focused(value: boolean) {
    this.input.focused = value;
  }
  handleInput(data: string): void {
    this.input.handleInput(data);
  }
  invalidate(): void {
    this.input.invalidate();
  }
  render(width: number): string[] {
    return [
      ...new Text(
        "What should characters call you? (Enter saves, Esc uses Traveler for now)",
      ).render(width),
      ...(this.error ? new Text(this.error).render(width) : []),
      ...this.input.render(width),
    ];
  }
}
