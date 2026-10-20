import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import pino from "pino";

export function scrubSecrets(text: string, secrets: readonly string[]): string {
  for (const secret of [...secrets].filter(Boolean).sort((a, b) => b.length - a.length)) {
    text = text.split(secret).join("[REDACTED]");
  }
  return text;
}

function scrubValue(value: unknown, secrets: readonly string[]): unknown {
  if (typeof value === "string") return scrubSecrets(value, secrets);
  if (value instanceof Error) return scrubValue(pino.stdSerializers.err(value), secrets);
  if (Array.isArray(value)) return value.map((entry) => scrubValue(entry, secrets));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, scrubValue(entry, secrets)]),
    );
  }
  return value;
}

export function createLogger(file: string, getSecrets: () => readonly string[]) {
  mkdirSync(dirname(file), { recursive: true });
  return pino(
    {
      redact: { paths: ["apiKey", "key", "headers.authorization"], censor: "[REDACTED]" },
      hooks: {
        logMethod(args, method) {
          const safeArgs = args.map((arg) => scrubValue(arg, getSecrets()));
          method.apply(this, safeArgs as Parameters<typeof method>);
        },
      },
    },
    pino.destination({ dest: file, sync: true }),
  );
}
