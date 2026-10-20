export interface ActiveKey {
  value: string;
  source: "environment" | "saved" | "session";
  masked: string;
}

export function isBlank(value: string | null | undefined): boolean {
  return !value?.trim();
}

export function maskKey(value: string): string {
  return `••••${value.slice(-4)}`;
}

export function resolveApiKey(options: {
  envValue?: string | null;
  savedValue?: string | null;
  sessionValue?: string | null;
}): ActiveKey | null {
  const sources = [
    ["environment", options.envValue],
    ["saved", options.savedValue],
    ["session", options.sessionValue],
  ] as const;
  for (const [source, value] of sources) {
    if (value && !isBlank(value)) return { value, source, masked: maskKey(value) };
  }
  return null;
}
