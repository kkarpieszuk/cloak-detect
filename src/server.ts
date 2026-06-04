import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  analyzeUrl,
  closeBrowser,
  visitErrorToStatus,
  VisitError,
} from "./analyzer.js";
import { UrlGuardError, validateTargetUrl } from "./url-guard.js";
import { checkRateLimit, rateLimitMessage } from "./rate-limit.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, "..", "public");
const PORT = Number(process.env.PORT) || 3000;
const REQUEST_TIMEOUT_MS = 45_000;

const app = express();
app.use(express.json({ limit: "16kb" }));
app.use(express.static(PUBLIC_DIR));

function clientIp(req: express.Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    return forwarded.split(",")[0]?.trim() ?? req.ip ?? "unknown";
  }
  return req.ip ?? "unknown";
}

app.post("/api/analyze", async (req, res) => {
  if (!checkRateLimit(clientIp(req))) {
    res.status(429).json({ error: rateLimitMessage() });
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const rawUrl = req.body?.url;
    const url = await validateTargetUrl(rawUrl);

    if (controller.signal.aborted) {
      res.status(422).json({ error: "Przekroczono limit czasu żądania." });
      return;
    }

    const result = await analyzeUrl(url);
    res.json(result);
  } catch (err) {
    if (err instanceof UrlGuardError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    if (err instanceof VisitError) {
      res.status(visitErrorToStatus(err)).json({
        error: `Błąd wizyty (${err.profile}): ${err.message}`,
      });
      return;
    }
    if (controller.signal.aborted) {
      res.status(422).json({ error: "Przekroczono limit czasu żądania." });
      return;
    }
    const message =
      err instanceof Error ? err.message : "Wystąpił nieoczekiwany błąd.";
    res.status(500).json({ error: message });
  } finally {
    clearTimeout(timeout);
  }
});

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

const server = app.listen(PORT, () => {
  console.log(`Cloak Detect: http://localhost:${PORT}`);
});

async function shutdown() {
  server.close();
  await closeBrowser();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
