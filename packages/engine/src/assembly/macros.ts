import { type AssemblyInput, DEFAULT_USER_NAME } from "./types.ts";

export function resolveNames(input: Pick<AssemblyInput, "character" | "userName" | "persona">): {
  char: string;
  user: string;
} {
  return {
    char: input.character.name,
    user: input.persona?.name ?? input.userName ?? DEFAULT_USER_NAME,
  };
}

export function replaceMacros(text: string, names: { char: string; user: string }): string {
  return text.replace(/\{\{\s*(char|user)\s*\}\}/gi, (_match, key: string) =>
    key.toLowerCase() === "char" ? names.char : names.user,
  );
}
