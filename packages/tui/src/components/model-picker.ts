import {
  type Component,
  fuzzyFilter,
  Input,
  matchesKey,
  SelectList,
  Text,
} from "@earendil-works/pi-tui";
import { listAllowedModels, type ModelInfo } from "@littletavern/engine";
import { selectListTheme } from "../theme.ts";

export class ModelPicker implements Component {
  private input = new Input({ placeholder: "Filter models" });
  private models = listAllowedModels();
  private list: SelectList;
  onSelect?: (model: ModelInfo) => void;
  onCancel?: () => void;
  constructor(currentModel?: string) {
    this.list = this.createList();
    if (currentModel)
      this.list.setSelectedIndex(this.models.findIndex((model) => model.id === currentModel));
  }
  get focused(): boolean {
    return this.input.focused;
  }
  set focused(value: boolean) {
    this.input.focused = value;
  }
  private createList(): SelectList {
    const matches = fuzzyFilter(
      this.models,
      this.input.getValue(),
      (model) => `${model.id} ${model.name}`,
    );
    const list = new SelectList(
      matches.map((model) => ({
        value: model.id,
        label: model.id,
        description: model.price
          ? `$${model.price.inputPerMTok}/$${model.price.outputPerMTok} per M`
          : "price unknown",
      })),
      10,
      selectListTheme,
    );
    list.onSelect = (item) => {
      const model = this.models.find((entry) => entry.id === item.value);
      if (model) this.onSelect?.(model);
    };
    list.onCancel = () => this.onCancel?.();
    return list;
  }
  handleInput(data: string): void {
    if (matchesKey(data, "escape")) {
      this.onCancel?.();
      return;
    }
    if (matchesKey(data, "up") || matchesKey(data, "down") || matchesKey(data, "enter")) {
      this.list.handleInput(data);
      return;
    }
    const previous = this.input.getValue();
    this.input.handleInput(data);
    if (previous !== this.input.getValue()) this.list = this.createList();
  }
  invalidate(): void {
    this.input.invalidate();
    this.list.invalidate();
  }
  render(width: number): string[] {
    return [
      ...new Text("Choose a model (Enter selects, Esc cancels)").render(width),
      ...this.input.render(width),
      ...this.list.render(width),
    ];
  }
}
