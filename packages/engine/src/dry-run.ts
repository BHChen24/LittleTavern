import { existsSync } from "node:fs";
import { type AppPaths, getItem, readSettings } from "@littletavern/data";
import type { AssembledPrompt, AssemblyTrace, HistoryMessage } from "./assembly/types.ts";
import {
  assembleForCharacter,
  type CharacterItem,
  greetingFor,
  listChats,
  missingCharacterMessage,
  readChatCharacter,
  readChatHistory,
} from "./character-chat.ts";
import { DEFAULT_MODEL_ID, findAllowedModel } from "./models.ts";

export type DryRunResult =
  | {
      ok: true;
      item: CharacterItem;
      modelId: string;
      prompt: AssembledPrompt;
      trace: AssemblyTrace;
      notices: string[];
    }
  | { ok: false; error: string };

/**
 * Assembles what the next request would be, without a provider, a key or any file writes.
 * Uses the same assembleForCharacter() as a real character chat, so both show the same trace.
 */
export async function dryRun(options: {
  paths: AppPaths;
  characterId: string;
  message?: string;
  session?: string;
}): Promise<DryRunResult> {
  const item = getItem(options.paths, options.characterId);
  if (item === "ambiguous")
    return { ok: false, error: `Ambiguous character prefix: ${options.characterId}` };
  if (item?.kind !== "character")
    return { ok: false, error: `Character not found: ${options.characterId}` };

  let history: HistoryMessage[];
  if (options.session) {
    const path = await findSessionPath(options.paths, options.session);
    if (!path) return { ok: false, error: `Saved chat not found: ${options.session}` };
    const owner = readChatCharacter(options.paths, path);
    if (!owner)
      return { ok: false, error: "This saved chat is not a LittleTavern character chat." };
    if (owner.libraryId !== item.id) {
      const ownerItem = getItem(options.paths, owner.libraryId);
      return {
        ok: false,
        error:
          ownerItem && ownerItem !== "ambiguous"
            ? `Saved chat ${options.session} belongs to ${owner.name}, not ${item.name}.`
            : missingCharacterMessage(owner.name || owner.libraryId),
      };
    }
    history = readChatHistory(options.paths, path).map(({ role, text }) => ({ role, text }));
  } else {
    const greeting = greetingFor(options.paths, item);
    history = greeting ? [{ role: "character", text: greeting }] : [];
  }
  if (options.message?.trim()) history.push({ role: "user", text: options.message });

  const modelId = findAllowedModel(readSettings(options.paths).model)?.id ?? DEFAULT_MODEL_ID;
  const { prompt, trace, notices } = assembleForCharacter({
    paths: options.paths,
    item,
    history,
    modelId,
  });
  return { ok: true, item, modelId, prompt, trace, notices };
}

/** A session id prefix from the chat list, or a path to a session file. */
async function findSessionPath(paths: AppPaths, session: string): Promise<string | null> {
  const matches = (await listChats(paths)).filter((chat) => chat.sessionId.startsWith(session));
  if (matches.length === 1) return matches[0]?.path ?? null;
  return existsSync(session) ? session : null;
}
