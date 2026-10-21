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
import type { CharacterItem } from "./character-chat.ts";

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

function textResult(text: string, isError = false) {
  return {
    content: [{ type: "text" as const, text }],
    details: {},
    ...(isError ? { isError: true } : {}),
  };
}
