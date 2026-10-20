import { expect, it } from "vitest";
import { DEFAULT_MODEL_ID, findAllowedModel, listAllowedModels } from "./models.ts";

it("offers only permitted families without batch or image variants", () => {
  const models = listAllowedModels();
  expect(models.length).toBeGreaterThan(0);
  expect(
    models.every(
      (model) =>
        /^(openai\/|google\/gemini)/.test(model.id) &&
        !model.id.includes(":") &&
        !model.id.includes("-image"),
    ),
  ).toBe(true);
  expect(models.every((model) => model.family === "openai" || model.family === "gemini")).toBe(
    true,
  );
});
it("has the documented default and detects invalid remembered models", () => {
  expect(findAllowedModel(DEFAULT_MODEL_ID)?.id).toBe(DEFAULT_MODEL_ID);
  expect(findAllowedModel("missing/model")).toBeUndefined();
  expect(findAllowedModel("missing/model") ?? findAllowedModel(DEFAULT_MODEL_ID)).toHaveProperty(
    "id",
    DEFAULT_MODEL_ID,
  );
});
