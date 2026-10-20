import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { addExamplesOnce, listLibrary, resolveAppPaths } from "@littletavern/data";
import { expect, it } from "vitest";
import { CharacterChat } from "./character-chat.ts";
import { ChatSession } from "./chat-session.ts";
import { DEFAULT_MODEL_ID } from "./models.ts";
import { DEFAULT_SYSTEM_PROMPT } from "./system-prompt.ts";

// The plan justifies reading our shipped CC0 content in this single product happy-path test.
it("adds the shipped Alice and sends Wonderland lore through the faux provider", async () => {
  const home = mkdtempSync(join(tmpdir(), "lt-examples-chat-"));
  const paths = resolveAppPaths({ LITTLETAVERN_HOME: home });
  try {
    expect(
      addExamplesOnce(paths, fileURLToPath(new URL("../../../examples/", import.meta.url))),
    ).toEqual({});
    const alice = listLibrary(paths).find((item) => item.kind === "character");
    if (alice?.kind !== "character") throw new Error("Alice not imported");
    let system = "";
    const chat = CharacterChat.start({
      paths,
      item: alice,
      session: new ChatSession({
        modelId: DEFAULT_MODEL_ID,
        systemPrompt: DEFAULT_SYSTEM_PROMPT,
        getApiKey: () => "synthetic-key",
        simulated: {
          replies: [
            (history) => {
              system = history[0]?.text ?? "";
              return "How curious!";
            },
          ],
        },
      }),
    });
    expect((await chat.send("Have you seen the Cheshire Cat?"))?.outcome).toBe("completed");
    const entry = chat.lastTrace?.lore.find((item) => item.entry === "The Cheshire Cat");
    expect(entry).toMatchObject({ included: true, reason: { kind: "keyword" } });
    expect(system).toContain("Cheshire Cat");
    expect(chat.activeLorebooks().some((book) => book.attached && book.name === "Wonderland")).toBe(
      true,
    );
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});
