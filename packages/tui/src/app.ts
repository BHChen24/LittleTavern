import { randomUUID } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, isAbsolute, join, relative, sep } from "node:path";
import {
  type AutocompleteProvider,
  CombinedAutocompleteProvider,
  type Component,
  Container,
  Editor,
  Loader,
  matchesKey,
  type OverlayOptions,
  ProcessTerminal,
  ScrollView,
  Spacer,
  type Terminal,
  Text,
  TuiAltScreen,
  VStack,
  wrapTextWithAnsi,
} from "@earendil-works/pi-tui";
import {
  type AppPaths,
  appendUsageRecord,
  CHARACTER_TEMPLATE,
  CharacterChat,
  type CharacterItem,
  type ChatHistoryItem,
  ChatSession,
  type ConfirmRequest,
  copyText,
  createCharacterFromDraft,
  createLogger,
  createPersonaFromDraft,
  DEFAULT_ASSEMBLY_SETTINGS,
  DEFAULT_MODEL_ID,
  describeProviderError,
  ensureImportFolders,
  findAllowedModel,
  forgetKey,
  getItem,
  type ImportReport,
  INNKEEPER_SYSTEM_PROMPT,
  type InnkeeperToolContext,
  importFile,
  type LorebookItem,
  listChats,
  listLibrary,
  listPersonas,
  PERSONA_TEMPLATE,
  type PersonaItem,
  parsePersona,
  type RequestOptions,
  type RequestSettings,
  readActivePersona,
  readRequestSettings,
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
import { Frame } from "./components/frame.ts";
import { HomeScreen } from "./components/home-screen.ts";
import { InputBox } from "./components/input-box.ts";
import { KeyPrompt } from "./components/key-prompt.ts";
import { ListPicker, type PickerItem } from "./components/list-picker.ts";
import { MessageView } from "./components/message-view.ts";
import { ModelPicker } from "./components/model-picker.ts";
import { NamePrompt } from "./components/name-prompt.ts";
import { StatusBar } from "./components/status-bar.ts";
import { TraceOverlay } from "./components/trace-overlay.ts";
import { openInEditor } from "./editor-launch.ts";
import {
  EMPTY_LIBRARY_HINT,
  formatImportReport,
  formatItemDetails,
  formatLibraryList,
  formatLimits,
} from "./library-format.ts";
import { stripControls } from "./sanitize.ts";
import { editorTheme, markdownTheme, messageStyles } from "./theme.ts";
import { formatTraceReport } from "./trace-format.ts";
import { VERSION } from "./version.ts";

const NO_SUGGESTIONS: AutocompleteProvider = {
  getSuggestions: async () => null,
  applyCompletion: (lines, cursorLine, cursorCol) => ({ lines, cursorLine, cursorCol }),
};

export interface AppOptions {
  startupNotices?: string[];
  terminal?: Terminal;
  env?: Readonly<Record<string, string | undefined>>;
  paths?: AppPaths;
  session?: ChatSession;
}

function buildRequest(requestSettings: RequestSettings): RequestOptions {
  const request: RequestOptions = {};
  if (requestSettings.replyTokens > 0) request.maxTokens = requestSettings.replyTokens;
  if (requestSettings.generation.temperature !== undefined)
    request.temperature = requestSettings.generation.temperature;
  const samplingParams: Record<string, number> = {};
  for (const [setting, key] of [
    ["topP", "top_p"],
    ["topK", "top_k"],
    ["minP", "min_p"],
    ["repetitionPenalty", "repetition_penalty"],
  ] as const) {
    const value = requestSettings.generation[setting];
    if (value !== undefined) samplingParams[key] = value;
  }
  if (Object.keys(samplingParams).length) request.samplingParams = samplingParams;
  return request;
}

export function createApp(options: AppOptions = {}) {
  const env = options.env ?? process.env;
  const paths = options.paths ?? resolveAppPaths(env);
  const settings = readSettings(paths);
  const requestSettings = readRequestSettings(paths);
  let allowedSpend = requestSettings.runSpendUsd;
  let cutOffNoteShown = false;
  let unknownPriceNoteShown = false;
  const limitsLine = formatLimits(
    requestSettings.replyTokens,
    requestSettings.runSpendUsd,
    paths.settingsFile,
  );
  const request = buildRequest(requestSettings);
  const storedModel = findAllowedModel(settings.model);
  let modelId = storedModel?.id ?? DEFAULT_MODEL_ID;
  let modelSelected = Boolean(storedModel);
  const saved = readSavedKey(paths);
  let activeKey = resolveApiKey({ envValue: env.OPENROUTER_API_KEY, savedValue: saved.key });
  const secrets = [env.OPENROUTER_API_KEY, saved.key].filter((value): value is string =>
    Boolean(value?.trim()),
  );
  const sessionId = randomUUID();
  const records: UsageRecord[] = [];
  const logger = createLogger(paths.logFile, () => secrets);
  let confirming = false;
  let innkeeperRoundLimit = requestSettings.toolRounds;
  let pendingOpen: { item: CharacterItem; sessionPath?: string } | null = null;
  const innkeeper: InnkeeperToolContext = {
    paths,
    help: () =>
      `${helpText()}\nCharacter import folder: ${paths.importCharactersDir}\nLorebook import folder: ${paths.importLorebooksDir}\nPersona import folder: ${paths.importPersonasDir}\nSettings file: ${paths.settingsFile}\nSettings backups: ${join(paths.configDir, "backups")}/`,
    requestSettings: () => requestSettings,
    confirm: confirmInnkeeper,
    openChat: (item, sessionPath) => {
      pendingOpen = { item, sessionPath };
    },
    applied: (changes, backupPath) => {
      for (const { setting, value } of changes) {
        if (setting === "limits.replyTokens") requestSettings.replyTokens = value as number;
        else if (setting === "limits.runSpendUsd") {
          requestSettings.runSpendUsd = value as number;
          allowedSpend = value as number;
        } else if (setting === "limits.toolRounds") {
          requestSettings.toolRounds = value as number;
          session.toolRounds = value as number;
        } else if (setting.startsWith("generation.")) {
          const key = setting.slice("generation.".length) as keyof RequestSettings["generation"];
          if (value === null) delete requestSettings.generation[key];
          else requestSettings.generation[key] = value as number;
        }
      }
      session.setRequest(buildRequest(requestSettings));
      notice(
        backupPath
          ? `Settings saved. The previous settings were backed up to ${backupPath}.`
          : "Settings saved.",
      );
      if (changes.some((change) => change.setting === "mouse"))
        notice("The mouse setting applies after a restart.");
    },
  };
  const session =
    options.session ??
    new ChatSession({
      request,
      modelId,
      systemPrompt: INNKEEPER_SYSTEM_PROMPT,
      innkeeper,
      toolRounds: requestSettings.toolRounds,
      getApiKey: () => activeKey?.value,
    });
  const tui = new TuiAltScreen(options.terminal ?? new ProcessTerminal(), undefined, undefined, {
    mouse: settings.mouse !== false,
    copyOnSelect: true,
    copySelection: copyText,
  });
  const transcript = new Container();
  const setupNotice = new Text("");
  const editor = new Editor(tui, editorTheme);
  const status = new StatusBar({ model: storedModel?.id, keySource: activeKey?.source ?? "none" });
  const homeScreen = new HomeScreen({
    limits: limitsLine,
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
    tui.addChild(status.top);
    tui.addChild(transcript);
    tui.addChild(inputBox);
    tui.addChild(status.bottom);
    tui.setLayoutRoot(
      new VStack([
        { component: status.top, shrink: 1, minSize: 0 },
        {
          component: new ScrollView(transcript, { primary: true, follow: "end" }),
          basis: 0,
          grow: 1,
          minSize: 1,
        },
        { component: inputBox, shrink: 1, minSize: 3 },
        { component: status.bottom, shrink: 1, minSize: 0 },
      ]),
    );
    tui.setFocus(editor);
    const savedSettings = readSettings(paths);
    if (!savedSettings.userName && !readActivePersona(paths).persona) {
      const prompt = new NamePrompt();
      prompt.onSubmit = (value) => {
        const userName = stripControls(value).trim();
        if (!userName) {
          prompt.error = "Please enter a name.";
          tui.requestRender();
          return;
        }
        writeSettings(paths, { userName });
        closeOverlay();
        updateSetupNotice();
        notice(`Characters will call you ${userName}. A persona's name takes precedence.`);
      };
      prompt.onCancel = () => {
        closeOverlay();
        updateSetupNotice();
      };
      showPanel(prompt);
    } else updateSetupNotice();
    tui.requestRender();
  }
  let reply: MessageView | undefined;
  let chat: CharacterChat | null = null;
  let editing: { entryId: string; role: "user" | "character"; text: string } | null = null;
  let innkeeperSelected = false;
  const inputBox = new InputBox(
    editor,
    () =>
      !activeKey
        ? "Add your key with /apikey to start talking"
        : !modelSelected
          ? "Select a model with /model to start talking"
          : !chat && !innkeeperSelected
            ? "Choose /characters or /innkeeper to start talking"
            : chat
              ? `Talk to ${display(chat.character.name)}… (/ for commands)`
              : "Talk to the innkeeper… (/ for commands)",
    () =>
      editing
        ? editing.role === "user"
          ? "Editing your message · Enter saves and resends · Esc cancels"
          : `Editing ${stripControls(chat?.character.name ?? "")}'s message · Enter saves · Esc cancels`
        : undefined,
  );
  let waiting: Loader | undefined;
  function clearWaiting(): void {
    if (!waiting) return;
    waiting.stop();
    transcript.removeChild(waiting);
    waiting = undefined;
    tui.requestRender();
  }
  const commands = COMMANDS();
  const autocomplete = new CombinedAutocompleteProvider(commands, paths.importRoot);
  editor.setAutocompleteProvider(autocomplete);
  function clearEditing(): void {
    editing = null;
    editor.setAutocompleteProvider(autocomplete);
  }
  let response = "";
  let retries: number | null = null;
  let running: Promise<unknown> | undefined;
  let closing: Promise<void> | undefined;
  let resolveDone: () => void = () => {};
  const done = new Promise<void>((resolve) => {
    resolveDone = resolve;
  });
  let started = false;
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
  function toolLine(label: string): void {
    transcript.addChild(new Text(messageStyles.muted(`· Innkeeper ${display(label)}`)));
    tui.requestRender();
  }
  function showPanel(component: Component, options?: OverlayOptions): void {
    tui.showOverlay(new Frame(component, () => tui.terminal.rows), options);
  }
  function confirmInnkeeper(request: ConfirmRequest, signal?: AbortSignal): Promise<boolean> {
    if (signal?.aborted) return Promise.resolve(false);
    if (request.lines.length) notice(request.lines.join("\n"));
    return new Promise((resolve) => {
      confirming = true;
      const picker = new ListPicker<boolean>(request.title, [
        { value: true, label: "Yes", search: "Yes" },
        { value: false, label: "No", search: "No" },
      ]);
      const choose = (accepted: boolean) => {
        if (!confirming) return;
        confirming = false;
        signal?.removeEventListener("abort", abort);
        closeOverlay();
        resolve(accepted);
      };
      const abort = () => choose(false);
      picker.onSelect = choose;
      picker.onCancel = abort;
      signal?.addEventListener("abort", abort, { once: true });
      showPanel(picker);
    });
  }
  function importSelected(selected: string): ImportReport | null {
    try {
      const location = relative(realpathSync(paths.importRoot), realpathSync(selected));
      if (location === ".." || location.startsWith(`..${sep}`) || isAbsolute(location)) {
        errorNotice(`${basename(selected)} is outside the import folders.`);
        return null;
      }
      const report = importFile(paths, selected);
      notice(formatImportReport(report).join("\n"), { kind: report.ok ? "notice" : "error" });
      return report;
    } catch (error) {
      errorNotice(
        `Could not import ${basename(selected)}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
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
      openModelPicker();
    };
    showPanel(keyPrompt, { width: "90%" });
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
      showPanel(actions, { width: "90%" });
    };
    showPanel(provider, { width: "90%" });
  }
  function setupSteps(): string[] {
    const steps: string[] = [];
    if (!activeKey) steps.push("No API key yet. Type /apikey to add your OpenRouter key.");
    if (!modelSelected) steps.push("Select a model with /model.");
    if (!chat && !innkeeperSelected)
      steps.push("Choose a character with /characters or enter /innkeeper mode.");
    return steps;
  }
  function updateSetupNotice(): void {
    if (!inChat) return;
    transcript.removeChild(setupNotice);
    const steps = setupSteps();
    if (steps.length) {
      const text = display(`Chat is disabled. Before chatting:\n${steps.join("\n")}`);
      setupNotice.setText(
        messageStyles.notice(
          `· ${text}${!chat && !innkeeperSelected ? `\n${display(limitsLine)}` : ""}`,
        ),
      );
      transcript.addChild(setupNotice);
    }
    tui.requestRender();
  }
  function interceptIncompleteSetup(value: string): boolean {
    const steps = setupSteps();
    if (!steps.length) return false;
    editor.setText(value);
    updateSetupNotice();
    return true;
  }
  const startupNotices = [...(options.startupNotices ?? []), ...requestSettings.warnings];
  const importNotice = ensureImportFolders(paths);
  if (importNotice) startupNotices.unshift(importNotice);
  if (startupNotices.length) notice(startupNotices.join("\n"));
  if (settings.model && !storedModel)
    notice(`Saved model ${settings.model} is unavailable. Choose a model with /model.`);
  if (saved.warning)
    notice("Saved credentials permissions allow access by other users; expected 0600.");
  if (saved.error) errorNotice(saved.error);

  function updateStatus(): void {
    status.update({
      model: modelSelected ? modelId : undefined,
      keySource: activeKey?.source ?? "none",
      character: chat?.character.name,
      persona: readActivePersona(paths).persona?.name,
      totals: sumUsage(records),
    });
    updateSetupNotice();
  }
  updateStatus();

  function addMessage(role: "user" | "character", text: string): MessageView {
    const label = role === "user" ? "You" : display(chat?.character.name ?? "Innkeeper");
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
    retries = null;
    innkeeperSelected = false;
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
    const picker = new ListPicker<CharacterItem | "new">(
      "Choose a character (Enter starts a chat, Esc cancels)",
      [
        { value: "new", label: "New character", search: "New character" },
        ...characters.map((item) => ({
          value: item,
          label: stripControls(item.name),
          description: item.id,
          search: `${item.name} ${item.id}`,
        })),
      ],
      "Filter characters",
    );
    picker.onCancel = closeOverlay;
    picker.onSelect = (item) => {
      closeOverlay();
      if (item === "new") newCharacter();
      else startChat(item);
    };
    showPanel(picker, { width: "90%" });
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
        notice("Choose the character with /characters to start chatting.");
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
      showPanel(picker, { width: "90%" });
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
      updateStatus();
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
          updateStatus();
        } else if (typeof choice === "object") {
          writeSettings(paths, { persona: choice.file });
          notice(`You are now ${choice.name}`);
          updateStatus();
        }
      };
      showPanel(picker, { width: "90%" });
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
    showPanel(picker, { width: "90%" });
  }
  async function regenerate(value = editor.getText()): Promise<void> {
    if (interceptIncompleteSetup(value)) return;
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
    const allowance = allowSpend(value);
    if (allowance !== true && !(await allowance)) return;
    const history = chat.history();
    if (target === "user" && retries !== null) retries += 1;
    else retries = null;
    renderHistory(target === "reply" ? history.slice(0, -1) : history);
    await stream(() => (chat ? chat.regenerate() : Promise.resolve(null)));
  }
  async function stream(run: () => Promise<unknown>): Promise<void> {
    const price = findAllowedModel(modelId)?.price;
    if (
      !unknownPriceNoteShown &&
      (!price || (price.inputPerMTok === 0 && price.outputPerMTok === 0))
    ) {
      unknownPriceNoteShown = true;
      notice(`Prices for ${modelId} are unknown, so the spending limit cannot be checked for it.`);
    }
    waiting = new Loader(
      tui,
      messageStyles.accent,
      messageStyles.muted,
      `${display(chat?.character.name ?? "Innkeeper")} is writing…`,
    );
    transcript.addChild(waiting);
    reply = addMessage("character", "");
    response = "";
    editor.disableSubmit = true;
    tui.requestRender();
    try {
      innkeeperRoundLimit = session.toolRounds;
      running = run();
      await running;
    } catch (error) {
      logger.error(error instanceof Error ? error : { error: String(error) }, "Chat failed");
      errorNotice("Chat request failed. See the diagnostic log.");
    } finally {
      clearWaiting();
      editor.disableSubmit = false;
      tui.requestRender();
    }
  }
  const onDelta = session.onDelta((delta) => {
    if (delta) clearWaiting();
    response += delta;
    reply?.setText(display(response));
    tui.requestRender();
  });
  const onToolCall = session.onToolCall((call) => {
    clearWaiting();
    if (reply && !response) transcript.removeChild(reply);
    toolLine(call.label);
    reply = addMessage("character", "");
    response = "";
    tui.requestRender();
  });
  const onFinish = session.onFinish((turn) => {
    clearWaiting();
    if (turn.toolLimitReached)
      notice(
        `The innkeeper stopped after ${innkeeperRoundLimit} rounds of tool calls. Ask again, or raise limits.toolRounds in ${paths.settingsFile}.`,
      );
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
      if (chat) retries ??= 0;
      reply?.setText(`${display(response)}${response ? " " : ""}(incomplete, not saved)`);
      const error = describeProviderError(
        scrubSecrets(turn.errorMessage ?? "Unknown error", secrets),
      );
      if (error.kind === "key-rejected") {
        activeKey = null;
        updateStatus();
      }
      let text: string;
      if (error.kind === "key-rejected")
        text = "OpenRouter rejected the key. Type /apikey to replace it.";
      else if (error.kind === "no-credit")
        text = "OpenRouter reports insufficient credit. Add credit on openrouter.ai, then retry.";
      else if (error.kind === "model-unavailable")
        text = "The selected model is unavailable. Choose another with /model.";
      else {
        const reason =
          error.kind === "rate-limited"
            ? ": rate limit reached"
            : error.kind === "network"
              ? ": network error"
              : "";
        text = `The reply failed${reason}. ${chat ? `Press Ctrl+R or use /regenerate to retry. Retries so far: ${retries}.` : "Send your message again to retry."}`;
      }
      errorNotice(`${text} Details: ${paths.logFile}`);
      logger.error(
        { error: turn.errorMessage, model: turn.model, kind: error.kind },
        "Provider request failed",
      );
    } else retries = null;
    if (turn.cutOff && requestSettings.replyTokens > 0 && !cutOffNoteShown) {
      cutOffNoteShown = true;
      notice(
        `The reply reached the limit of ${requestSettings.replyTokens} tokens and was cut off. Change limits.replyTokens in ${paths.settingsFile}.`,
      );
    }
    tui.requestRender();
  });

  function allowSpend(value: string): true | Promise<boolean> {
    const spent = sumUsage(records).cost;
    if (requestSettings.runSpendUsd === 0 || spent < allowedSpend) return true;
    return new Promise((resolve) => {
      const picker = new ListPicker<boolean>(
        `This run has spent $${spent.toFixed(2)} of $${allowedSpend.toFixed(2)}. Send anyway?`,
        [
          {
            value: true,
            label: `Continue (allow another $${requestSettings.runSpendUsd.toFixed(2)})`,
            search: "Continue",
          },
          { value: false, label: "Stop", search: "Stop" },
        ],
      );
      const choose = (proceed: boolean) => {
        closeOverlay();
        if (proceed) allowedSpend += requestSettings.runSpendUsd;
        else {
          editor.setText(value);
          notice("Not sent. Your message is still in the input.");
        }
        resolve(proceed);
      };
      picker.onSelect = choose;
      picker.onCancel = () => choose(false);
      showPanel(picker);
    });
  }

  function quit(): Promise<void> {
    if (closing) return closing;
    closing = (async () => {
      clearWaiting();
      session.abort();
      try {
        await running;
      } finally {
        onDelta();
        onToolCall();
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

  function composeInput(): void {
    let folder: string | undefined;
    try {
      folder = mkdtempSync(join(tmpdir(), "littletavern-message-"));
      const file = join(folder, "message.md");
      writeFileSync(file, editor.getText(), { mode: 0o600 });
      tui.stop();
      try {
        const result = openInEditor(file, env.VISUAL || env.EDITOR);
        if (!result.ok) {
          errorNotice(result.reason);
          return;
        }
        editor.setText(readFileSync(file, "utf8"));
      } finally {
        tui.start();
        tui.requestRender(true);
      }
    } catch (error) {
      errorNotice(error instanceof Error ? error.message : String(error));
    } finally {
      if (folder) rmSync(folder, { recursive: true, force: true });
    }
  }

  function openModelPicker(): void {
    const picker = new ModelPicker(modelId);
    picker.onCancel = () => {
      tui.hideOverlay();
      tui.requestRender();
    };
    picker.onSelect = (model) => {
      try {
        session.setModel(model.id);
        modelId = model.id;
        modelSelected = true;
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
    showPanel(picker, { width: "90%" });
  }

  async function submit(value: string): Promise<void> {
    const text = value.trim();
    if (closing) return;
    if (editing && chat) {
      editor.setText("");
      if (!text) {
        errorNotice("Please enter the message text, or press Esc to cancel.");
        return;
      }
      const target = editing;
      const current = chat;
      if (target.role === "user") {
        if (interceptIncompleteSetup(value)) return;
        const allowance = allowSpend(value);
        if (allowance !== true && !(await allowance)) return;
        clearEditing();
        retries = null;
        const history = current.history();
        const index = history.findIndex((item) => item.entryId === target.entryId);
        renderHistory(history.slice(0, index));
        addMessage("user", display(value));
        await stream(() => current.resendFrom(target.entryId, value));
      } else if (text === target.text.trim()) {
        clearEditing();
        notice("No changes.");
      } else {
        current.editReply(target.entryId, value);
        clearEditing();
        renderHistory(current.history());
      }
      return;
    }
    if (!text) return;
    if (session.isStreaming) {
      if (["/new", "/prev", "/undo", "/edit"].includes(text))
        notice("Wait for the reply, or press Esc to stop it.");
      return;
    }
    editor.setText("");
    if (text === "/key" || text === "/forget-key") {
      notice(`${text} was replaced by /apikey.`);
      return;
    }
    const openLorebookPicker = () => {
      const current = chat;
      if (!current) {
        errorNotice("Start a character chat first (/characters).");
        return;
      }
      type Choice =
        | { kind: "import" }
        | { kind: "card" }
        | { kind: "library"; item: LorebookItem }
        | { kind: "missing"; id: string };
      const ids = current.attachedLorebookIds();
      const books = listLibrary(paths).filter(
        (item): item is LorebookItem => item.kind === "lorebook",
      );
      const embedded = current.character.lorebook;
      const entries: PickerItem<Choice>[] = [
        { value: { kind: "import" }, label: "Import a lorebook…", search: "Import a lorebook" },
      ];
      if (embedded)
        entries.push({
          value: { kind: "card" },
          label: stripControls(embedded.name),
          description: "part of the card",
          search: embedded.name,
        });
      for (const item of books)
        entries.push({
          value: { kind: "library", item },
          label: stripControls(item.name),
          description: ids.includes(item.id) ? "attached" : "not attached",
          search: `${item.name} ${item.id}`,
        });
      for (const id of ids) {
        if (!books.some((item) => item.id === id))
          entries.push({
            value: { kind: "missing", id },
            label: stripControls(id),
            description: "attached, missing from the library",
            search: id,
          });
      }
      const picker = new ListPicker(
        `Lorebooks for ${stripControls(current.character.name)} (Enter toggles, Esc cancels)`,
        entries,
        "Filter lorebooks",
      );
      picker.onCancel = closeOverlay;
      picker.onSelect = (choice) => {
        closeOverlay();
        if (choice.kind === "import") {
          const browser = new FileBrowser(paths.importLorebooksDir, paths.importRoot);
          browser.onCancel = closeOverlay;
          browser.onSelect = (selected) => {
            closeOverlay();
            const report = importSelected(selected);
            if (report?.ok && report.item.kind === "lorebook") {
              current.attachLorebook(report.item.id);
              notice(`Attached ${stripControls(report.item.name)}.`);
            }
          };
          showPanel(browser, { width: "90%" });
          return;
        }
        try {
          if (choice.kind === "card") {
            notice(
              `${stripControls(embedded?.name ?? "")} is part of the character card and cannot be detached.`,
            );
          } else if (choice.kind === "missing") {
            current.detachLorebook(choice.id);
            notice("Detached a lorebook that is no longer in the library.");
          } else if (ids.includes(choice.item.id)) {
            current.detachLorebook(choice.item.id);
            notice(`Detached ${stripControls(choice.item.name)}.`);
          } else {
            current.attachLorebook(choice.item.id);
            notice(`Attached ${stripControls(choice.item.name)}.`);
          }
        } catch (error) {
          errorNotice(error instanceof Error ? error.message : "Could not change lorebooks.");
        }
      };
      showPanel(picker, { width: "90%" });
    };
    const handlers: Record<string, () => void | Promise<void>> = {
      quit: async () => {
        await quit();
        return;
      },
      import: async () => {
        const file = text.slice("/import".length).trim();
        if (file)
          notice(
            "Choose a file from the import folders. To import from elsewhere, run: littletavern import <file>",
          );
        else {
          const browser = new FileBrowser(paths.importRoot, paths.importRoot);
          browser.onCancel = closeOverlay;
          browser.onSelect = (selected) => {
            closeOverlay();
            importSelected(selected);
          };
          showPanel(browser, { width: "90%" });
        }
      },
      library: async () => {
        notice(formatLibraryList(listLibrary(paths)).join("\n"));
        return;
      },
      persona: openPersonaPicker,
      show: async () => {
        if (text !== "/show") {
          notice("/show opens a picker. In a shell, run: littletavern show <id>");
          return;
        }
        const items = listLibrary(paths);
        if (!items.length) {
          notice(EMPTY_LIBRARY_HINT);
          return;
        }
        const picker = new ListPicker(
          "Inspect an item (Enter shows details, Esc cancels)",
          items.map((item) => ({
            value: item,
            label: stripControls(item.name),
            description: `${item.kind} · ${item.id}`,
            search: `${item.name} ${item.id}`,
          })),
          "Filter items",
        );
        picker.onCancel = closeOverlay;
        picker.onSelect = (item) => {
          closeOverlay();
          notice(formatItemDetails(item).join("\n"));
        };
        showPanel(picker, { width: "90%" });
      },
      characters: async () => {
        openCharacterPicker();
        return;
      },
      new: () => {
        if (chat) {
          const item = getItem(paths, chat.libraryId);
          if (!item || item === "ambiguous" || item.kind !== "character") {
            notice(
              `${stripControls(chat.character.name)} is no longer in the library. Choose a character with /characters.`,
            );
          } else {
            startChat(item);
            notice(
              `Started a new chat with ${stripControls(item.character.name)}. Earlier chats are in /sessions.`,
            );
          }
        } else if (innkeeperSelected) {
          session.clearConversation();
          transcript.clear();
          notice("Started a new conversation with the innkeeper.");
        } else {
          notice("Choose a character with /characters, or use /innkeeper.");
        }
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
          // The panel is 90% wide; its frame takes two columns on each side.
          Math.max(20, Math.floor(width * 0.9) - 4),
        );
        const overlay = new TraceOverlay(lines, Math.max(3, tui.terminal.rows - 8));
        overlay.onClose = closeOverlay;
        showPanel(overlay, { width: "90%" });
        tui.requestRender();
        return;
      },
      innkeeper: async () => {
        chat = null;
        retries = null;
        innkeeperSelected = true;
        transcript.clear();
        for (const item of session.innkeeperHistory()) {
          if (item.kind === "tool") toolLine(item.text);
          else addMessage(item.kind === "user" ? "user" : "character", display(item.text));
        }
        notice(
          "You are talking to the innkeeper. Ask how anything works, or ask to change the hard settings. Use /characters to start a character chat.",
        );
        updateStatus();
        return;
      },
      regenerate: async () => {
        await regenerate(value);
        return;
      },
      prev: () => {
        if (!chat) notice("/prev works in character chats.");
        else if (chat.prev() === "nothing-to-restore")
          notice("There is no previous reply to bring back. /prev works right after a regenerate.");
        else renderHistory(chat.history());
      },
      undo: () => {
        if (!chat) {
          notice("/undo works in character chats.");
          return;
        }
        const result = chat.undo();
        if (result === "nothing-to-undo") notice("There is nothing to undo.");
        else {
          renderHistory(chat.history());
          editor.setText(result.text);
        }
      },
      edit: () => {
        if (!chat) {
          notice("/edit works in character chats.");
          return;
        }
        const items = chat
          .history()
          .filter((item): item is ChatHistoryItem & { entryId: string } => Boolean(item.entryId))
          .reverse();
        if (!items.length) {
          notice("There are no messages to edit.");
          return;
        }
        const picker = new ListPicker(
          "Edit a message (Enter edits, Esc cancels)",
          items.map((item) => ({
            value: item,
            label: item.role === "user" ? "You" : stripControls(chat?.character.name ?? ""),
            description: stripControls(item.text.split("\n", 1)[0] ?? ""),
            search: item.text,
          })),
          "Filter messages",
        );
        picker.onCancel = closeOverlay;
        picker.onSelect = (item) => {
          closeOverlay();
          editing = { entryId: item.entryId, role: item.role, text: item.text };
          editor.setAutocompleteProvider(NO_SUGGESTIONS);
          editor.setText(item.text);
          tui.requestRender();
        };
        showPanel(picker, { width: "90%" });
      },
      model: openModelPicker,
      help: async () => {
        const innerWidth = Math.max(1, Math.min(80, tui.terminal.columns) - 4);
        const help = new TraceOverlay(
          wrapTextWithAnsi(helpText(), innerWidth),
          Math.max(3, tui.terminal.rows - 8),
        );
        help.onClose = closeOverlay;
        showPanel(help);
        return;
      },
      apikey: openApiKeyPicker,
      lorebooks: openLorebookPicker,
    };
    if (text.startsWith("/")) {
      const name = text.slice(1).split(/\s+/, 1)[0];
      const command = commands.find((entry) => entry.name === name);
      if (
        !command ||
        (!command.argumentHint &&
          command.name !== "import" &&
          command.name !== "show" &&
          text !== `/${name}`)
      ) {
        errorNotice("Unknown command. Use /help.");
        return;
      }
      await handlers[command.name]?.();
      return;
    }
    if (interceptIncompleteSetup(value)) return;
    const allowance = allowSpend(value);
    if (allowance !== true && !(await allowance)) return;
    retries = null;
    addMessage("user", display(value));
    const current = chat;
    await stream(() => (current ? current.send(value) : session.send(value)));
    if (!current && pendingOpen) {
      const next = pendingOpen;
      pendingOpen = null;
      if (!next.sessionPath) startChat(next.item);
      else {
        try {
          setCharacterChat(CharacterChat.resume({ paths, session, sessionPath: next.sessionPath }));
        } catch (error) {
          logger.error(
            error instanceof Error ? error : { error: String(error) },
            "Chat resume failed",
          );
          errorNotice("Could not resume the chat. See the diagnostic log.");
        }
      }
    }
  }
  editor.onSubmit = (value) => {
    void submit(value);
  };
  tui.addInputListener((data) => {
    if (editing && tui.getFocusedComponent() === editor) {
      if (matchesKey(data, "escape")) {
        clearEditing();
        editor.setText("");
        notice("Edit cancelled.");
        return { consume: true };
      }
      if (matchesKey(data, "ctrl+r")) {
        notice("Finish the edit first: Enter saves, Esc cancels.");
        return { consume: true };
      }
    }
    if (
      session.isStreaming &&
      tui.getFocusedComponent() === editor &&
      matchesKey(data, "enter") &&
      ["/new", "/prev", "/undo", "/edit"].includes(editor.getText().trim())
    ) {
      notice("Wait for the reply, or press Esc to stop it.");
      return { consume: true };
    }
    if (matchesKey(data, "ctrl+c")) {
      void quit();
      return { consume: true };
    }
    if (matchesKey(data, "ctrl+o") && inChat && tui.getFocusedComponent() === editor) {
      composeInput();
      return { consume: true };
    }
    if (matchesKey(data, "ctrl+r")) {
      void regenerate();
      return { consume: true };
    }
    if (matchesKey(data, "escape") && session.isStreaming && !confirming) {
      clearWaiting();
      session.abort();
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

export async function startApp(options: AppOptions = {}): Promise<void> {
  const app = createApp(options);
  try {
    app.start();
    await app.done;
  } finally {
    await app.quit();
  }
}
