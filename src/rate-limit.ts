interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 10;
const store = new Map<string, RateLimitEntry>();

export function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const key = ip || "unknown";
  let entry = store.get(key);

  if (!entry || now >= entry.resetAt) {
    entry = { count: 0, resetAt: now + WINDOW_MS };
    store.set(key, entry);
  }

  entry.count += 1;
  return entry.count <= MAX_REQUESTS;
}

export function rateLimitMessage(): string {
  return "Zbyt wiele żądań. Spróbuj ponownie za chwilę.";
}
