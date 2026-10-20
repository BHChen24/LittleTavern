import { expect, it } from "vitest";
import { KeyPrompt, type KeyPromptResult } from "./key-prompt.ts";
import { MaskedKeyInput } from "./masked-key-input.ts";

it("masks pasted text while preserving the submitted key", () => {
  const input = new MaskedKeyInput();
  let result = "";
  input.onSubmit = (key) => {
    result = key;
  };
  input.handleInput("\x1b[200~synthetic-key-1234\x1b[201~");
  expect(input.render(80).join("")).not.toContain("synthetic-key");
  expect(input.render(80).join("")).toContain("1234");
  input.handleInput("\r");
  expect(result).toBe("synthetic-key-1234");
});
it("rejects blank input and asks consent with the full destination path", () => {
  const prompt = new KeyPrompt("/tmp/lt-test/config/credentials.json");
  let result: KeyPromptResult | undefined;
  prompt.onResult = (value) => {
    result = value;
  };
  prompt.handleInput("\r");
  expect(prompt.render(80).join("")).toContain("Key cannot be empty");
  prompt.handleInput("synthetic-key");
  prompt.handleInput("\r");
  expect(result).toBeUndefined();
  expect(prompt.render(100).join("")).toContain("/tmp/lt-test/config/credentials.json");
  expect(prompt.render(100).join("")).toContain("This session only");
  prompt.handleInput("\x1b[B");
  prompt.handleInput("\r");
  expect(result).toEqual({ key: "synthetic-key", save: false });
});
