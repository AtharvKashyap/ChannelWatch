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
const savedTrustedProxyHops = process.env.TRUSTED_PROXY_HOPS;

afterEach(() => {
  if (savedTrustedProxy === undefined) delete process.env.TRUSTED_PROXY;
  else process.env.TRUSTED_PROXY = savedTrustedProxy;
  if (savedTrustedProxyHops === undefined) delete process.env.TRUSTED_PROXY_HOPS;
  else process.env.TRUSTED_PROXY_HOPS = savedTrustedProxyHops;
});

describe("clientIp", () => {
  it("ignores X-Forwarded-For when TRUSTED_PROXY is unset (uses socket ip)", () => {
    delete process.env.TRUSTED_PROXY;
    const c = fakeCtx({ "x-forwarded-for": "1.2.3.4" }, "10.0.0.9");
    expect(clientIp(c)).toBe("10.0.0.9");
  });

  it("falls back to 'unknown' when no proxy is trusted and no socket exists", () => {
    delete process.env.TRUSTED_PROXY;
    expect(clientIp(fakeCtx({ "x-forwarded-for": "1.2.3.4" }))).toBe("unknown");
  });

  it("uses the RIGHT-most X-Forwarded-For hop when TRUSTED_PROXY is set (1 hop)", () => {
    // Chain: client(1.2.3.4) -> real client(5.6.7.8) -> [Render router appended
    // its view]. With 1 trusted hop, the real client is the last entry.
    process.env.TRUSTED_PROXY = "1";
    delete process.env.TRUSTED_PROXY_HOPS;
    const c = fakeCtx({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" }, "10.0.0.9");
    expect(clientIp(c)).toBe("5.6.7.8");
  });

  it("does NOT let a client-supplied left-most XFF value change the key (anti-spoof)", () => {
    process.env.TRUSTED_PROXY = "1";
    delete process.env.TRUSTED_PROXY_HOPS;
    // The attacker forges a left-most entry; the trusted proxy appends the real
    // client's address on the right. The derived key must be the real address,
    // unaffected by whatever the attacker prepends.
    const spoofA = fakeCtx({ "x-forwarded-for": "666.6.6.6, 5.6.7.8" }, "10.0.0.9");
    const spoofB = fakeCtx({ "x-forwarded-for": "777.7.7.7, 5.6.7.8" }, "10.0.0.9");
    expect(clientIp(spoofA)).toBe("5.6.7.8");
    expect(clientIp(spoofB)).toBe("5.6.7.8");
    expect(clientIp(spoofA)).toBe(clientIp(spoofB));
  });

  it("gives two different real clients independent keys (right-most differs)", () => {
    process.env.TRUSTED_PROXY = "1";
    delete process.env.TRUSTED_PROXY_HOPS;
    const clientA = fakeCtx({ "x-forwarded-for": "spoof, 5.6.7.8" }, "10.0.0.9");
    const clientB = fakeCtx({ "x-forwarded-for": "spoof, 9.8.7.6" }, "10.0.0.9");
    expect(clientIp(clientA)).toBe("5.6.7.8");
    expect(clientIp(clientB)).toBe("9.8.7.6");
    expect(clientIp(clientA)).not.toBe(clientIp(clientB));
  });

  it("honors TRUSTED_PROXY_HOPS by taking xff[len - hops] (strip N from the right)", () => {
    // Two trusted proxies in front of us. Chain (left->right): spoofable-left,
    // real-client, inner-trusted-proxy. With hops=2, the real client is
    // xff[len - 2] = index 1.
    process.env.TRUSTED_PROXY = "1";
    process.env.TRUSTED_PROXY_HOPS = "2";
    const c = fakeCtx({ "x-forwarded-for": "spoof-left, 203.0.113.9, 172.16.0.2" }, "10.0.0.9");
    expect(clientIp(c)).toBe("203.0.113.9");
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
