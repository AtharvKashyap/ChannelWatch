# CHANNELWATCH — Launch Runbook (zero-cost hosting)

The master, end-to-end launch document. Follow it top to bottom. It is written
for someone who can copy-paste terminal commands and click through a dashboard —
you do **not** need to be an ops engineer.

**The stack is all-free.** The only unavoidable cost is the **one-time $5 Chrome
Web Store developer registration fee**.

| Piece                    | Host                       | Cost                  |
| ------------------------ | -------------------------- | --------------------- |
| Postgres database        | **Neon** (free tier)       | $0                    |
| API (`services/api`)     | **Render** (free web svc)  | $0 (sleeps when idle) |
| Web app (`apps/web`)     | **Vercel** (Hobby)         | $0                    |
| Extension backend origin | `*.onrender.com` subdomain | $0 (no custom domain) |
| Web app origin           | `*.vercel.app` subdomain   | $0 (no custom domain) |
| Chrome Web Store account | Google                     | **$5 one-time**       |

Config lives in this repo: `render.yaml` (API blueprint) and
`apps/web/vercel.json` (web build settings). This runbook drives them.

> **This is an engineering deploy guide, not legal clearance.** Do not flip to a
> public launch until the human gates in Step 9 and `docs/launch-checklist.md`
> §1 (attorney sign-off) are satisfied. You can complete Steps 1–8 to stand up a
> private / soft-launch environment first.

---

## ⚠️ Free-tier caveats — read before you start

<table>
<tr><td>

**Render free web service cold starts.** The API **sleeps after ~15 minutes of
no traffic** and takes **~30–60 seconds to wake** on the next request. This is
by design on the free plan and is **acceptable for CHANNELWATCH**:

- The extension is **popup-only and fail-silent**: it never injects anything
  into YouTube. If a lookup is slow or errors, the popup shows a "still
  working / couldn't load" message rather than affecting the page. The first
  lookup after an idle period may take ~30–60s while the API wakes; the popup
  shows a cold-start message and the result appears once it is warm.
- The background service worker keeps an **in-memory session cache** (a `Map`,
  never `chrome.storage`), so repeat lookups in the same browser session are
  instant and never hit the sleeping server. The cache is cleared when the
  browser/worker restarts — the extension persists no data.
- `healthCheckPath: /healthz` keeps Render from killing a healthy instance, but
  it does **not** stop the idle-sleep on free (nothing does, short of paid).

**Neon free-tier caps.** Free Neon gives a limited amount of storage and compute
(and auto-suspends the compute when idle, which adds a small first-query wake
latency on top of Render's). The ~100-channel seed dataset is tiny and fits
comfortably, but watch the Neon dashboard usage meter; heavy public traffic can
exhaust the free compute allowance.

**The API origin is baked into the extension.** `VITE_API_BASE_URL` is compiled
into the store bundle at build time (manifest `host_permissions` **and** the
default setting — `docs/reproducible-build.md`). Because we ship the free
`https://<name>.onrender.com` subdomain, **moving to a custom domain later means
rebuilding the extension and shipping a new Chrome Web Store release** (users
must update). Choose the Render service name deliberately in Step 3 — it is the
origin you will live with until a store re-release.

</td></tr>
</table>

---

## Step 0 — What you need before you begin

- This repo checked out locally, Node **20.x** (the repo pins `>=20`; 20.12.1 is
  the verified build version), and network access. You do **not** need a global
  pnpm install — every command below uses `npx pnpm@9`, which pins pnpm 9.15.9.
- Accounts (all free to create): **Neon**, **Render**, **Vercel**, and a
  **Google** account for the Chrome Web Store (the $5 fee comes later, Step 8).
- A GitHub repo for this codebase (Render and Vercel both deploy from GitHub).
  Push the branch you intend to deploy (the blueprints assume `main` — adjust
  `render.yaml` `branch:` if yours differs).

Sanity-check the toolchain from the repo root:

```bash
node -v                       # v20.x
npx pnpm@9 -v                 # 9.15.9
npx pnpm@9 install --frozen-lockfile
```

---

## Step 1 — Create the Neon project and get connection strings

1. Sign in to **neon.tech** → **New Project**. Pick a name (e.g.
   `channelwatch`) and the region closest to your Render region (Step 3 uses
   `oregon` = US West by default). Postgres 16 is fine.
2. After it provisions, open **Dashboard → Connect** (or **Connection
   Details**). Neon shows you connection strings. **You need two forms** — copy
   both:

   - **Pooled** (host contains `-pooler`, e.g.
     `…ep-xxxx-pooler.us-west-2.aws.neon.tech`). Uses PgBouncer; use this for the
     **running API** (many short-lived connections behind a serverless-ish app).
   - **Direct / unpooled** (host **without** `-pooler`). Use this for
     **migrations and the one-off import scripts** — schema changes and the
     migrator's advisory locks are unreliable over a transaction pooler.

   Both look like:
   `postgresql://USER:PASSWORD@HOST/neondb?sslmode=require`

3. **Keep `?sslmode=require`** on the string. The API's Postgres client
   (`services/api/src/db/client.ts`, `postgres-js`) reads `sslmode` from the URL,
   so TLS to Neon needs **no code change** — just don't drop the query param.

> Pooled vs direct in one line: **direct** string for Step 2 (migrate + import),
> **pooled** string for the Render `DATABASE_URL` in Step 3.

---

## Step 2 — Migrate + seed the database FROM YOUR LOCAL MACHINE

You run these once, locally, against Neon. There is no migration step on the
Render deploy — keeping DDL and data import off the free web service avoids
cold-start and build-timeout surprises.

Use the **direct (unpooled)** connection string from Step 1.

```bash
# From the repo root. Export the DIRECT (non-pooler) Neon URL:
export DATABASE_URL='postgresql://USER:PASSWORD@HOST/neondb?sslmode=require'   # DIRECT

# 1. Apply schema migrations (services/api/migrations/*.sql).
npx pnpm@9 db:migrate
#    → prints "migrations applied"

# 2. Import the researched channel dataset (data/research/*.yaml).
#    Idempotent: re-running an unchanged dataset is a true no-op.
npx pnpm@9 import:research
#    → prints one line per channel + a whole-graph recompute summary
```

Notes:

- `npx pnpm@9 db:migrate` / `import:research` are the root scripts that forward
  to `@channelwatch/api` (see root `package.json`). They use `tsx`, so no build
  of the API is required to run them.
- Only **reviewed** records publish; drafts (no `reviewed_by`) and records still
  awaiting a second reviewer stay unpublished (`docs/launch-checklist.md` §2).
- To confirm it landed, you can point a `psql` at the same URL and
  `select count(*) from channels;` — or just wait for the Step 6 smoke test.

---

## Step 3 — Deploy the API to Render (via the blueprint)

The repo ships `render.yaml` — a free-plan blueprint for the API. Render reads it
and creates the service; you only supply the two secrets.

1. In **render.com → New → Blueprint**, connect your GitHub repo and select the
   branch. Render detects `render.yaml` and shows the `channelwatch-api` web
   service (Free plan, health check `/healthz`).
2. Before/at first deploy, set the two `sync: false` secrets in the Render UI:
   - **`DATABASE_URL`** → the **POOLED** Neon string from Step 1 (with
     `?sslmode=require`).
   - **`WEB_ORIGIN`** → leave a placeholder for now (e.g.
     `https://example.vercel.app`); you will set the real Vercel URL in Step 4.
     _CORS for the `/review` console will not work until this is correct._
     The non-secret vars (`RATE_LIMIT_STORE=postgres`, `REQUEST_LOG=on`,
     `ABUSE_METRICS=on`, `NODE_VERSION`) are declared in `render.yaml` — no action.
3. Click **Apply / Create**. Render runs the blueprint build:
   `npx pnpm@9 install --frozen-lockfile && npx pnpm@9 exec turbo run build --filter=@channelwatch/api`
   then starts it with `cd services/api && API_PORT=$PORT node dist/server.js`
   (Render injects `$PORT`; the server reads `API_PORT`).
4. When the deploy is live, **copy the service URL**:
   `https://channelwatch-api.onrender.com` (your exact name may differ). **This
   is the origin you will bake into the extension in Step 7 — write it down.**

> First request after a deploy or after 15 min idle takes ~30–60s (cold start).
> That's expected — see the caveats box.

---

## Step 4 — Deploy the web app to Vercel, then wire the origins together

1. In **vercel.com → Add New → Project**, import the same GitHub repo.
2. **Root Directory:** set to **`apps/web`**. Vercel picks up
   `apps/web/vercel.json`, which sets the framework to Next.js and runs the
   install/build from the repo root so the pnpm workspace resolves:
   - install: `cd ../.. && npx pnpm@9 install --frozen-lockfile`
   - build: `cd ../.. && npx pnpm@9 exec turbo run build --filter=@channelwatch/web`
     Ensure **"Include files outside the Root Directory"** stays enabled (Vercel
     enables this automatically for a detected monorepo) so `packages/*` are
     available to the build.
3. **Environment variable** (Project → Settings → Environment Variables), for
   Production (and Preview if you want previews to work):
   - **`NEXT_PUBLIC_API_BASE_URL`** = your Render URL from Step 3, e.g.
     `https://channelwatch-api.onrender.com` (no trailing slash). It is a public
     value baked into the browser bundle — not a secret.
4. **Deploy.** Copy the resulting web URL, e.g.
   `https://channelwatch-web.vercel.app`.
5. **Close the loop — set `WEB_ORIGIN` on Render** (Step 3) to this exact Vercel
   URL and redeploy the API. This is what lets the browser call the API from the
   `/review` console (CORS with credentials is scoped to `WEB_ORIGIN`;
   `services/api/src/index.ts`). The extension's `chrome-extension://` origin is
   always admitted and does not depend on this.

> Dashboard-only alternative: if you prefer not to use `apps/web/vercel.json`,
> set the same install/build commands and `NEXT_PUBLIC_API_BASE_URL` in the
> Vercel project settings by hand — the effect is identical.

---

## Step 5 — Seed the first reviewer account

There is no public signup. Provision the first reviewer from your local machine
against Neon (use either connection string; direct is fine). The script is
env-driven and idempotent (re-running with the same email updates that one row).

```bash
export DATABASE_URL='postgresql://USER:PASSWORD@HOST/neondb?sslmode=require'
REVIEWER_EMAIL='you@example.com' \
REVIEWER_PASSWORD='a-strong-passphrase-min-12-chars' \
REVIEWER_NAME='Your Name' \
REVIEWER_ROLE=REVIEWER \
  npx pnpm@9 --filter @channelwatch/api db:seed-reviewer
#   → "reviewer created: you@example.com (id …)"
```

The password must be **at least 12 characters**; it is stored only as a scrypt
verifier, never plaintext, and provisioning writes an `audit_events` row
(`services/api/scripts/seed-reviewer.ts`). You will log in with these credentials
at `<vercel-url>/review/login` in the next step.

---

## Step 6 — Smoke test

Replace the URLs with yours. **The first call may take ~30–60s** while Render
wakes — that is the cold start, not a failure. Run it once to warm the service,
then again to see real latency.

```bash
API=https://channelwatch-api.onrender.com
WEB=https://channelwatch-web.vercel.app

# a) Health — expect {"status":"ok","db":"up"} and HTTP 200.
curl -s -w '\n%{http_code}\n' "$API/healthz"

# b) A public lookup — use a channel ID you imported in Step 2
#    (UC… id from one of data/research/*.yaml). Expect a JSON payload.
curl -s -w '\n%{http_code}\n' "$API/api/v1/lookup?channelId=UCxxxxxxxxxxxxxxxxxxxxxx"
```

Then in a browser:

- **c) Public channel page:** open `"$WEB"/channel/UCxxxxxxxxxxxxxxxxxxxxxx` for a
  researched channel — it should render the ownership summary, chain, sources,
  and confidence.
- **d) Reviewer login:** open `"$WEB"/review/login`, log in with the Step 5
  credentials, and confirm the claim queue / audit viewer load (this exercises
  CORS + the `WEB_ORIGIN` you set on Render).

Checklist — all four must pass before proceeding:

- [ ] `/healthz` returns `200` with `"db":"up"`
- [ ] a lookup returns the expected record
- [ ] a public channel page renders sourced content
- [ ] reviewer login works and the console loads (proves `WEB_ORIGIN`/CORS)

If `/healthz` shows `"db":"down"`, the `DATABASE_URL` on Render is wrong or
missing `?sslmode=require`. If the console can't call the API (CORS error in the
browser console), `WEB_ORIGIN` on Render doesn't exactly match the Vercel URL.

---

## Step 7 — Build the extension ZIP (points at your Render URL)

Follow `docs/reproducible-build.md`; the launch-specific part is baking **your**
Render origin into the bundle. From the repo root, on Node 20.x, at the release
commit:

```bash
# 1. Exact dependency tree.
npx pnpm@9 install --frozen-lockfile

# 2. Bake YOUR Render API origin (REQUIRED — an unset value bakes
#    http://localhost:8787 and produces a BROKEN store bundle).
export VITE_API_BASE_URL='https://channelwatch-api.onrender.com'   # your Step 3 URL
#    Also bake your Vercel site origin so the popup's "Report an error" link
#    opens the real corrections page (unset defaults to http://localhost:3000).
export VITE_WEB_BASE_URL='https://channelwatch-web.vercel.app'     # your Step 4 URL

# 3. Set a real release version in apps/extension/manifest.config.ts
#    (e.g. 0.1.0) — commit it so the tag captures it.

# 4. Clean build.
rm -rf apps/extension/dist
npx pnpm@9 --filter @channelwatch/extension build

# 5. Verify the baked origin in the built manifest before zipping:
grep onrender.com apps/extension/dist/manifest.json
#    → must show your onrender.com origin in host_permissions (NOT localhost).

# 6. Package the ZIP for the store (deterministic entry order):
( cd apps/extension/dist && find . -type f | sort | zip -X -D ../channelwatch-0.1.0.zip -@ )
```

`apps/extension/channelwatch-0.1.0.zip` is your upload artifact. Record the git
tag, the exact Node version, and the `VITE_API_BASE_URL` value in the release
notes so a third party can reproduce the build (`docs/reproducible-build.md`).

---

## Step 8 — Chrome Web Store submission

1. **Register** at the Chrome Web Store Developer Dashboard and pay the
   **one-time $5** developer fee (the only unavoidable cost of this launch).
2. **New item → upload** `channelwatch-0.1.0.zip` from Step 7.
3. **Store listing** — paste from `docs/store-listing.md`: store name, category
   (Productivity), short + long description, and the five screenshots (capture the
   popup open on a real researched channel's video; do not fabricate ownership).
   Produce the promo tile (440×280) and 128×128 icon marked `[HUMAN]` there.
4. **Permission justifications** — the popup-only build requests **no
   `permissions` at all** (no `storage`); paste only the two host-permission
   justifications from `docs/store-listing.md`. Replace `<api-domain>` with your
   `channelwatch-api.onrender.com` origin — it must match the origin baked into
   the submitted bundle (Step 7 verification).
5. **Privacy practices tab** — answer exactly per `docs/store-listing.md` /
   `PRIVACY.md`: single purpose; **no** collection in every personal-data
   category; no telemetry by default; not sold/transferred. Paste the **privacy
   policy URL** — the public URL where `PRIVACY.md` is hosted (e.g. your Vercel
   `/legal` page or a hosted copy; launch checklist §3.1).
6. **Submit for review.** Google's review is a human gate outside this repo.

---

## Step 9 — Remaining human gates (do not skip before public launch)

These cannot be discharged by code or by this runbook. Track them in
`docs/launch-checklist.md`:

- **Attorney sign-off (MVP-blocking).** Checklist §1.1–§1.12 must be reviewed by
  a licensed attorney; §1.12 additionally requires **registering a DMCA
  designated agent** with the US Copyright Office and replacing the placeholder
  in `LEGAL_PAGE_COPY.agentContact`.
- **Two-person review complete.** Confirm every sensitivity-flagged record
  carries two approvals and no draft is publicly reachable (checklist §2).
- **A real security contact** in `SECURITY.md` (placeholder today — checklist
  §6.4) and a designated legal/abuse/notice contact (§6.6, ties to §1.12).
- **Correction-queue owner + SLA** assigned before inviting public corrections
  (checklist §7.4).
- **Uptime/error alerting** on the API (checklist §7.1 — GAP) and a scheduled
  selector-health run (§7.3).

See `docs/launch-checklist.md` "Launch gate summary" for the full stop list.

---

## Quick reference — where each setting lives

| Setting                    | Where                                  | Value                                        |
| -------------------------- | -------------------------------------- | -------------------------------------------- |
| `DATABASE_URL` (API)       | Render dashboard (secret)              | Neon **pooled** string + `?sslmode=require`  |
| `DATABASE_URL` (local)     | your shell, Steps 2 & 5                | Neon **direct** string + `?sslmode=require`  |
| `WEB_ORIGIN`               | Render dashboard (secret)              | exact Vercel URL, e.g. `https://…vercel.app` |
| `RATE_LIMIT_STORE`         | `render.yaml`                          | `postgres`                                   |
| `REQUEST_LOG`              | `render.yaml`                          | `on`                                         |
| `ABUSE_METRICS`            | `render.yaml`                          | `on`                                         |
| `NEXT_PUBLIC_API_BASE_URL` | Vercel env var                         | your Render `…onrender.com` URL              |
| `VITE_API_BASE_URL`        | your shell at extension build (Step 7) | your Render `…onrender.com` URL              |
| `VITE_WEB_BASE_URL`        | your shell at extension build (Step 7) | your Vercel `…vercel.app` URL                |
