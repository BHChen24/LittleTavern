export type ProviderErrorKind =
  | "key-rejected"
  | "no-credit"
  | "rate-limited"
  | "model-unavailable"
  | "network"
  | "other";

export function describeProviderError(message: string): { kind: ProviderErrorKind; text: string } {
  if (/\b(401|403)\b/.test(message))
    return { kind: "key-rejected", text: "OpenRouter rejected the key" };
  if (/\b402\b/.test(message))
    return { kind: "no-credit", text: "OpenRouter reports insufficient credit" };
  if (/\b429\b/.test(message))
    return { kind: "rate-limited", text: "OpenRouter rate limit reached; try again later" };
  if (/\b404\b/.test(message))
    return { kind: "model-unavailable", text: "The selected model is unavailable" };
  if (/fetch failed|ENOTFOUND|ECONNREFUSED|ETIMEDOUT/i.test(message))
    return { kind: "network", text: "Network request failed; check your connection" };
  return { kind: "other", text: `Provider request failed: ${message}` };
}
