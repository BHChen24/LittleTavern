import type { Character, Lorebook, LorebookEntry } from "../index.ts";
import type { HistoryMessage } from "./types.ts";

export function makeCharacter(overrides: Partial<Character> = {}): Character {
  return {
    name: "",
    description: "",
    personality: "",
    scenario: "",
    firstMessage: "",
    alternateGreetings: [],
    exampleMessages: "",
    systemPrompt: "",
    postHistoryInstructions: "",
    creatorNotes: "",
    tags: [],
    creator: "",
    characterVersion: "",
    lorebook: null,
    ...overrides,
  };
}

export function makeEntry(overrides: Partial<LorebookEntry> = {}): LorebookEntry {
  return {
    keys: [],
    secondaryKeys: [],
    content: "",
    enabled: true,
    constant: false,
    insertionOrder: 0,
    name: "",
    source: {},
    ...overrides,
  };
}

export function makeLorebook(name: string, entries: LorebookEntry[]): Lorebook {
  return { name, description: "", entries };
}

export function chat(...texts: string[]): HistoryMessage[] {
  return texts.map((text, index) => ({ role: index % 2 === 0 ? "user" : "character", text }));
}
