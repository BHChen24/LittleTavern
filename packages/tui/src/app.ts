import { randomUUID } from "node:crypto";
import {
  Container,
  Editor,
  Markdown,
  matchesKey,
  ProcessTerminal,
  type Terminal,
  Text,
  TuiMainScreen,
} from "@earendil-works/pi-tui";
import {
  type AppPaths,
  appendUsageRecord,
  CharacterChat,
  type CharacterItem,
  type ChatHistoryItem,
  ChatSession,
  createLogger,
  DEFAULT_ASSEMBLY_SETTINGS,
  DEFAULT_MODEL_ID,
  DEFAULT_SYSTEM_PROMPT,
  describeProviderError,
  findAllowedModel,
  forgetKey,
  getItem,
  importFile,
  listChats,
  listLibrary,
  readSavedKey,
  readSettings,
  resolveApiKey,
  resolveAppPaths,
  saveKey,
  scrubSecrets,
  sumUsage,
  toUsageRecord,
  type UsageRecord,
  writeSettings,
} from "@littletavern/engine";
import { KeyPrompt } from "./components/key-prompt.ts";
import { ListPicker } from "./components/list-picker.ts";
import { ModelPicker } from "./components/model-picker.ts";
import { StatusBar } from "./components/status-bar.ts";
import { TraceOverlay } from "./components/trace-overlay.ts";
import { formatImportReport, formatItemDetails, formatLibraryList } from "./library-format.ts";
import { stripControls } from "./sanitize.ts";
import { editorTheme, markdownTheme } from "./theme.ts";
import { formatTraceReport } from "./trace-format.ts";
import { VERSION } from "./version.ts";

export const APP_HELP = `/characters     Choose a character and start a chat
/chat <id>      Start a chat with a character
/sessions       Resume a saved chat
/regenerate     Regenerate the last reply (Ctrl+R)
/attach <id>    Attach a lorebook to the current character
/detach <id>    Detach a lorebook
/lorebooks      List the active lorebooks
/trace          Show why the last request looked the way it did
/plain          Leave the character chat
/import <path>  Import a card or lorebook
/library        List the library
/show <id>      Inspect an item
/help        Show commands and key bindings
/model       Choose a model
/key         Replace the key
/forget-key  Forget the saved key
/quit        Quit
Ctrl+C       Quit
Esc          Interrupt generation; close help
Enter        Send a message`;

export interface AppOptions {
  terminal?: Terminal;
  env?: Readonly<Record<string, string | undefined>>;
  paths?: AppPaths;
  session?: ChatSession;
}

export function createApp(options: AppOptions = {}) {
  const env = options.env ?? process.env;
  const paths = options.paths ?? resolveAppPaths(env);
  const settings = readSettings(paths);
  const storedModel = findAllowedModel(settings.model);
  let modelId = storedModel?.id ?? DEFAULT_MODEL_ID;
  const saved = readSavedKey(paths);
  let activeKey = resolveApiKey({ envValue: env.OPENROUTER_API_KEY, savedValue: saved.key });
  const secrets = [env.OPENROUTER_API_KEY, saved.key].filter((value): value is string =>
    Boolean(value?.trim()),
  );
  const sessionId = randomUUID();
  const records: UsageRecord[] = [];
  const logger = createLogger(paths.logFile, () => secrets);
  const session =
    options.session ??
    new ChatSession({
      modelId,
      systemPrompt: DEFAULT_SYSTEM_PROMPT,
      getApiKey: () => activeKey?.value,
    });
  const tui = new TuiMainScreen(options.terminal ?? new ProcessTerminal());
  const transcript = new Container();
  const editor = new Editor(tui, editorTheme);
  const status = new StatusBar(modelId, activeKey?.source ?? "none");
  tui.addChild(new Text(`LittleTavern ${VERSION}`));
  tui.addChild(transcript);
  tui.addChild(editor);
  tui.addChild(status);
  tui.setFocus(editor);
  let reply: Markdown | undefined;
  let chat: CharacterChat | null = null;
  let response = "";
  let running: Promise<unknown> | undefined;
  let closing: Promise<void> | undefined;
  let resolveDone: () => void = () => {};
  const done = new Promise<void>((resolve) => {
    resolveDone = resolve;
  });
  let started = false;
  let helpOpen = false;
  let needsKey = !activeKey;
  let keyPrompt: KeyPrompt | undefined;
  /** Untrusted text (cards, lore, replies, errors) as it may be shown: no key, no escapes. */
  const display = (text: string) => stripControls(scrubSecrets(text, secrets));
  const notice = (text: string) => {
    transcript.addChild(new Text(display(text)));
    tui.requestRender();
  };
  function promptForKey(): void {
    needsKey = true;
    editor.disableSubmit = true;
    keyPrompt = new KeyPrompt(paths.credentialsFile);
    keyPrompt.onCommand = (command) => {
      tui.hideOverlay();
      keyPrompt = undefined;
      tui.setFocus(editor);
      editor.disableSubmit = false;
      void submit(command);
    };
    keyPrompt.onResult = ({ key, save }) => {
      secrets.push(key);
      let source: "saved" | "session" = "session";
      if (save) {
        try {
          saveKey(paths, key);
          source = "saved";
        } catch {
          notice("Could not save the key; using it for this session only.");
        }
      }
      // Explicit replacement must supersede a rejected environment key for this run.
      activeKey = { value: key, source, masked: `••••${key.slice(-4)}` };
      needsKey = false;
      keyPrompt = undefined;
      tui.hideOverlay();
      tui.setFocus(editor);
      editor.disableSubmit = false;
      updateStatus();
      tui.requestRender();
    };
    tui.showOverlay(keyPrompt, { width: "90%" });
    tui.requestRender();
  }
  if (settings.model && !storedModel)
    notice(`Saved model ${settings.model} is unavailable; using ${DEFAULT_MODEL_ID}.`);
  if (saved.warning)
    notice("Saved credentials permissions allow access by other users; expected 0600.");
  if (saved.error) notice(saved.error);
  if (needsKey) promptForKey();

  function updateStatus(): void {
    const totals = sumUsage(records);
    status.update(
      modelId,
      activeKey?.source ?? "none",
      `${totals.inputTokens}/${totals.outputTokens} | $${totals.cost.toFixed(4)}${totals.incomplete ? "~" : ""}`,
      chat?.character.name,
    );
  }
  updateStatus();

  function renderHistory(items: ChatHistoryItem[]): void {
    transcript.clear();
    for (const item of items) {
      const text = display(item.text) + (item.interrupted ? " [interrupted]" : "");
      transcript.addChild(new Markdown(text, 1, 1, markdownTheme));
    }
    tui.requestRender();
  }
  function enterChat(next: CharacterChat): void {
    chat = next;
    chat.onNotice = notice;
    renderHistory(chat.history());
    updateStatus();
  }
  function closeOverlay(): void {
    tui.hideOverlay();
    tui.setFocus(editor);
    tui.requestRender();
  }
  function startChat(item: CharacterItem): void {
    try {
      enterChat(CharacterChat.start({ paths, session, item }));
    } catch (error) {
      logger.error(error instanceof Error ? error : { error: String(error) }, "Chat start failed");
      notice("Could not start the chat. See the diagnostic log.");
    }
  }
  function openCharacterPicker(): void {
    const characters = listLibrary(paths).filter(
      (item): item is CharacterItem => item.kind === "character",
    );
    const picker = new ListPicker(
      "Choose a character (Enter starts a chat, Esc cancels)",
      characters.map((item) => ({
        value: item,
        label: stripControls(item.name),
        description: item.id,
        search: `${item.name} ${item.id}`,
      })),
      "Filter characters",
    );
    picker.onCancel = closeOverlay;
    picker.onSelect = (item) => {
      closeOverlay();
      startChat(item);
    };
    tui.showOverlay(picker, { width: "90%" });
  }
  async function openSessionPicker(): Promise<void> {
    const chats = await listChats(paths);
    const picker = new ListPicker(
      "Resume a chat (Enter resumes, Esc cancels)",
      chats.map((entry) => ({
        value: entry.path,
        label: stripControls(entry.characterName),
        description: `started ${entry.created.toLocaleString()} · last ${entry.modified.toLocaleString()} · ${entry.messageCount} messages`,
        search: entry.characterName,
      })),
      "Filter chats",
    );
    picker.onCancel = closeOverlay;
    picker.onSelect = (path) => {
      closeOverlay();
      try {
        enterChat(CharacterChat.resume({ paths, session, sessionPath: path }));
      } catch (error) {
        notice(error instanceof Error ? error.message : "Could not resume the chat.");
      }
    };
    tui.showOverlay(picker, { width: "90%" });
  }
  async function regenerate(): Promise<void> {
    if (!chat) {
      notice("Start a character chat first (/characters).");
      return;
    }
    if (closing || chat.isStreaming || needsKey) return;
    const target = chat.regenerateTarget();
    if (!target) {
      notice("Nothing to regenerate yet: send a message first.");
      return;
    }
    const history = chat.history();
    renderHistory(target === "reply" ? history.slice(0, -1) : history);
    await stream(() => (chat ? chat.regenerate() : Promise.resolve(null)));
  }
  async function stream(run: () => Promise<unknown>): Promise<void> {
    reply = new Markdown("", 1, 1, markdownTheme);
    transcript.addChild(reply);
    response = "";
    editor.disableSubmit = true;
    running = run();
    try {
      await running;
    } catch (error) {
      logger.error(error instanceof Error ? error : { error: String(error) }, "Chat failed");
      notice("Chat request failed. See the diagnostic log.");
    } finally {
      editor.disableSubmit = needsKey;
      tui.requestRender();
    }
  }
  const onDelta = session.onDelta((delta) => {
    response += delta;
    reply?.setText(display(response));
    tui.requestRender();
  });
  const onFinish = session.onFinish((turn) => {
    const record = toUsageRecord(turn, {
      sessionId: chat?.sessionId ?? sessionId,
      modelPrice: findAllowedModel(turn.model)?.price ?? null,
      secrets,
    });
    try {
      appendUsageRecord(paths.usageLedgerFile, record);
      records.push(record);
      updateStatus();
    } catch (error) {
      logger.error(
        error instanceof Error ? error : { error: String(error) },
        "Could not append usage",
      );
      notice("Could not write usage to the ledger. Session totals include only saved records.");
    }
    response = turn.text;
    reply?.setText(display(response) + (turn.outcome === "interrupted" ? " [interrupted]" : ""));
    if (turn.outcome === "error") {
      notice(
        describeProviderError(scrubSecrets(turn.errorMessage ?? "Unknown error", secrets)).text,
      );
      logger.error({ error: turn.errorMessage }, "Provider request failed");
      if (describeProviderError(turn.errorMessage ?? "").kind === "key-rejected") promptForKey();
    }
    tui.requestRender();
  });

  function quit(): Promise<void> {
    if (closing) return closing;
    closing = (async () => {
      session.abort();
      try {
        await running;
      } finally {
        onDelta();
        onFinish();
        if (started) tui.stop();
        process.off("SIGINT", onSignal);
        process.off("SIGTERM", onSignal);
        process.off("uncaughtException", onCrash);
        process.off("unhandledRejection", onCrash);
        resolveDone();
      }
    })();
    return closing;
  }
  const onSignal = () => {
    void quit();
  };
  const onCrash = (error: unknown) => {
    logger.error(error instanceof Error ? error : { error: String(error) }, "Application failed");
    process.exitCode = 1;
    void quit();
  };

  async function submit(value: string): Promise<void> {
    const text = value.trim();
    if (closing || session.isStreaming || !text) return;
    editor.setText("");
    if (text === "/quit") {
      await quit();
      return;
    }
    if (text === "/key") {
      promptForKey();
      return;
    }
    if (text === "/forget-key") {
      try {
        forgetKey(paths);
      } catch {
        notice("Could not forget the saved key; check the credentials file.");
        return;
      }
      if (activeKey?.source !== "environment") {
        activeKey = null;
        updateStatus();
        promptForKey();
      } else notice("Saved key forgotten; the environment key remains active.");
      return;
    }
    if (text === "/import" || text.startsWith("/import ")) {
      const file = text.slice("/import".length).trim();
      notice(
        file ? formatImportReport(importFile(paths, file)).join("\n") : "Usage: /import <path>",
      );
      return;
    }
    if (text === "/library") {
      notice(formatLibraryList(listLibrary(paths)).join("\n"));
      return;
    }
    if (text === "/show" || text.startsWith("/show ")) {
      const id = text.slice("/show".length).trim();
      if (!id) {
        notice("Usage: /show <id>");
        return;
      }
      const item = getItem(paths, id);
      notice(
        item === "ambiguous"
          ? `Ambiguous item prefix: ${id}`
          : item
            ? formatItemDetails(item).join("\n")
            : `Item not found: ${id}`,
      );
      return;
    }
    if (text === "/characters") {
      openCharacterPicker();
      return;
    }
    if (text === "/chat" || text.startsWith("/chat ")) {
      const id = text.slice("/chat".length).trim();
      const item = id ? getItem(paths, id) : null;
      if (!id) notice("Usage: /chat <id>");
      else if (item === "ambiguous") notice(`Ambiguous item prefix: ${id}`);
      else if (item?.kind !== "character") notice(`Character not found: ${id}`);
      else startChat(item);
      return;
    }
    if (text === "/sessions") {
      await openSessionPicker();
      return;
    }
    if (text === "/trace") {
      if (!chat) {
        notice("The trace is available in character chats (/characters).");
        return;
      }
      if (!chat.lastTrace) {
        notice("No request yet — send a message, or use `littletavern dry-run`.");
        return;
      }
      const width = tui.terminal.columns;
      const lines = formatTraceReport(
        chat.lastTrace,
        {
          characterName: chat.character.name,
          modelId: session.modelId,
          loreBudget: readSettings(paths).loreBudget ?? DEFAULT_ASSEMBLY_SETTINGS.loreBudget,
        },
        Math.max(40, Math.floor(width * 0.9) - 2),
      );
      const overlay = new TraceOverlay(lines, Math.max(5, tui.terminal.rows - 6));
      overlay.onClose = closeOverlay;
      tui.showOverlay(overlay, { width: "90%" });
      tui.requestRender();
      return;
    }
    if (text === "/plain") {
      chat = null;
      transcript.clear();
      notice("Plain chat. Use /characters to start a character chat.");
      updateStatus();
      return;
    }
    if (text === "/lorebooks" || text.startsWith("/attach") || text.startsWith("/detach")) {
      if (!chat) {
        notice("Start a character chat first (/characters).");
        return;
      }
      if (text === "/lorebooks") {
        const books = chat.activeLorebooks();
        notice(
          books.length === 0
            ? "No lorebooks. Attach one with /attach <id>."
            : books
                .map(
                  (book) =>
                    `${book.attached ? `attached ${book.id ?? ""}` : "card"} · ${book.name} · ${book.entries} entries`,
                )
                .join("\n"),
        );
        return;
      }
      const id = text.replace(/^\/(attach|detach)/, "").trim();
      if (!id) {
        notice(`Usage: ${text.startsWith("/attach") ? "/attach" : "/detach"} <id>`);
        return;
      }
      try {
        if (text.startsWith("/attach")) notice(`Attached ${chat.attachLorebook(id).name}.`);
        else notice(chat.detachLorebook(id) ? "Detached." : `Not attached: ${id}`);
      } catch (error) {
        notice(error instanceof Error ? error.message : "Could not change lorebooks.");
      }
      return;
    }
    if (needsKey) {
      promptForKey();
      return;
    }
    if (text === "/regenerate") {
      await regenerate();
      return;
    }
    if (text === "/model") {
      const picker = new ModelPicker();
      picker.onCancel = () => {
        tui.hideOverlay();
        tui.requestRender();
      };
      picker.onSelect = (model) => {
        try {
          session.setModel(model.id);
          modelId = model.id;
        } catch {
          notice("Could not select that model.");
          return;
        }
        try {
          writeSettings(paths, { model: model.id });
        } catch {
          notice("Could not save the selected model; using it for this session only.");
        }
        tui.hideOverlay();
        updateStatus();
        tui.requestRender();
      };
      tui.showOverlay(picker, { width: "90%" });
      return;
    }
    if (text === "/help") {
      const help = new Text(APP_HELP);
      tui.showOverlay(help);
      helpOpen = true;
      return;
    }
    if (text.startsWith("/")) {
      notice("Unknown command. Use /help.");
      return;
    }
    if (!activeKey) return;
    transcript.addChild(new Markdown(display(value), 1, 1, markdownTheme));
    const current = chat;
    await stream(() => (current ? current.send(value) : session.send(value)));
  }
  editor.onSubmit = (value) => {
    void submit(value);
  };
  tui.addInputListener((data) => {
    if (matchesKey(data, "ctrl+c")) {
      void quit();
      return { consume: true };
    }
    if (matchesKey(data, "ctrl+r")) {
      void regenerate();
      return { consume: true };
    }
    if (matchesKey(data, "escape") && session.isStreaming) {
      session.abort();
      return { consume: true };
    }
    if (matchesKey(data, "escape") && helpOpen) {
      tui.hideOverlay();
      helpOpen = false;
      return { consume: true };
    }
    return undefined;
  });
  return {
    tui,
    editor,
    session,
    get chat() {
      return chat;
    },
    submit,
    quit,
    done,
    start() {
      started = true;
      process.on("SIGINT", onSignal);
      process.on("SIGTERM", onSignal);
      process.on("uncaughtException", onCrash);
      process.on("unhandledRejection", onCrash);
      try {
        tui.start();
      } catch (error) {
        tui.stop();
        onCrash(error);
      }
    },
  };
}

export async function startApp(): Promise<void> {
  const app = createApp();
  try {
    app.start();
    await app.done;
  } finally {
    await app.quit();
  }
}
