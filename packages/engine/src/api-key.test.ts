import { expect, it } from "vitest";
import { isBlank, maskKey, resolveApiKey } from "./api-key.ts";

it("resolves environment, saved, then session", () => {
  expect(
    resolveApiKey({ envValue: "env-1234", savedValue: "saved", sessionValue: "session" }),
  ).toEqual({ value: "env-1234", source: "environment", masked: "••••1234" });
  expect(resolveApiKey({ savedValue: "saved", sessionValue: "session" })?.source).toBe("saved");
  expect(resolveApiKey({ sessionValue: "session" })?.source).toBe("session");
});
it("treats all blank sources as absent", () => {
  expect(isBlank(" \t")).toBe(true);
  expect(resolveApiKey({ envValue: "", savedValue: " ", sessionValue: "" })).toBeNull();
});
it("shows only the last four characters", () => {
  expect(maskKey("abcdef1234")).toBe("••••1234");
});

it("uses a saved key when the environment value is empty", () => {
  expect(resolveApiKey({ envValue: "", savedValue: "saved-key" })?.source).toBe("saved");
});
it("returns null for a whitespace-only environment and no saved key", () => {
  expect(resolveApiKey({ envValue: " \t " })).toBeNull();
});
it("reports environment as the source when both are present", () => {
  expect(resolveApiKey({ envValue: "env-key", savedValue: "saved-key" })?.source).toBe(
    "environment",
  );
});
