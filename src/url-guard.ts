import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const MAX_URL_LENGTH = 2048;

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "0.0.0.0",
]);

function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) {
    return true;
  }
  const [a, b] = parts;
  if (a === 127) return true;
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true;
  if (a === 0) return true;
  return false;
}

function isPrivateIpv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  if (normalized === "::1") return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  if (normalized.startsWith("fe80")) return true;
  if (normalized === "::") return true;
  return false;
}

function isPrivateIp(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) return isPrivateIpv4(ip);
  if (version === 6) return isPrivateIpv6(ip);
  return true;
}

function hostnameLooksBlocked(hostname: string): boolean {
  const lower = hostname.toLowerCase().replace(/\.$/, "");
  if (BLOCKED_HOSTNAMES.has(lower)) return true;
  if (lower.endsWith(".localhost")) return true;
  const ipVersion = isIP(lower);
  if (ipVersion !== 0) return isPrivateIp(lower);
  return false;
}

async function resolveHostname(hostname: string): Promise<string[]> {
  try {
    const results = await lookup(hostname, { all: true });
    return results.map((r) => r.address);
  } catch {
    throw new UrlGuardError("Nie można rozwiązać nazwy hosta.", 400);
  }
}

export class UrlGuardError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "UrlGuardError";
  }
}

export async function validateTargetUrl(raw: string): Promise<string> {
  if (!raw || typeof raw !== "string") {
    throw new UrlGuardError("Podaj adres URL.", 400);
  }

  const trimmed = raw.trim();
  if (trimmed.length > MAX_URL_LENGTH) {
    throw new UrlGuardError("URL jest zbyt długi.", 400);
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
  } catch {
    throw new UrlGuardError("Nieprawidłowy adres URL.", 400);
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new UrlGuardError("Dozwolone są tylko adresy http i https.", 400);
  }

  if (parsed.username || parsed.password) {
    throw new UrlGuardError("URL nie może zawierać danych logowania.", 400);
  }

  const hostname = parsed.hostname;
  if (!hostname) {
    throw new UrlGuardError("Brak nazwy hosta w URL.", 400);
  }

  if (hostnameLooksBlocked(hostname)) {
    throw new UrlGuardError(
      "Ten adres jest niedozwolony (sieć lokalna / prywatna).",
      400,
    );
  }

  const addresses = await resolveHostname(hostname);
  for (const address of addresses) {
    if (isPrivateIp(address)) {
      throw new UrlGuardError(
        "Ten adres jest niedozwolony (sieć lokalna / prywatna).",
        400,
      );
    }
  }

  return parsed.href;
}
