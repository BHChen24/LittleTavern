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
  ChatSession,
  createLogger,
  DEFAULT_MODEL_ID,
  DEFAULT_SYSTEM_PROMPT,
  describeProviderError,
  findAllowedModel,
  forgetKey,
  readSavedKey,
  resolveApiKey,
  resolveAppPaths,
  saveKey,
  scrubSecrets,
  sumUsage,
  toUsageRecord,
  type UsageRecord,
} from "@littletavern/engine";
import { KeyPrompt } from "./components/key-prompt.ts";
import { StatusBar } from "./components/status-bar.ts";
import { editorTheme, markdownTheme } from "./theme.ts";
import { VERSION } from "./version.ts";

export const APP_HELP = `/help        Show commands and key bindings
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
      modelId: DEFAULT_MODEL_ID,
      systemPrompt: DEFAULT_SYSTEM_PROMPT,
      getApiKey: () => activeKey?.value,
    });
  const tui = new TuiMainScreen(options.terminal ?? new ProcessTerminal());
  const transcript = new Container();
  const editor = new Editor(tui, editorTheme);
  const status = new StatusBar(DEFAULT_MODEL_ID, activeKey?.source ?? "none");
  tui.addChild(new Text(`LittleTavern ${VERSION}`));
  tui.addChild(transcript);
  tui.addChild(editor);
  tui.addChild(status);
  tui.setFocus(editor);
  let reply: Markdown | undefined;
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
  const notice = (text: string) => {
    transcript.addChild(new Text(scrubSecrets(text, secrets)));
    tui.requestRender();
  };
  function promptForKey(): void {
    needsKey = true;
    editor.disableSubmit = true;
    keyPrompt = new KeyPrompt(paths.credentialsFile);
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
  if (saved.warning)
    notice("Saved credentials permissions allow access by other users; expected 0600.");
  if (saved.error) notice(saved.error);
  if (needsKey) promptForKey();

  function updateStatus(): void {
    const totals = sumUsage(records);
    status.update(
      DEFAULT_MODEL_ID,
      activeKey?.source ?? "none",
      `${totals.inputTokens}/${totals.outputTokens} | $${totals.cost.toFixed(4)}${totals.incomplete ? "~" : ""}`,
    );
  }
  updateStatus();
  const onDelta = session.onDelta((delta) => {
    response += delta;
    reply?.setText(scrubSecrets(response, secrets));
    tui.requestRender();
  });
  const onFinish = session.onFinish((turn) => {
    const record = toUsageRecord(turn, {
      sessionId,
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
    reply?.setText(
      scrubSecrets(response, secrets) + (turn.outcome === "interrupted" ? " [interrupted]" : ""),
    );
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
    if (needsKey) return;
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
    transcript.addChild(new Markdown(scrubSecrets(value, secrets), 1, 1, markdownTheme));
    reply = new Markdown("", 1, 1, markdownTheme);
    transcript.addChild(reply);
    response = "";
    editor.disableSubmit = true;
    running = session.send(value);
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
  editor.onSubmit = (value) => {
    void submit(value);
  };
  tui.addInputListener((data) => {
    if (matchesKey(data, "ctrl+c")) {
      void quit();
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
