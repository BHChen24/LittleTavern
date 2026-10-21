import type { AgentTool } from "@earendil-works/pi-agent-core";
import { Type } from "@earendil-works/pi-ai";
import {
  type AppPaths,
  listLibrary,
  listPersonas,
  type RequestSettings,
  readActivePersona,
  readSettings,
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

function textResult(text: string) {
  return { content: [{ type: "text" as const, text }], details: {} };
}
