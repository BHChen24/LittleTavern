import type { Character, Lorebook, Persona } from "../index.ts";

export interface HistoryMessage {
  role: "user" | "character";
  text: string;
}

export interface AssemblySettings {
  scanDepth: number;
  loreBudget: number;
  replyReserve: number;
  replyTokens?: number;
}

export interface AssemblyInput {
  character: Character;
  lorebooks?: Lorebook[];
  userName?: string;
  persona?: Persona;
  history: HistoryMessage[];
  contextWindow?: number;
  settings?: Partial<AssemblySettings>;
}

export interface AssembledPrompt {
  system: string;
  history: HistoryMessage[];
  afterHistory: string | null;
}

export interface TracePart {
  source:
    | "main"
    | "lore-before"
    | "persona"
    | "description"
    | "personality"
    | "scenario"
    | "lore-after"
    | "examples"
    | "history"
    | "after-history";
  tokens: number;
  detail?: string;
}

export interface LoreDecision {
  lorebook: string;
  index: number;
  entry: string;
  included: boolean;
  reason:
    | { kind: "constant" }
    | { kind: "keyword"; key: string; message: number }
    | { kind: "disabled" }
    | { kind: "no-keywords" }
    | { kind: "no-match"; depth: number }
    | { kind: "budget" };
  placement?: "before" | "after";
  tokens?: number;
  ignoredFeatures: string[];
}

export interface AssemblyTrace {
  tokensAreEstimates: true;
  parts: TracePart[];
  lore: LoreDecision[];
  history: { included: number; leftOut: number };
  notes: string[];
  totalTokens: number;
}

export const DEFAULT_ASSEMBLY_SETTINGS: AssemblySettings = {
  scanDepth: 2,
  loreBudget: 4000,
  replyReserve: 4000,
};
export const DEFAULT_USER_NAME = "Traveler";
export const DEFAULT_CONTEXT_WINDOW = 128000;
export const DEFAULT_MAIN_INSTRUCTION =
  "Write {{char}}'s next reply in a fictional chat between {{char}} and {{user}}.";
