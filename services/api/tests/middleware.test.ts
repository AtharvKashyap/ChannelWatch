import { describe, it, expect, afterEach } from "vitest";
import type { Context } from "hono";
import { clientIp } from "../src/http/middleware.js";

/**
 * Unit tests for `clientIp` — the rate-limit key resolver. The security-relevant
 * property: X-Forwarded-For is trusted ONLY when TRUSTED_PROXY is set, otherwise
 * the direct socket address is used so a client cannot spoof its key.
 */

function fakeCtx(headers: Record<string, string>, remoteAddress?: string): Context {
  return {
    req: { header: (k: string) => headers[k.toLowerCase()] },
    env: remoteAddress ? { incoming: { socket: { remoteAddress } } } : undefined,
  } as unknown as Context;
}

const savedTrustedProxy = process.env.TRUSTED_PROXY;

afterEach(() => {
  if (savedTrustedProxy === undefined) delete process.env.TRUSTED_PROXY;
  else process.env.TRUSTED_PROXY = savedTrustedProxy;
});

describe("clientIp", () => {
  it("ignores X-Forwarded-For when TRUSTED_PROXY is unset (anti-spoofing)", () => {
    delete process.env.TRUSTED_PROXY;
    const c = fakeCtx({ "x-forwarded-for": "1.2.3.4" }, "10.0.0.9");
    expect(clientIp(c)).toBe("10.0.0.9");
  });

  it("falls back to 'unknown' when no proxy is trusted and no socket exists", () => {
    delete process.env.TRUSTED_PROXY;
    expect(clientIp(fakeCtx({ "x-forwarded-for": "1.2.3.4" }))).toBe("unknown");
  });

  it("uses the first X-Forwarded-For hop when TRUSTED_PROXY is set", () => {
    process.env.TRUSTED_PROXY = "1";
    const c = fakeCtx({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" }, "10.0.0.9");
    expect(clientIp(c)).toBe("1.2.3.4");
  });

  it("uses X-Real-IP as a fallback when trusted and XFF absent", () => {
    process.env.TRUSTED_PROXY = "1";
    expect(clientIp(fakeCtx({ "x-real-ip": "9.9.9.9" }, "10.0.0.9"))).toBe("9.9.9.9");
  });

  it("falls back to the socket address when trusted but no forwarding headers", () => {
    process.env.TRUSTED_PROXY = "1";
    expect(clientIp(fakeCtx({}, "10.0.0.9"))).toBe("10.0.0.9");
  });
});
