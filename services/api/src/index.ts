import { Hono } from "hono";
import { getSql } from "./db/client.js";

/**
 * CHANNELWATCH API (M1 skeleton). Only `GET /healthz` exists — the public
 * `/api/v1` endpoints (SPEC §17) arrive in M2. `createApp` is exported so tests
 * can exercise the app without binding a port.
 */
export function createApp(): Hono {
  const app = new Hono();

  app.get("/healthz", async (c) => {
    try {
      await getSql()`select 1`;
      return c.json({ status: "ok", db: "up" });
    } catch (err) {
      return c.json(
        { status: "degraded", db: "down", error: err instanceof Error ? err.message : String(err) },
        503,
      );
    }
  });

  return app;
}

export const app = createApp();
export default app;

export * from "./db/schema.js";
export * from "./db/mappers.js";
export { getDb, getSql, closeDb } from "./db/client.js";
