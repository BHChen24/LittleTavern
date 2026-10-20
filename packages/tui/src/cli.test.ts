import { expect, it } from "vitest";
import { runCli } from "./cli.ts";

it("prints version without starting the terminal", async () => {
  const output: string[] = [];
  expect(await runCli(["--version"], (text) => output.push(text))).toBe(0);
  expect(output).toEqual(["LittleTavern 0.1.0"]);
});
it("prints documented commands and environment variables", async () => {
  const output: string[] = [];
  await runCli(["--help"], (text) => output.push(text));
  expect(output[0]).toContain("OPENROUTER_API_KEY");
  expect(output[0]).toContain("LITTLETAVERN_HOME");
});
