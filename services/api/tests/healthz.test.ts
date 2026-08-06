import { describe, it, expect, afterEach, vi } from "vitest";
import { createApp } from "../src/index.js";
import { closeDb } from "../src/db/client.js";

/**
 * `/healthz` must never leak the raw DB error string to unauthenticated callers.
 * On a DB failure it returns 503 `{ status: "degraded", db: "down" }` with NO
 * error detail in the body (the detail is logged server-side only). The degraded
 * path is exercised here by clearing DATABASE_URL so the lazy client throws.
 */

const savedDatabaseUrl = process.env.DATABASE_URL;

afterEach(async () => {
  vi.restoreAllMocks();
  await closeDb();
  if (savedDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = savedDatabaseUrl;
});

describe("GET /healthz (degraded path)", () => {
  it("returns 503 { status: degraded, db: down } with NO error detail", async () => {
    // No DATABASE_URL -> the lazy `getSql()` throws -> the catch branch runs.
    await closeDb();
    delete process.env.DATABASE_URL;
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await createApp().request("/healthz");

    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body).toEqual({ status: "degraded", db: "down" });
    expect(body).not.toHaveProperty("error");
    // The raw detail is logged server-side only.
    expect(errorSpy).toHaveBeenCalled();
  });
});
