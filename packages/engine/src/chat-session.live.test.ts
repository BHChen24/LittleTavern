import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { appendUsageRecord, readUsageRecords } from "@littletavern/data";
import { describe, expect, it } from "vitest";
import { ChatSession } from "./chat-session.ts";
import { findAllowedModel } from "./models.ts";
import { DEFAULT_SYSTEM_PROMPT } from "./system-prompt.ts";
import { toUsageRecord } from "./usage.ts";

// Owner-only: default Vitest configuration excludes this file, even if a key is set.
describe.skipIf(!process.env.OPENROUTER_API_KEY)("OpenRouter live", () => {
  it("receives a short reply and records its known cost", async () => {
    const home = mkdtempSync(join(tmpdir(), "lt-live-"));
    const file = join(home, "usage.jsonl");
    const modelId = "openai/gpt-4o-mini";
    const key = process.env.OPENROUTER_API_KEY;
    const session = new ChatSession({
      modelId,
      systemPrompt: DEFAULT_SYSTEM_PROMPT,
      getApiKey: () => key,
    });
    session.onFinish((turn) => {
      appendUsageRecord(
        file,
        toUsageRecord(turn, {
          sessionId: "live-test",
          modelPrice: findAllowedModel(modelId)?.price ?? null,
          secrets: key ? [key] : [],
        }),
      );
    });
    try {
      const turn = await session.send("Say hello in five words.");
      expect(turn?.outcome).toBe("completed");
      expect(turn?.text.trim().length).toBeGreaterThan(0);
      const records = readUsageRecords(file);
      expect(records).toHaveLength(1);
      expect(records[0]?.cost).not.toBeNull();
    } finally {
      session.abort();
      rmSync(home, { recursive: true, force: true });
    }
  }, 60000);
});
