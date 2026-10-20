import { randomUUID } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  CombinedAutocompleteProvider,
  Container,
  Editor,
  matchesKey,
  ProcessTerminal,
  ScrollView,
  Spacer,
  type Terminal,
  Text,
  TuiAltScreen,
  VStack,
} from "@earendil-works/pi-tui";
import {
  type AppPaths,
  appendUsageRecord,
  CHARACTER_TEMPLATE,
  CharacterChat,
  type CharacterItem,
  type ChatHistoryItem,
  ChatSession,
  copyText,
  createCharacterFromDraft,
  createLogger,
  createPersonaFromDraft,
  DEFAULT_ASSEMBLY_SETTINGS,
  DEFAULT_MODEL_ID,
  DEFAULT_SYSTEM_PROMPT,
  describeProviderError,
  ensureImportFolders,
  findAllowedModel,
  forgetKey,
  getItem,
  importFile,
  listChats,
  listLibrary,
  listPersonas,
  PERSONA_TEMPLATE,
  type PersonaItem,
  parsePersona,
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
import { COMMANDS, helpText } from "./commands.ts";
import { FileBrowser } from "./components/file-browser.ts";
import { HomeScreen } from "./components/home-screen.ts";
import { KeyPrompt } from "./components/key-prompt.ts";
import { ListPicker, type PickerItem } from "./components/list-picker.ts";
import { MessageView } from "./components/message-view.ts";
import { ModelPicker } from "./components/model-picker.ts";
import { StatusBar } from "./components/status-bar.ts";
import { TraceOverlay } from "./components/trace-overlay.ts";
import { openInEditor } from "./editor-launch.ts";
import { formatImportReport, formatItemDetails, formatLibraryList } from "./library-format.ts";
import { stripControls } from "./sanitize.ts";
import { editorTheme, markdownTheme, messageStyles } from "./theme.ts";
import { formatTraceReport } from "./trace-format.ts";
import { VERSION } from "./version.ts";

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
  const tui = new TuiAltScreen(options.terminal ?? new ProcessTerminal(), undefined, undefined, {
    mouse: settings.mouse !== false,
    copyOnSelect: true,
    copySelection: copyText,
  });
  const transcript = new Container();
  const editor = new Editor(tui, editorTheme);
  const status = new StatusBar({ model: modelId, keySource: activeKey?.source ?? "none" });
  const homeScreen = new HomeScreen({
    version: VERSION,
    keyStatus: activeKey?.source ?? "none",
    libraryEmpty: listLibrary(paths).length === 0,
    importDirs: [paths.importCharactersDir, paths.importLorebooksDir],
  });
  let inChat = false;
  homeScreen.onEnter = enterChat;
  tui.addChild(homeScreen);
  tui.setFocus(homeScreen);
  function enterChat(): void {
    if (inChat) return;
    inChat = true;
    tui.clear();
    const header = new Text(`LittleTavern ${VERSION}`);
    tui.addChild(header);
    tui.addChild(transcript);
    tui.addChild(editor);
    tui.addChild(status);
    tui.setLayoutRoot(
      new VStack([
        { component: header, shrink: 1, minSize: 0 },
        {
          component: new ScrollView(transcript, { primary: true, follow: "end" }),
          basis: 0,
          grow: 1,
          minSize: 1,
        },
        { component: editor, shrink: 1, minSize: 3 },
        { component: status, shrink: 1, minSize: 0 },
      ]),
    );
    tui.setFocus(editor);
    tui.requestRender();
  }
  let reply: MessageView | undefined;
  let chat: CharacterChat | null = null;
  const commands = COMMANDS({ paths, getChat: () => chat });
  editor.setAutocompleteProvider(new CombinedAutocompleteProvider(commands, paths.importRoot));
  let response = "";
  let running: Promise<unknown> | undefined;
  let closing: Promise<void> | undefined;
  let resolveDone: () => void = () => {};
  const done = new Promise<void>((resolve) => {
    resolveDone = resolve;
  });
  let started = false;
  let helpOpen = false;
  /** Untrusted text (cards, lore, replies, errors) as it may be shown: no key, no escapes. */
  const display = (text: string) => stripControls(scrubSecrets(text, secrets));
  const notice = (text: string, options: { kind?: "notice" | "error" } = {}) => {
    const content =
      options.kind === "error"
        ? messageStyles.error(`${markdownTheme.bold("Error:")} ${display(text)}`)
        : messageStyles.notice(`· ${display(text)}`);
    transcript.addChild(new Text(content));
    tui.requestRender();
  };
  const errorNotice = (text: string) => notice(text, { kind: "error" });
  function showImportReport(file: string): void {
    const report = importFile(paths, file);
    notice(formatImportReport(report).join("\n"), { kind: report.ok ? "notice" : "error" });
  }
  function promptForKey(): void {
    const keyPrompt = new KeyPrompt(paths.credentialsFile);
    keyPrompt.onCancel = closeOverlay;
    keyPrompt.onResult = ({ key, save }) => {
      const replacedEnvironment = Boolean(env.OPENROUTER_API_KEY?.trim());
      secrets.push(key);
      let source: "saved" | "session" = "session";
      if (save) {
        try {
          saveKey(paths, key);
          source = "saved";
        } catch {
          errorNotice("Could not save the key; using it for this session only.");
        }
      }
      activeKey = { value: key, source, masked: `••••${key.slice(-4)}` };
      closeOverlay();
      updateStatus();
      if (replacedEnvironment)
        notice("OPENROUTER_API_KEY in the environment will be used again next launch.");
    };
    tui.showOverlay(keyPrompt, { width: "90%" });
    tui.requestRender();
  }
  function openApiKeyPicker(): void {
    const provider = new ListPicker("Choose a provider", [
      {
        value: "openrouter",
        label: "OpenRouter",
        search: "OpenRouter",
        description: activeKey ? `API key: ${activeKey.source}` : "No API key yet",
      },
    ]);
    provider.onCancel = closeOverlay;
    provider.onSelect = () => {
      closeOverlay();
      if (!activeKey) {
        promptForKey();
        return;
      }
      const actions = new ListPicker(`OpenRouter API key (${activeKey.source})`, [
        { value: "replace", label: "Enter a new key", search: "Enter a new key" },
        ...(readSavedKey(paths).key
          ? [{ value: "forget", label: "Forget saved key", search: "Forget saved key" }]
          : []),
      ]);
      actions.onCancel = closeOverlay;
      actions.onSelect = (action) => {
        closeOverlay();
        if (action === "replace") {
          promptForKey();
          return;
        }
        try {
          forgetKey(paths);
          if (activeKey?.source !== "environment") activeKey = null;
          notice(
            activeKey?.source === "environment"
              ? "Saved key forgotten; the environment key remains active."
              : "Saved key forgotten.",
          );
          updateStatus();
        } catch {
          errorNotice("Could not forget the saved key; check the credentials file.");
        }
        closeOverlay();
      };
      tui.showOverlay(actions, { width: "90%" });
    };
    tui.showOverlay(provider, { width: "90%" });
  }
  function interceptMissingKey(value: string): boolean {
    if (activeKey) return false;
    editor.setText(value);
    notice("No API key yet. Type /apikey to add your OpenRouter key.");
    return true;
  }
  const importNotice = ensureImportFolders(paths);
  if (importNotice) notice(importNotice);
  if (settings.model && !storedModel)
    notice(`Saved model ${settings.model} is unavailable; using ${DEFAULT_MODEL_ID}.`);
  if (saved.warning)
    notice("Saved credentials permissions allow access by other users; expected 0600.");
  if (saved.error) errorNotice(saved.error);

  function updateStatus(): void {
    status.update({
      model: modelId,
      keySource: activeKey?.source ?? "none",
      character: chat?.character.name,
      totals: sumUsage(records),
    });
  }
  updateStatus();

  function addMessage(role: "user" | "character", text: string): MessageView {
    const label = role === "user" ? "You" : display(chat?.character.name ?? "Assistant");
    const message = new MessageView(role, label, text);
    transcript.addChild(message);
    transcript.addChild(new Spacer(1));
    return message;
  }
  function renderHistory(items: ChatHistoryItem[]): void {
    transcript.clear();
    for (const item of items) {
      const text = display(item.text) + (item.interrupted ? " [interrupted]" : "");
      addMessage(item.role, text);
    }
    tui.requestRender();
  }
  function setCharacterChat(next: CharacterChat): void {
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
      setCharacterChat(CharacterChat.start({ paths, session, item }));
    } catch (error) {
      logger.error(error instanceof Error ? error : { error: String(error) }, "Chat start failed");
      errorNotice("Could not start the chat. See the diagnostic log.");
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
  function editCharacter(draftPath?: string): void {
    let draft = draftPath;
    try {
      if (!draft) {
        const folder = join(paths.importRoot, "drafts");
        mkdirSync(folder, { recursive: true });
        draft = join(folder, `new-character-${Date.now()}.md`);
        writeFileSync(draft, CHARACTER_TEMPLATE, { flag: "wx" });
      }
      tui.stop();
      try {
        const result = openInEditor(draft, env.VISUAL || env.EDITOR);
        if (!result.ok) {
          errorNotice(`${result.reason} Draft kept at ${draft}`);
          return;
        }
      } finally {
        tui.start();
        tui.requestRender(true);
      }
      const result = createCharacterFromDraft(paths, draft, VERSION);
      if ("error" in result) errorNotice(`${result.error} Draft kept at ${result.draftPath}`);
      else if ("cancelled" in result) notice("Cancelled — the template was not changed.");
      else {
        notice(formatImportReport(result).join("\n"));
        notice(`Created with LittleTavern ${VERSION}.`);
        for (const warning of result.warnings) notice(`Warning: ${warning}`);
        notice(`Start chatting with /chat ${result.item.id}`);
      }
    } catch (error) {
      errorNotice(
        `${error instanceof Error ? error.message : String(error)} Draft path: ${draft ?? join(paths.importRoot, "drafts")}`,
      );
    }
  }
  function newCharacter(): void {
    const folder = join(paths.importRoot, "drafts");
    try {
      mkdirSync(folder, { recursive: true });
      const drafts = readdirSync(folder, { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
        .map((entry) => entry.name)
        .sort();
      if (!drafts.length) {
        editCharacter();
        return;
      }
      const picker = new ListPicker<string | undefined>(
        "Continue a draft or start a new character (Esc cancels)",
        [
          ...drafts.map((name) => ({
            value: join(folder, name),
            label: `Continue ${display(name)}`,
            search: name,
          })),
          { value: undefined, label: "Start a new character", search: "Start a new character" },
        ],
      );
      picker.onCancel = closeOverlay;
      picker.onSelect = (draft) => {
        closeOverlay();
        editCharacter(draft);
      };
      tui.showOverlay(picker, { width: "90%" });
      tui.requestRender();
    } catch (error) {
      errorNotice(
        `${error instanceof Error ? error.message : String(error)} Draft folder: ${folder}`,
      );
    }
  }
  function editPersona(existingFile?: string): void {
    let file = existingFile;
    let draft: string | undefined;
    try {
      if (!file) {
        const folder = join(paths.importRoot, "drafts", "personas");
        mkdirSync(folder, { recursive: true });
        draft = join(folder, `new-persona-${randomUUID()}.md`);
        writeFileSync(draft, PERSONA_TEMPLATE, { flag: "wx" });
      }
      const editorPath = file ? join(paths.importPersonasDir, file) : draft;
      if (!editorPath) return;
      tui.stop();
      try {
        const result = openInEditor(editorPath, env.VISUAL || env.EDITOR);
        if (!result.ok) {
          errorNotice(`${result.reason} File kept at ${editorPath}`);
          return;
        }
      } finally {
        tui.start();
        tui.requestRender(true);
      }
      if (draft) {
        const result = createPersonaFromDraft(paths, draft);
        if ("error" in result) {
          errorNotice(`${result.error} Draft kept at ${result.draftPath}`);
          return;
        }
        if ("cancelled" in result) {
          notice(`Cancelled — the template was not changed. Draft kept at ${draft}`);
          return;
        }
        file = result.file;
      }
      if (!file) return;
      const persona = parsePersona(readFileSync(join(paths.importPersonasDir, file), "utf8"));
      if ("error" in persona) {
        errorNotice(`${persona.error} File kept at ${join(paths.importPersonasDir, file)}`);
        return;
      }
      writeSettings(paths, { persona: file });
      notice(`You are now ${persona.name}`);
    } catch (error) {
      errorNotice(
        `${error instanceof Error ? error.message : String(error)} File path: ${draft ?? file}`,
      );
    }
  }
  function openPersonaPicker(): void {
    try {
      const personas = listPersonas(paths);
      const activeFile = readSettings(paths).persona;
      const active = personas.find((item) => item.file === activeFile);
      type Choice = PersonaItem | "new" | "edit" | "none";
      const entries: PickerItem<Choice>[] = personas.map((item) => ({
        value: item,
        label: `${item.file === activeFile ? "● " : ""}${display("name" in item ? item.name : item.file)}`,
        description: display("error" in item ? item.error : item.file),
        search: `${"name" in item ? item.name : ""} ${item.file}`,
      }));
      entries.push({ value: "new", label: "New persona", search: "New persona" });
      if (active)
        entries.push({
          value: "edit",
          label: "Edit active persona",
          search: "Edit active persona",
        });
      entries.push({ value: "none", label: "No persona", search: "No persona" });
      const picker = new ListPicker("Choose who you are in the story", entries);
      picker.onCancel = closeOverlay;
      picker.onSelect = (choice) => {
        if (typeof choice === "object" && "error" in choice) return;
        closeOverlay();
        if (choice === "new") editPersona();
        else if (choice === "edit" && active) editPersona(active.file);
        else if (choice === "none") {
          writeSettings(paths, { persona: null });
          notice("No persona is active.");
        } else if (typeof choice === "object") {
          writeSettings(paths, { persona: choice.file });
          notice(`You are now ${choice.name}`);
        }
      };
      tui.showOverlay(picker, { width: "90%" });
      tui.requestRender();
    } catch (error) {
      errorNotice(error instanceof Error ? error.message : String(error));
    }
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
        setCharacterChat(CharacterChat.resume({ paths, session, sessionPath: path }));
      } catch (error) {
        errorNotice(error instanceof Error ? error.message : "Could not resume the chat.");
      }
    };
    tui.showOverlay(picker, { width: "90%" });
  }
  async function regenerate(value = editor.getText()): Promise<void> {
    if (interceptMissingKey(value)) return;
    if (!chat) {
      errorNotice("Start a character chat first (/characters).");
      return;
    }
    if (closing || chat.isStreaming) return;
    const target = chat.regenerateTarget();
    if (!target) {
      errorNotice("Nothing to regenerate yet: send a message first.");
      return;
    }
    const history = chat.history();
    renderHistory(target === "reply" ? history.slice(0, -1) : history);
    await stream(() => (chat ? chat.regenerate() : Promise.resolve(null)));
  }
  async function stream(run: () => Promise<unknown>): Promise<void> {
    reply = addMessage("character", "");
    response = "";
    editor.disableSubmit = true;
    running = run();
    try {
      await running;
    } catch (error) {
      logger.error(error instanceof Error ? error : { error: String(error) }, "Chat failed");
      errorNotice("Chat request failed. See the diagnostic log.");
    } finally {
      editor.disableSubmit = false;
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
      errorNotice(
        "Could not write usage to the ledger. Session totals include only saved records.",
      );
    }
    response = turn.text;
    reply?.setText(display(response) + (turn.outcome === "interrupted" ? " [interrupted]" : ""));
    if (turn.outcome === "error") {
      const error = describeProviderError(
        scrubSecrets(turn.errorMessage ?? "Unknown error", secrets),
      );
      if (error.kind === "key-rejected") {
        activeKey = null;
        updateStatus();
        errorNotice("OpenRouter rejected the key. Type /apikey to replace it.");
      } else errorNotice(error.text);
      logger.error({ error: turn.errorMessage }, "Provider request failed");
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
    if (text === "/key" || text === "/forget-key") {
      notice(`${text} was replaced by /apikey.`);
      return;
    }
    const changeLorebooks = () => {
      if (!chat) {
        errorNotice("Start a character chat first (/characters).");
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
        errorNotice(`Usage: ${text.startsWith("/attach") ? "/attach" : "/detach"} <id>`);
        return;
      }
      try {
        if (text.startsWith("/attach")) notice(`Attached ${chat.attachLorebook(id).name}.`);
        else notice(chat.detachLorebook(id) ? "Detached." : `Not attached: ${id}`);
      } catch (error) {
        errorNotice(error instanceof Error ? error.message : "Could not change lorebooks.");
      }
      return;
    };
    const handlers: Record<string, () => void | Promise<void>> = {
      quit: async () => {
        await quit();
        return;
      },
      import: async () => {
        const file = text.slice("/import".length).trim();
        if (file) showImportReport(file);
        else {
          const browser = new FileBrowser(paths.importRoot);
          browser.onCancel = closeOverlay;
          browser.onSelect = (selected) => {
            closeOverlay();
            showImportReport(selected);
          };
          tui.showOverlay(browser, { width: "90%" });
        }
      },
      library: async () => {
        notice(formatLibraryList(listLibrary(paths)).join("\n"));
        return;
      },
      "new-character": () => newCharacter(),
      persona: openPersonaPicker,
      show: async () => {
        const id = text.slice("/show".length).trim();
        if (!id) {
          errorNotice("Usage: /show <id>");
          return;
        }
        const item = getItem(paths, id);
        notice(
          item === "ambiguous"
            ? `Ambiguous item prefix: ${id}`
            : item
              ? formatItemDetails(item).join("\n")
              : `Item not found: ${id}`,
          { kind: item && item !== "ambiguous" ? "notice" : "error" },
        );
        return;
      },
      characters: async () => {
        openCharacterPicker();
        return;
      },
      chat: async () => {
        const id = text.slice("/chat".length).trim();
        const item = id ? getItem(paths, id) : null;
        if (!id) errorNotice("Usage: /chat <id>");
        else if (item === "ambiguous") errorNotice(`Ambiguous item prefix: ${id}`);
        else if (item?.kind !== "character") errorNotice(`Character not found: ${id}`);
        else startChat(item);
        return;
      },
      sessions: async () => {
        await openSessionPicker();
        return;
      },
      trace: async () => {
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
      },
      plain: async () => {
        chat = null;
        transcript.clear();
        notice("Plain chat. Use /characters to start a character chat.");
        updateStatus();
        return;
      },
      regenerate: async () => {
        await regenerate(value);
        return;
      },
      model: async () => {
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
            errorNotice("Could not select that model.");
            return;
          }
          try {
            writeSettings(paths, { model: model.id });
          } catch {
            errorNotice("Could not save the selected model; using it for this session only.");
          }
          tui.hideOverlay();
          updateStatus();
          tui.requestRender();
        };
        tui.showOverlay(picker, { width: "90%" });
        return;
      },
      help: async () => {
        const help = new Text(helpText());
        tui.showOverlay(help);
        helpOpen = true;
        return;
      },
      apikey: openApiKeyPicker,
      lorebooks: changeLorebooks,
      attach: changeLorebooks,
      detach: changeLorebooks,
    };
    if (text.startsWith("/")) {
      const name = text.slice(1).split(" ", 1)[0];
      const command = commands.find((entry) => entry.name === name);
      if (!command || (!command.argumentHint && text !== `/${name}`)) {
        errorNotice("Unknown command. Use /help.");
        return;
      }
      await handlers[command.name]?.();
      return;
    }
    if (interceptMissingKey(value)) return;
    addMessage("user", display(value));
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
    enterChat,
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
