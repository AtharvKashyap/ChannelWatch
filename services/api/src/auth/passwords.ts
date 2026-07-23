import { randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from "node:crypto";

/**
 * Password verifier hashing for reviewer accounts (M3 auth).
 *
 * Uses Node's built-in scrypt — a memory-hard KDF in the standard library — so
 * no native/compiled dependency (argon2, bcrypt) has to be added to the
 * TypeScript-only stack. scrypt is a defensible, widely-recommended password KDF;
 * the stored verifier is a self-describing string so parameters can evolve
 * without a migration:
 *
 *   scrypt$<N>$<r>$<p>$<saltBase64>$<hashBase64>
 *
 * A plaintext password is NEVER stored or logged. Verification is constant-time
 * (`timingSafeEqual`) and returns false — never throws — on any malformed stored
 * value, so a corrupt row cannot crash the login path.
 */

/**
 * Promise wrapper around `crypto.scrypt` that passes cost OPTIONS. `promisify`
 * only captures the 3-argument overload (no options), so we wrap the callback
 * overload by hand.
 */
function scrypt(
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCb(password, salt, keylen, options, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey);
    });
  });
}

// Cost parameters. N must be a power of two; these are conservative interactive
// defaults (N=2^15) that keep a single hash well under ~100ms on a dev machine.
const N = 32_768;
const R = 8;
const P = 1;
const KEYLEN = 64;
const SALT_BYTES = 16;
// scrypt requires maxmem STRICTLY greater than ~128*N*r bytes (here ~33.5 MB);
// give it generous headroom so parameter validation never trips.
const MAXMEM = 128 * 1024 * 1024;

/** Hash a plaintext password into a self-describing scrypt verifier string. */
export async function hashPassword(plain: string): Promise<string> {
  if (typeof plain !== "string" || plain.length === 0) {
    throw new Error("password must be a non-empty string");
  }
  const salt = randomBytes(SALT_BYTES);
  const derived = (await scrypt(plain, salt, KEYLEN, { N, r: R, p: P, maxmem: MAXMEM })) as Buffer;
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${derived.toString("base64")}`;
}

/**
 * Verify a plaintext password against a stored verifier. Returns false (never
 * throws) for a malformed/empty stored value, and compares in constant time.
 */
export async function verifyPassword(
  plain: string,
  stored: string | null | undefined,
): Promise<boolean> {
  if (!stored || typeof plain !== "string" || plain.length === 0) return false;
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const n = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  if (!Number.isInteger(n) || !Number.isInteger(r) || !Number.isInteger(p)) return false;

  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(parts[4]!, "base64");
    expected = Buffer.from(parts[5]!, "base64");
  } catch {
    return false;
  }
  if (salt.length === 0 || expected.length === 0) return false;

  let derived: Buffer;
  try {
    derived = (await scrypt(plain, salt, expected.length, {
      N: n,
      r,
      p,
      maxmem: MAXMEM,
    })) as Buffer;
  } catch {
    return false;
  }
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}
