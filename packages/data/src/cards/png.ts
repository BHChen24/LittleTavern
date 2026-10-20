export const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

export class PngReadError extends Error {
  override name = "PngReadError";
}

export function readPngTextChunks(bytes: Uint8Array): Map<string, string> {
  const data = Buffer.from(bytes);
  if (!data.subarray(0, 8).equals(PNG_SIGNATURE)) throw new PngReadError("Not a PNG file");
  const chunks = new Map<string, string>();
  let offset = 8;
  while (offset < data.length) {
    if (offset + 12 > data.length) throw new PngReadError("Truncated PNG chunk header");
    const length = data.readUInt32BE(offset);
    const type = data.toString("ascii", offset + 4, offset + 8);
    const end = offset + 8 + length;
    if (end + 4 > data.length) throw new PngReadError("Truncated PNG chunk data");
    if (type === "tEXt") {
      const content = data.subarray(offset + 8, end);
      const separator = content.indexOf(0);
      if (separator >= 0)
        chunks.set(
          content.toString("latin1", 0, separator),
          content.toString("latin1", separator + 1),
        );
    }
    offset = end + 4;
    if (type === "IEND") break;
  }
  return chunks;
}
