import { expect, it } from "vitest";
import { detectFile } from "./detect.ts";
import { makePng, makeV2Card, makeV3Card, makeZip } from "./fixtures.ts";

const json = (data: unknown) => Buffer.from(JSON.stringify(data));
it.each([
  [makeV3Card(), "Character card V3 (JSON)"],
  [makeV2Card(), "Character card V2 (JSON)"],
])("recognizes JSON markers", (card, format) => {
  expect(detectFile(json(card), "ignored.png")).toMatchObject({
    kind: "character",
    format,
    raw: card,
  });
});
it("prefers V3 in a dual-chunk PNG and ignores the extension", () => {
  const v3 = makeV3Card({ name: "three" });
  expect(
    detectFile(
      makePng({ ccv3: JSON.stringify(v3), chara: JSON.stringify(makeV2Card()) }),
      "wrong.json",
    ),
  ).toMatchObject({ kind: "character", format: "Character card V3 (PNG)", raw: v3 });
  expect(detectFile(makePng({ chara: JSON.stringify(makeV2Card()) }), "wrong.json")).toMatchObject({
    kind: "character",
    format: "Character card V2 (PNG)",
  });
});
it("accepts BOM-prefixed JSON and later 3.x versions", () => {
  expect(
    detectFile(
      Buffer.from(`\uFEFF${JSON.stringify({ ...makeV3Card(), spec_version: "3.9" })}`),
      "card",
    ),
  ).toHaveProperty("kind", "character");
});
it.each([
  [makePng({}), "PNG image without a character card", "PNG image without a character card"],
  [makeZip("card.json"), "CharX archive", "CharX archives are not supported in this version"],
  [makeZip("manifest.json"), "BYAF archive", "BYAF archives are not supported in this version"],
  [makeZip("other.txt"), "ZIP archive", "ZIP archives are not supported in this version"],
  [
    Buffer.from("---\nname: synthetic"),
    "YAML card",
    "YAML cards are not supported in this version",
  ],
  [Buffer.from("name: synthetic"), "YAML card", "YAML cards are not supported in this version"],
  [
    json({ name: "old", description: "old" }),
    "V1 character card",
    "V1 character cards are not supported in this version",
  ],
  [json({ spec: "unknown" }), "unsupported spec", "unsupported spec"],
  [json({}), "unrecognised JSON", "unrecognised JSON"],
  [json(makeV3Card({ name: " " })), "Character card V3 (JSON)", "a character must have a name"],
  [makePng({ ccv3: "not JSON" }), "damaged PNG card", "embedded card data could not be decoded"],
])("rejects unsupported or damaged input as %s", (bytes, detected, reason) => {
  const result = detectFile(bytes, "input");
  expect(result).toMatchObject({ rejected: true, detected });
  expect("reason" in result && result.reason).toContain(reason);
});
it("includes JSON.parse diagnostics for damaged JSON", () => {
  const result = detectFile(Buffer.from('{\n "name": "x",\n invalid\n}'), "broken.json");
  expect(result).toHaveProperty("detected", "damaged JSON");
  expect("reason" in result && result.reason).toMatch(/damaged JSON:.*line 3 column/);
});
it("recognizes both standalone lorebook shapes", () => {
  expect(detectFile(json({ entries: {} }), "world")).toHaveProperty(
    "format",
    "Lorebook (SillyTavern world info)",
  );
  expect(detectFile(json({ entries: [] }), "world")).toHaveProperty(
    "format",
    "Lorebook (card format)",
  );
});
