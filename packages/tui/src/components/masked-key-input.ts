import { type Component, Input } from "@earendil-works/pi-tui";

export class MaskedKeyInput implements Component {
  private input = new Input();
  onSubmit?: (key: string) => void;
  constructor() {
    this.input.onSubmit = (key) => this.onSubmit?.(key);
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
    const value = this.input.getValue();
    const visibleSuffix = value.length > 4 ? value.slice(-4) : "";
    this.input.setValue("•".repeat(value.length - visibleSuffix.length) + visibleSuffix);
    try {
      return this.input.render(width);
    } finally {
      this.input.setValue(value);
    }
  }
}
