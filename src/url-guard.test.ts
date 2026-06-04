import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { UrlGuardError, validateTargetUrl } from "./url-guard.js";

describe("validateTargetUrl", () => {
  it("accepts https URL and normalizes", async () => {
    const result = await validateTargetUrl("https://example.com");
    assert.equal(result, "https://example.com/");
  });

  it("adds https when scheme missing", async () => {
    const result = await validateTargetUrl("example.com");
    assert.ok(result.startsWith("https://"));
  });

  it("rejects localhost", async () => {
    await assert.rejects(
      () => validateTargetUrl("http://localhost"),
      (err: unknown) => {
        assert.ok(err instanceof UrlGuardError);
        assert.equal(err.statusCode, 400);
        return true;
      },
    );
  });

  it("rejects 127.0.0.1", async () => {
    await assert.rejects(() => validateTargetUrl("http://127.0.0.1/"));
  });

  it("rejects file protocol", async () => {
    await assert.rejects(() => validateTargetUrl("file:///etc/passwd"));
  });

  it("rejects overlong URL", async () => {
    const long = "https://example.com/" + "a".repeat(3000);
    await assert.rejects(() => validateTargetUrl(long));
  });
});
