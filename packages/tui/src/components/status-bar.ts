import { Text } from "@earendil-works/pi-tui";

export class StatusBar extends Text {
  constructor(model: string, source: string) {
    super("");
    this.update(model, source);
  }
  update(model: string, source: string, usage = "—"): void {
    this.setText(`${model} | key: ${source} | ${usage}`);
  }
}
