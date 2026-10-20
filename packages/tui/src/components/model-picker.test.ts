import { expect, it } from "vitest";
import { ModelPicker } from "./model-picker.ts";

it("fuzzy-filters by a name fragment, selects and cancels", () => {
  const picker = new ModelPicker();
  let selected = "";
  let cancelled = false;
  picker.onSelect = (model) => {
    selected = model.id;
  };
  picker.onCancel = () => {
    cancelled = true;
  };
  picker.handleInput("4o-mini");
  expect(picker.render(120).join("\n")).toContain("openai/gpt-4o-mini");
  expect(picker.render(120).join("\n")).toContain("per M");
  picker.handleInput("\r");
  expect(selected).toBe("openai/gpt-4o-mini");
  picker.handleInput("\x1b");
  expect(cancelled).toBe(true);
});
