import { fitHistory } from "./history.ts";
import { activateLore, applyLoreBudget } from "./lore.ts";
import { replaceMacros } from "./macros.ts";
import { estimateTokens } from "./tokens.ts";
import {
  type AssembledPrompt,
  type AssemblyInput,
  type AssemblyTrace,
  DEFAULT_ASSEMBLY_SETTINGS,
  DEFAULT_CONTEXT_WINDOW,
  DEFAULT_MAIN_INSTRUCTION,
  DEFAULT_USER_NAME,
  type TracePart,
} from "./types.ts";

export function assemblePrompt(input: AssemblyInput): {
  prompt: AssembledPrompt;
  trace: AssemblyTrace;
} {
  const settings = { ...DEFAULT_ASSEMBLY_SETTINGS, ...input.settings };
  const contextWindow = input.contextWindow || DEFAULT_CONTEXT_WINDOW;
  const character = input.character;
  const names = { char: character.name, user: input.userName ?? DEFAULT_USER_NAME };
  const main = character.systemPrompt.trim() ? character.systemPrompt : DEFAULT_MAIN_INSTRUCTION;
  const lore = applyLoreBudget(activateLore(input), settings.loreBudget);
  const includedLore = lore
    .filter((item) => item.decision.included)
    .sort((left, right) => left.insertionOrder - right.insertionOrder);
  function lorePart(placement: "before" | "after"): { text: string; detail: string } {
    const entries = includedLore.filter((item) => item.decision.placement === placement);
    return {
      text: entries.map((item) => item.content).join("\n"),
      detail: `${entries.length} entries`,
    };
  }
  const parts: TracePart[] = [];
  const systemTexts: string[] = [];
  function addSystemPart(source: TracePart["source"], text: string, detail?: string): void {
    if (!text.trim()) return;
    systemTexts.push(text);
    parts.push({ source, tokens: estimateTokens(text), ...(detail ? { detail } : {}) });
  }
  addSystemPart("main", replaceMacros(main, names));
  const before = lorePart("before");
  addSystemPart("lore-before", before.text, before.detail);
  addSystemPart("description", replaceMacros(character.description, names));
  addSystemPart("personality", replaceMacros(character.personality, names));
  addSystemPart("scenario", replaceMacros(character.scenario, names));
  const after = lorePart("after");
  addSystemPart("lore-after", after.text, after.detail);
  addSystemPart("examples", replaceMacros(character.exampleMessages, names));
  const system = systemTexts.join("\n\n");
  const postHistory = replaceMacros(character.postHistoryInstructions, names);
  const afterHistory = postHistory.trim() ? postHistory : null;
  const systemTokens = estimateTokens(system);
  const afterTokens = estimateTokens(afterHistory ?? "");
  const history = fitHistory(
    input.history.map((message) => ({ ...message, text: replaceMacros(message.text, names) })),
    contextWindow - settings.replyReserve - systemTokens - afterTokens,
  );
  const historyTokens = history.kept.reduce(
    (sum, message) => sum + estimateTokens(message.text),
    0,
  );
  if (history.kept.length)
    parts.push({
      source: "history",
      tokens: historyTokens,
      detail: `${history.kept.length} messages, ${history.leftOut} left out`,
    });
  if (afterHistory) parts.push({ source: "after-history", tokens: afterTokens });
  return {
    prompt: { system, history: history.kept, afterHistory },
    trace: {
      tokensAreEstimates: true,
      parts,
      lore: lore.map((item) => item.decision),
      history: { included: history.kept.length, leftOut: history.leftOut },
      notes: history.overflow ? ["request exceeds the context window"] : [],
      totalTokens: systemTokens + historyTokens + afterTokens,
    },
  };
}
