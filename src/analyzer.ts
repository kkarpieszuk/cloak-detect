import { chromium, type Browser } from "playwright";

export const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export const GOOGLEBOT_USER_AGENT =
  "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";

const VIEWPORT = { width: 1280, height: 720 };
const GOTO_TIMEOUT_MS = 25_000;

export interface VisitResult {
  label: string;
  screenshot: string;
  status: number | null;
  finalUrl: string;
  title: string;
  durationMs: number;
  error?: string;
}

export interface AnalyzeResult {
  url: string;
  browser: VisitResult;
  googlebot: VisitResult;
  cloakingHint: string | null;
}

let browserInstance: Browser | null = null;

export async function getBrowser(): Promise<Browser> {
  if (!browserInstance) {
    browserInstance = await chromium.launch({ headless: true });
  }
  return browserInstance;
}

export async function closeBrowser(): Promise<void> {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
  }
}

async function visit(
  browser: Browser,
  url: string,
  userAgent: string,
  label: string,
): Promise<VisitResult> {
  const start = Date.now();
  const context = await browser.newContext({
    userAgent,
    viewport: VIEWPORT,
    ignoreHTTPSErrors: false,
  });
  const page = await context.newPage();

  try {
    let response = await page
      .goto(url, { waitUntil: "networkidle", timeout: GOTO_TIMEOUT_MS })
      .catch(async () => {
        return page.goto(url, {
          waitUntil: "domcontentloaded",
          timeout: GOTO_TIMEOUT_MS,
        });
      });

    const screenshotBuffer = await page.screenshot({
      fullPage: false,
      type: "png",
    });

    return {
      label,
      screenshot: `data:image/png;base64,${screenshotBuffer.toString("base64")}`,
      status: response?.status() ?? null,
      finalUrl: page.url(),
      title: (await page.title()) || "(brak tytułu)",
      durationMs: Date.now() - start,
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Nieznany błąd podczas wizyty.";
    throw new VisitError(label, message, Date.now() - start);
  } finally {
    await context.close();
  }
}

export class VisitError extends Error {
  constructor(
    public readonly profile: string,
    message: string,
    public readonly durationMs: number,
  ) {
    super(message);
    this.name = "VisitError";
  }
}

function computeCloakingHint(
  browser: VisitResult,
  googlebot: VisitResult,
): string | null {
  const diffs: string[] = [];
  if (browser.status !== googlebot.status) {
    diffs.push("kod statusu HTTP");
  }
  if (browser.finalUrl !== googlebot.finalUrl) {
    diffs.push("docelowy URL");
  }
  if (browser.title !== googlebot.title) {
    diffs.push("tytuł strony");
  }
  if (diffs.length === 0) return null;
  return `Możliwe cloaking — różnice w: ${diffs.join(", ")}. Sprawdź screenshoty.`;
}

export async function analyzeUrl(url: string): Promise<AnalyzeResult> {
  const browser = await getBrowser();

  const [browserResult, googlebotResult] = await Promise.all([
    visit(browser, url, BROWSER_USER_AGENT, "Przeglądarka"),
    visit(browser, url, GOOGLEBOT_USER_AGENT, "Googlebot"),
  ]);

  return {
    url,
    browser: browserResult,
    googlebot: googlebotResult,
    cloakingHint: computeCloakingHint(browserResult, googlebotResult),
  };
}

export function visitErrorToStatus(err: VisitError): number {
  const msg = err.message.toLowerCase();
  if (
    msg.includes("timeout") ||
    msg.includes("timed out") ||
    msg.includes("net::err_name_not_resolved") ||
    msg.includes("dns")
  ) {
    return 422;
  }
  return 502;
}
