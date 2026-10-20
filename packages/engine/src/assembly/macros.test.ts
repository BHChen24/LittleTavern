import { expect, it } from "vitest";
import { replaceMacros } from "./macros.ts";

it("replaces supported case variants and whitespace while retaining other macros", () => {
  expect(
    replaceMacros("{{char}} {{USER}} {{ Char }} {{ user }} {{other}}", {
      char: "雨",
      user: "Owner",
    }),
  ).toBe("雨 Owner 雨 Owner {{other}}");
});
it("inserts names literally without recursive substitution", () => {
  expect(replaceMacros("{{char}} / {{user}}", { char: "$& {{user}}", user: "User" })).toBe(
    "$& {{user}} / User",
  );
});
