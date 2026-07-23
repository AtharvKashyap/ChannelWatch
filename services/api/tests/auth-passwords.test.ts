import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "../src/auth/passwords.js";

/**
 * Unit tests for the scrypt password verifier. No DB, no I/O — pure KDF logic.
 */
describe("password hashing", () => {
  it("produces a self-describing scrypt verifier, not the plaintext", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(hash).not.toContain("correct horse");
    expect(hash.split("$")).toHaveLength(6);
  });

  it("verifies the correct password and rejects a wrong one", async () => {
    const hash = await hashPassword("s3cret-pass");
    expect(await verifyPassword("s3cret-pass", hash)).toBe(true);
    expect(await verifyPassword("s3cret-pas", hash)).toBe(false);
    expect(await verifyPassword("", hash)).toBe(false);
  });

  it("uses a random salt so two hashes of the same password differ", async () => {
    const a = await hashPassword("same");
    const b = await hashPassword("same");
    expect(a).not.toBe(b);
    expect(await verifyPassword("same", a)).toBe(true);
    expect(await verifyPassword("same", b)).toBe(true);
  });

  it("returns false (never throws) for null/empty/malformed stored values", async () => {
    expect(await verifyPassword("x", null)).toBe(false);
    expect(await verifyPassword("x", undefined)).toBe(false);
    expect(await verifyPassword("x", "")).toBe(false);
    expect(await verifyPassword("x", "not-a-verifier")).toBe(false);
    expect(await verifyPassword("x", "bcrypt$1$2$3$4$5")).toBe(false);
    expect(await verifyPassword("x", "scrypt$notanumber$8$1$c2FsdA==$aGFzaA==")).toBe(false);
  });
});
