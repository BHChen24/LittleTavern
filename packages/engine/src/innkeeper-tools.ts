import type { AgentTool } from "@earendil-works/pi-agent-core";
import { Type } from "@earendil-works/pi-ai";
import type { AppPaths, RequestSettings } from "@littletavern/data";
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
      name: "get_help",
      label: "read the house rules",
      description: "Read LittleTavern's commands, key bindings and file locations.",
      parameters: Type.Object({}),
      execute: async () => ({ content: [{ type: "text", text: context.help() }], details: {} }),
    },
  ];
}
