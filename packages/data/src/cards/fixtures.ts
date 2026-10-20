import { crc32 } from "node:zlib";

export function makeV3Card(overrides: Record<string, unknown> = {}) {
  return {
    spec: "chara_card_v3",
    spec_version: "3.0",
    data: { name: "Synthetic character", description: "Hello, {{user}}.\n你好。", ...overrides },
  };
}

export function makeV2Card(overrides: Record<string, unknown> = {}) {
  return { ...makeV3Card(overrides), spec: "chara_card_v2", spec_version: "2.0" };
}

function pngChunk(type: string, data: Buffer): Buffer {
  const name = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, crc]);
}

export function makePng(chunks: Record<string, string>): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(1, 0);
  header.writeUInt32BE(1, 4);
  header[8] = 8;
  header[9] = 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", header),
    ...Object.entries(chunks).map(([key, value]) =>
      pngChunk(
        "tEXt",
        Buffer.from(`${key}\0${Buffer.from(value, "utf8").toString("base64")}`, "latin1"),
      ),
    ),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

export function makeWorldInfo(entries: Record<string, unknown> = {}) {
  return { name: "Synthetic world", entries };
}

export function makeZip(fileName: string): Buffer {
  const name = Buffer.from(fileName, "utf8");
  const header = Buffer.alloc(30);
  header.write("PK\x03\x04", "binary");
  header.writeUInt16LE(name.length, 26);
  return Buffer.concat([header, name]);
}
