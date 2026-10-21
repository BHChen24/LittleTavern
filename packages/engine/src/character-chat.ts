import { join } from "node:path";
import type { AssistantMessage } from "@earendil-works/pi-ai";
import { type SessionEntry, SessionManager } from "@earendil-works/pi-coding-agent";
import {
  type AppPaths,
  getItem,
  type LibraryItem,
  type Lorebook,
  readActivePersona,
  readRequestSettings,
  readSettings,
  writeSettings,
} from "@littletavern/data";
import { assemblePrompt } from "./assembly/assemble.ts";
import { replaceMacros, resolveNames } from "./assembly/macros.ts";
import type {
  AssembledPrompt,
  AssemblySettings,
  AssemblyTrace,
  HistoryMessage,
} from "./assembly/types.ts";
import type { ChatSession, TurnResult } from "./chat-session.ts";
import { findAllowedModel } from "./models.ts";

export type CharacterItem = Extract<LibraryItem, { kind: "character" }>;
export type LorebookItem = Extract<LibraryItem, { kind: "lorebook" }>;

export interface ChatHistoryItem {
  role: "user" | "character";
  text: string;
  interrupted?: boolean;
  entryId?: string;
}

export interface ChatListEntry {
  path: string;
  sessionId: string;
  characterName: string;
  created: Date;
  modified: Date;
  messageCount: number;
}

// Our own record types inside pi's session file.
const CHARACTER_ENTRY = "littletavern.character";
const GREETING_ENTRY = "littletavern.greeting";

export function sessionsDir(paths: AppPaths): string {
  return join(paths.dataDir, "sessions");
}

/**
 * Builds a character request exactly as a real chat does: current settings, attached
 * lorebooks and the model's context window. Shared by CharacterChat and the dry run (005).
 */
export function assembleForCharacter(options: {
  paths: AppPaths;
  item: CharacterItem;
  history: HistoryMessage[];
  modelId: string;
  replyTokens?: number;
}): { prompt: AssembledPrompt; trace: AssemblyTrace; notices: string[] } {
  const settings = readSettings(options.paths);
  const notices: string[] = [];
  const active = readActivePersona(options.paths);
  if (active.notice) notices.push(active.notice);
  const lorebooks: Lorebook[] = [];
  for (const id of settings.lorebookAttachments?.[options.item.id] ?? []) {
    const attached = getItem(options.paths, id);
    if (attached && attached !== "ambiguous" && attached.kind === "lorebook")
      lorebooks.push(attached.lorebook);
    else notices.push(`Attached lorebook ${id} is no longer in the library; skipped.`);
  }
  const assemblySettings: Partial<AssemblySettings> = {};
  assemblySettings.replyTokens =
    options.replyTokens ?? readRequestSettings(options.paths).replyTokens;
  if (settings.scanDepth !== undefined) assemblySettings.scanDepth = settings.scanDepth;
  if (settings.loreBudget !== undefined) assemblySettings.loreBudget = settings.loreBudget;
  if (settings.replyReserve !== undefined) assemblySettings.replyReserve = settings.replyReserve;
  const { prompt, trace } = assemblePrompt({
    character: options.item.character,
    lorebooks,
    userName: settings.userName,
    persona: active.persona ?? undefined,
    history: options.history,
    contextWindow: findAllowedModel(options.modelId)?.contextWindow,
    settings: assemblySettings,
  });
  return { prompt, trace, notices };
}

/** The greeting as shown and stored: first_mes with {{char}}/{{user}} replaced. */
export function greetingFor(paths: AppPaths, item: CharacterItem): string {
  return replaceMacros(
    item.character.firstMessage,
    resolveNames({
      character: item.character,
      userName: readSettings(paths).userName,
      persona: readActivePersona(paths).persona ?? undefined,
    }),
  ).trim();
}

/** Turns the current branch of a session into chat history; unknown entries are ignored. */
function historyFromEntries(entries: SessionEntry[]): ChatHistoryItem[] {
  const history: ChatHistoryItem[] = [];
  for (const entry of entries) {
    if (entry.type === "custom" && entry.customType === GREETING_ENTRY) {
      const data = entry.data as { text?: unknown } | undefined;
      if (typeof data?.text === "string") history.push({ role: "character", text: data.text });
    }
    if (entry.type !== "message") continue;
    const message = entry.message;
    if (message.role === "user") {
      const text =
        typeof message.content === "string"
          ? message.content
          : message.content.map((block) => (block.type === "text" ? block.text : "")).join("");
      history.push({ role: "user", text, entryId: entry.id });
    }
    if (message.role === "assistant") {
      const text = message.content
        .map((block) => (block.type === "text" ? block.text : ""))
        .join("");
      history.push(
        message.stopReason === "aborted"
          ? { role: "character", text, interrupted: true, entryId: entry.id }
          : { role: "character", text, entryId: entry.id },
      );
    }
  }
  return history;
}

function characterIdOf(manager: SessionManager): { libraryId: string; name: string } | null {
  for (const entry of manager.getEntries()) {
    if (entry.type === "custom" && entry.customType === CHARACTER_ENTRY) {
      const data = entry.data as { libraryId?: unknown; name?: unknown } | undefined;
      if (typeof data?.libraryId === "string")
        return { libraryId: data.libraryId, name: typeof data.name === "string" ? data.name : "" };
    }
  }
  return null;
}

/** The current branch of a saved chat, read without writing anything (used by the dry run). */
export function readChatHistory(paths: AppPaths, sessionPath: string): ChatHistoryItem[] {
  return historyFromEntries(SessionManager.open(sessionPath, sessionsDir(paths)).getBranch());
}

/** Which character a saved chat belongs to, read without writing anything. */
export function readChatCharacter(
  paths: AppPaths,
  sessionPath: string,
): { libraryId: string; name: string } | null {
  return characterIdOf(SessionManager.open(sessionPath, sessionsDir(paths)));
}

export function missingCharacterMessage(name: string): string {
  return `The character for this chat (${name}) is no longer in the library.`;
}

export function listChats(paths: AppPaths): Promise<ChatListEntry[]> {
  return SessionManager.list(paths.dataDir, sessionsDir(paths)).then((sessions) =>
    sessions
      .map((info) => ({
        path: info.path,
        sessionId: info.id,
        characterName: info.name ?? "(unknown)",
        created: info.created,
        modified: info.modified,
        messageCount: info.messageCount,
      }))
      .sort((left, right) => right.modified.getTime() - left.modified.getTime()),
  );
}

/** One saved conversation with one imported character. */
export class CharacterChat {
  readonly item: CharacterItem;
  lastTrace: AssemblyTrace | null = null;
  onNotice?: (text: string) => void;
  private readonly paths: AppPaths;
  private readonly session: ChatSession;
  private readonly manager: SessionManager;
  private readonly noticed = new Set<string>();
  private replaced?: AssistantMessage;

  private constructor(
    paths: AppPaths,
    session: ChatSession,
    item: CharacterItem,
    manager: SessionManager,
  ) {
    this.paths = paths;
    this.session = session;
    this.item = item;
    this.manager = manager;
  }

  static start(options: { paths: AppPaths; session: ChatSession; item: CharacterItem }) {
    const manager = SessionManager.create(options.paths.dataDir, sessionsDir(options.paths));
    const { item } = options;
    manager.appendCustomEntry(CHARACTER_ENTRY, { libraryId: item.id, name: item.character.name });
    manager.appendSessionInfo(item.character.name);
    const greeting = greetingFor(options.paths, item);
    if (greeting) manager.appendCustomEntry(GREETING_ENTRY, { text: greeting });
    return new CharacterChat(options.paths, options.session, item, manager);
  }

  static resume(options: { paths: AppPaths; session: ChatSession; sessionPath: string }) {
    const manager = SessionManager.open(options.sessionPath, sessionsDir(options.paths));
    const character = characterIdOf(manager);
    if (!character) throw new Error("This session is not a LittleTavern character chat.");
    const item = getItem(options.paths, character.libraryId);
    if (!item || item === "ambiguous" || item.kind !== "character")
      throw new Error(missingCharacterMessage(character.name || character.libraryId));
    return new CharacterChat(options.paths, options.session, item, manager);
  }

  get character() {
    return this.item.character;
  }
  get libraryId(): string {
    return this.item.id;
  }
  get sessionId(): string {
    return this.manager.getSessionId();
  }
  get isStreaming(): boolean {
    return this.session.isStreaming;
  }
  abort(): void {
    this.session.abort();
  }
  setModel(modelId: string): void {
    this.session.setModel(modelId);
  }

  history(): ChatHistoryItem[] {
    return historyFromEntries(this.manager.getBranch());
  }

  private messageEntry(entryId: string, role: "user" | "assistant") {
    const entry = this.manager.getBranch().find((item) => item.id === entryId);
    if (entry?.type !== "message" || entry.message.role !== role)
      throw new Error(`The ${role} message is not on the current branch.`);
    return entry;
  }

  async send(text: string): Promise<TurnResult | null> {
    if (this.isStreaming || !text.trim()) return null;
    this.replaced = undefined;
    this.manager.appendMessage({ role: "user", content: text, timestamp: Date.now() });
    return this.generate();
  }

  /**
   * Replaces the last reply: the old reply stays in the file as a sibling (via branch()).
   * A user message at the end gets its missing reply; a greeting cannot be regenerated.
   */
  async regenerate(): Promise<TurnResult | null | "nothing-to-regenerate"> {
    if (this.isStreaming) return null;
    this.replaced = undefined;
    const target = this.regenerateTarget();
    const leaf = this.manager.getLeafEntry();
    if (target === "reply" && leaf?.parentId) {
      this.manager.branch(leaf.parentId);
      const turn = await this.generate();
      if (
        turn &&
        turn.outcome !== "error" &&
        leaf.type === "message" &&
        leaf.message.role === "assistant"
      )
        this.replaced = leaf.message;
      return turn;
    }
    if (target === "user") return this.generate();
    return "nothing-to-regenerate";
  }

  /** Append the chosen sibling so reopening the file preserves the displayed reply. */
  prev(): "restored" | "nothing-to-restore" {
    const leaf = this.manager.getLeafEntry();
    if (
      !this.replaced ||
      this.isStreaming ||
      leaf?.type !== "message" ||
      leaf.message.role !== "assistant" ||
      !leaf.parentId
    )
      return "nothing-to-restore";
    this.manager.branch(leaf.parentId);
    this.manager.appendMessage(this.replaced);
    this.replaced = leaf.message;
    return "restored";
  }

  /** What regenerate() would act on: the last reply, a reply-less user message, or nothing. */
  regenerateTarget(): "reply" | "user" | null {
    const leaf = this.manager.getLeafEntry();
    if (leaf?.type !== "message") return null;
    if (leaf.message.role === "assistant" && leaf.parentId) return "reply";
    if (leaf.message.role === "user") return "user";
    return null;
  }

  attachedLorebookIds(): string[] {
    return readSettings(this.paths).lorebookAttachments?.[this.libraryId] ?? [];
  }

  attachLorebook(id: string): LorebookItem {
    const item = getItem(this.paths, id);
    if (!item || item === "ambiguous" || item.kind !== "lorebook")
      throw new Error(
        item === "ambiguous" ? `Ambiguous lorebook prefix: ${id}` : `Lorebook not found: ${id}`,
      );
    const attachments = readSettings(this.paths).lorebookAttachments ?? {};
    const current = attachments[this.libraryId] ?? [];
    if (!current.includes(item.id))
      writeSettings(this.paths, {
        lorebookAttachments: { ...attachments, [this.libraryId]: [...current, item.id] },
      });
    return item;
  }

  detachLorebook(id: string): boolean {
    const attachments = readSettings(this.paths).lorebookAttachments ?? {};
    const current = attachments[this.libraryId] ?? [];
    const remaining = current.filter((attached) => !attached.startsWith(id));
    if (remaining.length === current.length) return false;
    writeSettings(this.paths, {
      lorebookAttachments: { ...attachments, [this.libraryId]: remaining },
    });
    return true;
  }

  /** The card's own lorebook first, then attached ones that still exist. */
  activeLorebooks(): { name: string; entries: number; attached: boolean; id?: string }[] {
    const books: { name: string; entries: number; attached: boolean; id?: string }[] = [];
    const embedded = this.character.lorebook;
    if (embedded)
      books.push({ name: embedded.name, entries: embedded.entries.length, attached: false });
    for (const id of readSettings(this.paths).lorebookAttachments?.[this.libraryId] ?? []) {
      const item = getItem(this.paths, id);
      if (item && item !== "ambiguous" && item.kind === "lorebook")
        books.push({ name: item.name, entries: item.lorebook.entries.length, attached: true, id });
    }
    return books;
  }

  private async generate(): Promise<TurnResult | null> {
    const history = this.history().map(({ role, text }) => ({ role, text }));
    const { prompt, trace, notices } = assembleForCharacter({
      paths: this.paths,
      item: this.item,
      history,
      modelId: this.session.modelId,
      replyTokens: this.session.request.maxTokens ?? 0,
    });
    for (const notice of notices) {
      if (this.noticed.has(notice)) continue;
      this.noticed.add(notice);
      this.onNotice?.(notice);
    }
    this.lastTrace = trace;
    this.lastTrace.request = this.session.request;
    const turn = await this.session.generate({
      system: prompt.system,
      messages: prompt.history,
      afterHistory: prompt.afterHistory,
    });
    if (turn && turn.outcome !== "error") this.manager.appendMessage(toStoredReply(turn));
    return turn;
  }
}

/** A finished (or interrupted) reply in pi's message shape, for the session file. */
function toStoredReply(turn: TurnResult): AssistantMessage {
  return {
    role: "assistant",
    content: [{ type: "text", text: turn.text }],
    api: (turn.api ?? "openai-completions") as AssistantMessage["api"],
    provider: (turn.provider ?? "openrouter") as AssistantMessage["provider"],
    model: turn.model,
    usage: { ...turn.usage, cost: { ...turn.usage.cost } },
    stopReason: turn.outcome === "interrupted" ? "aborted" : "stop",
    timestamp: Date.parse(turn.startedAt),
    durationMs: turn.durationMs,
  };
}
