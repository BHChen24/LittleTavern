import { readFileSync } from "node:fs";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import { Type } from "@earendil-works/pi-ai";
import {
  type AppPaths,
  checkSettingChange,
  listLibrary,
  listPersonas,
  type RequestSettings,
  readActivePersona,
  readSettings,
  SETTING_RULES,
  type SettingChange,
  updateSettings,
} from "@littletavern/data";
import { DEFAULT_ASSEMBLY_SETTINGS } from "./assembly/types.ts";
import { type CharacterItem, listChats, readChatCharacter } from "./character-chat.ts";

export interface ConfirmRequest {
  lines: string[];
  title: string;
}

export interface InnkeeperToolContext {
  paths: AppPaths;
  help(): string;
  requestSettings(): RequestSettings;
  confirm(request: ConfirmRequest, signal?: AbortSignal): Promise<boolean>;
  openChat(item: CharacterItem, sessionPath?: string): void;
  applied(
    changes: { setting: string; value: number | boolean | null }[],
    backupPath: string | null,
  ): void;
}

// This adapter is internal: the public engine API exposes only the context above.
export function createInnkeeperTools(context: InnkeeperToolContext): AgentTool[] {
  return [
    {
      name: "open_chat",
      label: "offered to open a chat",
      description:
        "Offer to start a new character chat or resume that character's most recent saved chat. The guest must confirm; opening ends this innkeeper turn.",
      parameters: Type.Object({
        character: Type.String({ minLength: 1 }),
        mode: Type.Union([Type.Literal("new"), Type.Literal("resume")]),
      }),
      execute: async (_id, params, signal) => {
        const { character, mode } = params as { character: string; mode: "new" | "resume" };
        try {
          const characters = listLibrary(context.paths).filter(
            (item): item is CharacterItem => item.kind === "character",
          );
          const query = character.trim().toLowerCase();
          const byId = characters.find((item) => item.id.toLowerCase() === query);
          const exact = characters.filter((item) => item.character.name.toLowerCase() === query);
          const matches = !query
            ? []
            : byId
              ? [byId]
              : exact.length
                ? exact
                : characters.filter((item) => item.character.name.toLowerCase().includes(query));
          if (!matches.length)
            return textResult(
              `No character matches "${stripControls(character)}". Characters: ${characters.map((item) => stripControls(item.character.name)).join(", ")}.`,
              true,
            );
          if (matches.length > 1)
            return textResult(
              `Several characters match "${stripControls(character)}": ${matches.map((item) => `${stripControls(item.character.name)} (${item.id})`).join(", ")}. Use the id.`,
              true,
            );
          const item = matches[0] as CharacterItem;
          const name = stripControls(item.character.name);
          let sessionPath: string | undefined;
          let title = `Start a new chat with ${name}?`;
          if (mode === "resume") {
            const chats = await listChats(context.paths);
            const newest = chats.find(
              (chat) => readChatCharacter(context.paths, chat.path)?.libraryId === item.id,
            );
            if (!newest) return textResult(`There is no saved chat with ${name}.`, true);
            sessionPath = newest.path;
            title = `Continue your latest chat with ${name} (last ${newest.modified.toLocaleString()})?`;
          }
          const accepted = await context.confirm({ lines: [], title }, signal);
          if (!accepted || signal?.aborted) return textResult("The guest declined.");
          if (sessionPath) context.openChat(item, sessionPath);
          else context.openChat(item);
          return textResult(`The chat with ${name} opens when you finish speaking.`, false, {
            endTurn: true,
          });
        } catch (error) {
          return textResult(error instanceof Error ? error.message : String(error), true);
        }
      },
    },
    {
      name: "change_settings",
      label: "proposed a settings change",
      description:
        "Propose changes to hard settings. Every change requires the guest's confirmation. Use null to remove optional generation or lore settings. Mouse needs a restart.",
      parameters: Type.Object({
        changes: Type.Array(
          Type.Object({
            setting: Type.Union(Object.keys(SETTING_RULES).map((key) => Type.Literal(key))),
            value: Type.Union([Type.Number(), Type.Boolean(), Type.Null()]),
          }),
          { minItems: 1 },
        ),
      }),
      execute: async (_id, params, signal) => {
        const { changes } = params as { changes: SettingChange[] };
        for (const { setting, value } of changes) {
          const rule = checkSettingChange(setting, value);
          if (rule)
            return textResult(
              value === null && Object.hasOwn(SETTING_RULES, setting)
                ? `${setting} cannot be removed. Nothing was changed.`
                : `${setting} must be ${rule}. Nothing was changed.`,
              true,
            );
        }
        try {
          let raw: Record<string, unknown> = {};
          let source: string | undefined;
          try {
            source = readFileSync(context.paths.settingsFile, "utf8");
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
          }
          if (source !== undefined) {
            try {
              const parsed: unknown = JSON.parse(source);
              if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
              raw = parsed as Record<string, unknown>;
            } catch {
              throw new Error("settings.json is not valid JSON. Fix or remove it first.");
            }
          }
          const lines = changes.map(({ setting, value }) => {
            const [section, key] = setting.split(".");
            const old = key
              ? (raw[section as string] as Record<string, unknown> | undefined)?.[key]
              : raw[setting];
            const previous =
              old !== undefined && old !== null && checkSettingChange(setting, old) === null
                ? String(old)
                : "default";
            return `${setting}: ${previous} → ${value === null ? "default" : value}`;
          });
          const accepted = await context.confirm(
            { lines, title: "Apply these settings changes?" },
            signal,
          );
          if (!accepted || signal?.aborted) return textResult("The guest declined.");
          const { backupPath } = updateSettings(context.paths, changes);
          context.applied(changes, backupPath);
          return textResult(
            `Saved: ${changes.map(({ setting, value }) => `${setting} = ${value === null ? "default" : value}`).join(", ")}${backupPath ? ` Backup: ${backupPath}` : ""}`,
          );
        } catch (error) {
          return textResult(
            `${error instanceof Error ? error.message : String(error)} Nothing was changed.`,
            true,
          );
        }
      },
    },
    {
      name: "read_settings",
      label: "checked the settings",
      description:
        "Read current settings without credentials. Limits and generation are the values in use; mouse is the saved value for the next start.",
      parameters: Type.Object({}),
      execute: async () => {
        const settings = readSettings(context.paths);
        const active = context.requestSettings();
        const generation: Record<string, number> = {};
        for (const key of ["temperature", "topP", "topK", "minP", "repetitionPenalty"] as const) {
          if (active.generation[key] !== undefined) generation[key] = active.generation[key];
        }
        return textResult(
          JSON.stringify({
            model: settings.model,
            userName: settings.userName,
            persona: readActivePersona(context.paths).persona?.name ?? null,
            limits: {
              replyTokens: active.replyTokens,
              runSpendUsd: active.runSpendUsd,
              toolRounds: active.toolRounds,
            },
            generation,
            loreBudget: settings.loreBudget ?? DEFAULT_ASSEMBLY_SETTINGS.loreBudget,
            scanDepth: settings.scanDepth ?? DEFAULT_ASSEMBLY_SETTINGS.scanDepth,
            replyReserve: settings.replyReserve ?? DEFAULT_ASSEMBLY_SETTINGS.replyReserve,
            mouse: settings.mouse !== false,
            settingsFile: context.paths.settingsFile,
          }),
        );
      },
    },
    {
      name: "list_characters",
      label: "looked at the guest book",
      description: "List the names and library ids of available characters.",
      parameters: Type.Object({}),
      execute: async () =>
        textResult(
          JSON.stringify(
            listLibrary(context.paths)
              .filter((item) => item.kind === "character")
              .map((item) => ({ id: item.id, name: item.character.name })),
          ),
        ),
    },
    {
      name: "list_personas",
      label: "looked at the personas",
      description: "List valid personas and show which is active.",
      parameters: Type.Object({}),
      execute: async () => {
        const settings = readSettings(context.paths);
        return textResult(
          JSON.stringify(
            listPersonas(context.paths).flatMap((item) =>
              "name" in item ? [{ name: item.name, active: item.file === settings.persona }] : [],
            ),
          ),
        );
      },
    },
    {
      name: "get_help",
      label: "read the house rules",
      description: "Read LittleTavern's commands, key bindings and file locations.",
      parameters: Type.Object({}),
      execute: async () => textResult(context.help()),
    },
  ];
}

function textResult(text: string, isError = false, details: { endTurn?: boolean } = {}) {
  return {
    content: [{ type: "text" as const, text }],
    details,
    ...(isError ? { isError: true } : {}),
  };
}

// Match the TUI's control stripping without importing the UI into the engine.
function stripControls(text: string): string {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: strip terminal OSC sequences
  const osc = /\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)?/g;
  // biome-ignore lint/suspicious/noControlCharactersInRegex: strip terminal CSI sequences
  const csi = /\x1b\[[0-?]*[ -/]*[@-~]/g;
  // biome-ignore lint/suspicious/noControlCharactersInRegex: strip other terminal escape sequences
  const otherEscape = /\x1b[\s\S]?/g;
  // biome-ignore lint/suspicious/noControlCharactersInRegex: remove controls except newline and tab
  const control = /[\x00-\x08\x0b-\x1f\x7f-\x9f]/g;
  return text
    .replace(/\r\n?/g, "\n")
    .replace(osc, "")
    .replace(csi, "")
    .replace(otherEscape, "")
    .replace(control, "");
}
