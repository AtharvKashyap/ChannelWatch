import { serve } from "@hono/node-server";
import { app } from "./index.js";

/**
 * Node entrypoint. Kept separate from `index.ts` so importing the app (tests,
 * other services) never starts a listener.
 */
const port = Number(process.env.API_PORT ?? 8787);
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`channelwatch api listening on http://localhost:${info.port}`);
});
