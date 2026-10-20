export type FormatLabel =
  | "Character card V3 (JSON)"
  | "Character card V2 (JSON)"
  | "Character card V3 (PNG)"
  | "Character card V2 (PNG)"
  | "Lorebook (SillyTavern world info)"
  | "Lorebook (card format)";

export interface Character {
  name: string;
  description: string;
  personality: string;
  scenario: string;
  firstMessage: string;
  alternateGreetings: string[];
  exampleMessages: string;
  systemPrompt: string;
  postHistoryInstructions: string;
  creatorNotes: string;
  tags: string[];
  creator: string;
  characterVersion: string;
  lorebook: Lorebook | null;
}

export interface Lorebook {
  name: string;
  description: string;
  entries: LorebookEntry[];
}

export interface LorebookEntry {
  keys: string[];
  secondaryKeys: string[];
  content: string;
  enabled: boolean;
  constant: boolean;
  insertionOrder: number;
  name: string;
  source: Record<string, unknown>;
}

interface LibraryItemBase {
  v: 1;
  id: string;
  name: string;
  format: FormatLabel;
  importedAt: string;
  sourceFileName: string;
  originalFile: string;
  sha256: string;
  warnings: string[];
  preservedUnused: string[];
  raw: Record<string, unknown>;
}

export type LibraryItem = LibraryItemBase &
  ({ kind: "character"; character: Character } | { kind: "lorebook"; lorebook: Lorebook });

export type ImportReport =
  | { ok: true; status: "imported" | "already-imported"; item: LibraryItem }
  | { ok: false; file: string; detected: string; reason: string };
