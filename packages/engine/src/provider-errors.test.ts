import { expect, it } from "vitest";
import { describeProviderError } from "./provider-errors.ts";

it.each([
  ["401 unauthorized", "key-rejected"],
  ["403 forbidden", "key-rejected"],
  ["402", "no-credit"],
  ["429", "rate-limited"],
  ["404", "model-unavailable"],
  ["fetch failed", "network"],
  ["ENOTFOUND", "network"],
  ["ECONNREFUSED", "network"],
  ["ETIMEDOUT", "network"],
  ["unexpected error", "other"],
])("classifies %s", (message, kind) => {
  expect(describeProviderError(message).kind).toBe(kind);
});
