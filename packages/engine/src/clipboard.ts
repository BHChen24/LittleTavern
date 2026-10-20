import { copyToClipboard } from "@earendil-works/pi-coding-agent";

/** Adapter for pi's cross-platform copy operation and the UI's visible failure message. */
export async function copyText(
  text: string,
  copy: (text: string) => Promise<void> = copyToClipboard,
): Promise<true | string> {
  try {
    await copy(text);
    return true;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}
