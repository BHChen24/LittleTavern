import { isRecord } from "./normalize.ts";
import { PNG_SIGNATURE, readPngTextChunks } from "./png.ts";
import type { FormatLabel } from "./types.ts";

export type Detection =
  | { kind: "character" | "lorebook"; format: FormatLabel; raw: Record<string, unknown> }
  | { rejected: true; detected: string; reason: string };

function reject(detected: string, reason: string): Detection {
  return { rejected: true, detected, reason };
}

function character(
  raw: Record<string, unknown>,
  version: "V2" | "V3",
  container: "PNG" | "JSON",
): Detection {
  const format = `Character card ${version} (${container})` as FormatLabel;
  if (!isRecord(raw.data) || typeof raw.data.name !== "string" || !raw.data.name.trim())
    return reject(format, "a character must have a name");
  return { kind: "character", format, raw };
}

function detectJson(raw: unknown): Detection {
  if (!isRecord(raw))
    return reject("unrecognised JSON", "unrecognised JSON is not supported in this version");
  if (raw.spec === "chara_card_v3") return character(raw, "V3", "JSON");
  if (raw.spec === "chara_card_v2") return character(raw, "V2", "JSON");
  if ("spec" in raw)
    return reject("unsupported spec", `unsupported spec: ${JSON.stringify(raw.spec)}`);
  if ("name" in raw && ["description", "personality", "first_mes"].some((field) => field in raw))
    return reject("V1 character card", "V1 character cards are not supported in this version");
  if (isRecord(raw.entries))
    return { kind: "lorebook", format: "Lorebook (SillyTavern world info)", raw };
  if (Array.isArray(raw.entries))
    return { kind: "lorebook", format: "Lorebook (card format)", raw };
  return reject("unrecognised JSON", "unrecognised JSON is not supported in this version");
}

function zipNames(bytes: Buffer): string[] {
  const names: string[] = [];
  const signature = Buffer.from("PK\x03\x04", "binary");
  let offset = bytes.indexOf(signature);
  while (offset >= 0 && offset + 30 <= bytes.length) {
    const nameLength = bytes.readUInt16LE(offset + 26);
    const end = offset + 30 + nameLength;
    if (end > bytes.length) break;
    names.push(bytes.toString("utf8", offset + 30, end));
    offset = bytes.indexOf(signature, end);
  }
  return names;
}

export function detectFile(bytes: Uint8Array, _fileName: string): Detection {
  const buffer = Buffer.from(bytes);
  if (buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    let chunks: Map<string, string>;
    try {
      chunks = readPngTextChunks(buffer);
    } catch (error) {
      return reject(
        "damaged PNG",
        `damaged PNG: ${error instanceof Error ? error.message : "invalid chunks"}`,
      );
    }
    const payload = chunks.get("ccv3") ?? chunks.get("chara");
    if (payload === undefined)
      return reject("PNG image without a character card", "PNG image without a character card");
    let raw: unknown;
    try {
      raw = JSON.parse(Buffer.from(payload, "base64").toString("utf8"));
    } catch {
      return reject("damaged PNG card", "embedded card data could not be decoded");
    }
    if (!isRecord(raw))
      return reject("damaged PNG card", "embedded card data could not be decoded");
    if (raw.spec !== "chara_card_v2" && raw.spec !== "chara_card_v3")
      return reject("unsupported spec", `unsupported spec: ${JSON.stringify(raw.spec)}`);
    return character(raw, chunks.has("ccv3") ? "V3" : "V2", "PNG");
  }
  if (buffer.subarray(0, 4).equals(Buffer.from("PK\x03\x04", "binary"))) {
    const names = zipNames(buffer);
    const kind = names.includes("card.json")
      ? "CharX"
      : names.includes("manifest.json")
        ? "BYAF"
        : "ZIP";
    return reject(`${kind} archive`, `${kind} archives are not supported in this version`);
  }
  const text = buffer.toString("utf8").replace(/^\uFEFF/, "");
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    const firstLine = text.trimStart().split(/\r?\n/, 1)[0] ?? "";
    if (firstLine.trim() === "---" || /^[\w-]+\s*:/.test(firstLine))
      return reject("YAML card", "YAML cards are not supported in this version");
    return reject(
      "damaged JSON",
      `damaged JSON: ${error instanceof Error ? error.message : "invalid JSON"}`,
    );
  }
  return detectJson(raw);
}
