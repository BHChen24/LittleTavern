import { statSync } from "node:fs";
import { fileURLToPath } from "node:url";

export function examplesDir(): string | null {
  for (const relative of ["../examples/", "../../../examples/"]) {
    const directory = new URL(relative, import.meta.url);
    try {
      if (statSync(directory).isDirectory()) return fileURLToPath(directory);
    } catch {
      // Missing packaged examples leave first-start setup available after a repaired install.
    }
  }
  return null;
}
