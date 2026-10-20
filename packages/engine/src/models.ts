import { createModels } from "@earendil-works/pi-ai";
import { openrouterProvider } from "@earendil-works/pi-ai/providers/openrouter";

export interface ModelPrice {
  inputPerMTok: number;
  outputPerMTok: number;
}
export interface ModelInfo {
  id: string;
  name: string;
  family: "openai" | "gemini";
  price: ModelPrice | null;
}

export const DEFAULT_MODEL_ID = "google/gemini-2.5-flash";

export function listAllowedModels(): ModelInfo[] {
  const models = createModels();
  models.setProvider(openrouterProvider());
  return models
    .getModels("openrouter")
    .filter(
      (model) =>
        (model.id.startsWith("openai/") || model.id.startsWith("google/gemini")) &&
        !model.id.includes(":") &&
        !model.id.includes("-image"),
    )
    .map((model) => ({
      id: model.id,
      name: model.name,
      family: model.id.startsWith("openai/") ? "openai" : "gemini",
      price: model.cost
        ? { inputPerMTok: model.cost.input, outputPerMTok: model.cost.output }
        : null,
    }));
}

export function findAllowedModel(id: string | undefined): ModelInfo | undefined {
  return listAllowedModels().find((model) => model.id === id);
}
