import { expect, it } from "vitest";
import { stripControls } from "../sanitize.ts";
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
  expect(prompt.render(100).join("")).toContain("Use for this session only");
  prompt.handleInput("\r");
  expect(result).toEqual({ key: "synthetic-key", save: false });
});

it("cancels without accepting a key", () => {
  const prompt = new KeyPrompt("/tmp/synthetic/credentials.json");
  let cancelled = false;
  prompt.onCancel = () => {
    cancelled = true;
  };
  prompt.handleInput("synthetic");
  prompt.handleInput("\x1b");
  expect(cancelled).toBe(true);
});

it("shows the whole save path on a narrow terminal", () => {
  const destination = `/tmp/${"nested-folder/".repeat(12)}credentials.json`;
  const prompt = new KeyPrompt(destination);
  prompt.handleInput("synthetic");
  prompt.handleInput("\r");
  const text = prompt.render(45).join("\n");
  const withoutLayoutWhitespace = stripControls(text).replace(/\s/g, "");
  expect(withoutLayoutWhitespace).toContain(destination);
  expect(withoutLayoutWhitespace).toContain("readableonlybyyou");
});
