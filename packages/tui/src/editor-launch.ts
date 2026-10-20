import { spawnSync } from "node:child_process";

export type EditorResult = { ok: true } | { ok: false; reason: string };

export function openInEditor(
  filePath: string,
  command = process.env.VISUAL ||
    process.env.EDITOR ||
    (process.platform === "win32" ? "notepad" : "nano"),
): EditorResult {
  const [program = "", ...args] = command.trim().split(/\s+/);
  const result = spawnSync(program, [...args, filePath], { stdio: "inherit" });
  if (result.error || result.status !== 0) {
    const cause =
      result.error?.message ??
      (result.signal ? `signal ${result.signal}` : `exit code ${result.status}`);
    return {
      ok: false,
      reason: `Could not run editor "${command}": ${cause}. Set $EDITOR (or $VISUAL) to an editor command, for example code --wait.`,
    };
  }
  return { ok: true };
}
