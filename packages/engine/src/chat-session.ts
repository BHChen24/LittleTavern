import { Agent } from "@earendil-works/pi-agent-core";
import { type AssistantMessage, createModels, type Message } from "@earendil-works/pi-ai";
import { fauxAssistantMessage, fauxProvider } from "@earendil-works/pi-ai/providers/faux";
import { openrouterProvider } from "@earendil-works/pi-ai/providers/openrouter";
import { isBlank } from "./api-key.ts";
import { findAllowedModel, type ModelPrice } from "./models.ts";

export interface TurnUsage {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  reasoning?: number;
  totalTokens: number;
  cost: { input: number; output: number; cacheRead: number; cacheWrite: number; total: number };
}
export interface TurnResult {
  outcome: "completed" | "interrupted" | "error";
  text: string;
  errorMessage?: string;
  model: string;
  startedAt: string;
  durationMs: number;
  usage: TurnUsage;
}
export interface SimulatedMessage {
  role: string;
  text: string;
}
export type SimulatedReply =
  | string
  | { text: string; errorMessage: string }
  | ((history: SimulatedMessage[]) => string);
/** A fully assembled request (see 003's AssembledPrompt); used by character chats. */
export interface ChatContext {
  system: string;
  messages: { role: "user" | "character"; text: string }[];
  afterHistory: string | null;
}
export interface ChatSessionOptions {
  modelId: string;
  systemPrompt: string;
  getApiKey: () => string | undefined;
  simulated?: { replies: SimulatedReply[]; price?: ModelPrice };
}

export class ChatSession {
  private agent: Agent;
  private models = createModels();
  private options: ChatSessionOptions;
  private deltas = new Set<(delta: string) => void>();
  private finishes = new Set<(turn: TurnResult) => void | Promise<void>>();
  private finalMessage?: AssistantMessage;
  private sending = false;
  /** Set only while generate() runs: the exact messages the model should see. */
  private pendingContext?: Message[];

  constructor(options: ChatSessionOptions) {
    this.options = options;
    if (options.simulated) {
      const price = options.simulated.price;
      const faux = fauxProvider({
        provider: "openrouter",
        models: [
          {
            id: options.modelId,
            cost: {
              input: price?.inputPerMTok ?? 0,
              output: price?.outputPerMTok ?? 0,
              cacheRead: 0,
              cacheWrite: 0,
            },
          },
        ],
      });
      faux.setResponses(
        options.simulated.replies.map((reply) => (context) => {
          if (typeof reply === "string") return fauxAssistantMessage(reply);
          if (typeof reply === "object")
            return fauxAssistantMessage(reply.text, {
              stopReason: "error",
              errorMessage: reply.errorMessage,
            });
          const history = context.messages.map((message) => ({
            role: message.role,
            text:
              typeof message.content === "string"
                ? message.content
                : message.content
                    .filter((block) => block.type === "text")
                    .map((block) => (block.type === "text" ? block.text : ""))
                    .join(""),
          }));
          return fauxAssistantMessage(reply(history));
        }),
      );
      this.models.setProvider(faux.provider);
    } else {
      this.models.setProvider(openrouterProvider());
    }
    const model = this.models.getModel("openrouter", options.modelId);
    if (!model || !findAllowedModel(options.modelId)) throw new Error("Model is not allowed");
    this.agent = new Agent({
      initialState: { systemPrompt: options.systemPrompt, model, tools: [] },
      streamFn: this.models.streamSimple.bind(this.models),
      getApiKey: () => this.options.getApiKey(),
      // generate() replaces the whole transcript with an assembled context; send() leaves it alone.
      transformContext: async (messages) => this.pendingContext ?? messages,
    });
    this.agent.subscribe((event) => {
      if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
        for (const listener of this.deltas) listener(event.assistantMessageEvent.delta);
      }
      if (event.type === "message_end" && event.message.role === "assistant")
        this.finalMessage = event.message;
    });
  }

  get isStreaming(): boolean {
    return this.sending;
  }
  get modelId(): string {
    return this.agent.state.model.id;
  }
  onDelta(listener: (delta: string) => void): () => void {
    this.deltas.add(listener);
    return () => {
      this.deltas.delete(listener);
    };
  }
  onFinish(listener: (turn: TurnResult) => void | Promise<void>): () => void {
    this.finishes.add(listener);
    return () => {
      this.finishes.delete(listener);
    };
  }
  abort(): void {
    this.agent.abort();
  }
  setModel(modelId: string): void {
    if (this.sending) throw new Error("Cannot change model while streaming");
    const model = this.models.getModel("openrouter", modelId);
    if (!model || !findAllowedModel(modelId)) throw new Error("Model is not allowed");
    this.agent.state.model = model;
  }

  private getFinalMessage(): AssistantMessage | undefined {
    return this.finalMessage;
  }

  async send(text: string): Promise<TurnResult | null> {
    if (this.sending || isBlank(text) || isBlank(this.options.getApiKey())) return null;
    return this.run(() => this.agent.prompt(text));
  }

  /**
   * Runs one turn against a fully assembled context. The plain-chat transcript is restored
   * afterwards, so switching back to plain chat is unaffected.
   */
  async generate(context: ChatContext): Promise<TurnResult | null> {
    const last = context.messages.at(-1);
    if (this.sending || last?.role !== "user" || isBlank(this.options.getApiKey())) return null;
    const saved = [...this.agent.state.messages];
    this.pendingContext = this.toMessages(context);
    try {
      return await this.run(() => this.agent.prompt(last.text));
    } finally {
      this.pendingContext = undefined;
      this.agent.state.messages = saved;
    }
  }

  private toMessages(context: ChatContext): Message[] {
    const model = this.agent.state.model;
    const now = Date.now();
    const messages: Message[] = [{ role: "system", content: context.system, timestamp: now }];
    for (const message of context.messages) {
      if (message.role === "user") {
        messages.push({ role: "user", content: message.text, timestamp: now });
        continue;
      }
      messages.push({
        role: "assistant",
        content: [{ type: "text", text: message.text }],
        api: model.api,
        provider: model.provider,
        model: model.id,
        usage: {
          input: 0,
          output: 0,
          cacheRead: 0,
          cacheWrite: 0,
          totalTokens: 0,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
        },
        stopReason: "stop",
        timestamp: now,
      });
    }
    if (context.afterHistory)
      messages.push({ role: "system", content: context.afterHistory, timestamp: now });
    return messages;
  }

  private async run(prompt: () => Promise<void>): Promise<TurnResult> {
    this.sending = true;
    this.finalMessage = undefined;
    const started = Date.now();
    try {
      await prompt();
      const message = this.getFinalMessage();
      if (!message) throw new Error("Request ended without an assistant message");
      const turn: TurnResult = {
        outcome:
          message.stopReason === "aborted"
            ? "interrupted"
            : message.stopReason === "error"
              ? "error"
              : "completed",
        text: message.content
          .filter((block) => block.type === "text")
          .map((block) => (block.type === "text" ? block.text : ""))
          .join(""),
        errorMessage: message.errorMessage,
        model: message.model,
        startedAt: new Date(started).toISOString(),
        durationMs: message.durationMs ?? Date.now() - started,
        usage: { ...message.usage, cost: { ...message.usage.cost } },
      };
      for (const listener of this.finishes) await listener(turn);
      return turn;
    } finally {
      this.sending = false;
    }
  }
}
