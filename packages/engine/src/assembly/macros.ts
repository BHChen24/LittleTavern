export function replaceMacros(text: string, names: { char: string; user: string }): string {
  return text.replace(/\{\{\s*(char|user)\s*\}\}/gi, (_match, key: string) =>
    key.toLowerCase() === "char" ? names.char : names.user,
  );
}
