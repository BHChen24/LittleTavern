import { expect, it } from "vitest";
import { makePng } from "./fixtures.ts";
import { PngReadError, readPngTextChunks } from "./png.ts";

it("reads Latin-1 text chunks, including both card keywords", () => {
  const chunks = readPngTextChunks(makePng({ ccv3: '{"name":"三"}', chara: '{"name":"two"}' }));
  expect(Buffer.from(chunks.get("ccv3") ?? "", "base64").toString("utf8")).toBe('{"name":"三"}');
  expect(chunks.has("chara")).toBe(true);
});
it("rejects non-PNG data with a typed error", () => {
  expect(() => readPngTextChunks(Buffer.from("not PNG"))).toThrow(PngReadError);
});
it("rejects truncated chunks without reading beyond their bounds", () => {
  expect(() => readPngTextChunks(makePng({ ccv3: "{}" }).subarray(0, 20))).toThrow(PngReadError);
});
