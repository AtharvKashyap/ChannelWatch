# Reproducible build — CHANNELWATCH extension

How to produce the Chrome Web Store bundle deterministically, and how a third
party verifies that the published ZIP was built from this source (SECURITY.md
§32.5: "reproducible builds"). A reproducible build lets anyone confirm the
extension in the store contains no code that isn't in the public repository.

## TL;DR — is the current build reproducible?

**Yes, the unpacked bundle is byte-for-byte reproducible.** Two clean builds
from the same source, same toolchain, and same `VITE_API_BASE_URL` produce an
identical `apps/extension/dist/` (verified: identical aggregate SHA-256 over all
output files). The only inputs that change the output are documented in
"Inputs that MUST be pinned" below — none of them vary implicitly.

One packaging caveat: the store artifact is a **ZIP**, and ZIP containers embed
file timestamps and ordering, which are not reproducible by default. Verify
against the **unpacked file hashes**, or build the ZIP deterministically (see
"Producing a deterministic ZIP"). This is a property of ZIP, not of our build.

## Toolchain (pinned)

| Tool               | Pinned version                     | Where pinned                                                  |
| ------------------ | ---------------------------------- | ------------------------------------------------------------- |
| pnpm               | `9.15.9`                           | `package.json` → `packageManager` (enforced via corepack)     |
| Node               | `20.x` (built/verified on 20.12.1) | `package.json` → `engines.node` `>=20`; CI `node-version: 20` |
| Vite               | `5.4.21` (exact)                   | `apps/extension/package.json`                                 |
| @crxjs/vite-plugin | `2.7.1` (exact)                    | `apps/extension/package.json`                                 |
| All other deps     | exact resolutions                  | `pnpm-lock.yaml` (committed)                                  |

Node is pinned only to major `20`. Vite output has been stable across 20.x
patch releases in testing, but for a bit-exact third-party verification, pin the
**exact** Node version you shipped with (record it in the release notes; a
`.nvmrc` with the exact version is the simplest way to communicate it).

## Lockfile discipline

- `pnpm-lock.yaml` is committed and is the source of truth for every dependency
  version. The extension's build-critical deps (`vite`, `@crxjs/vite-plugin`)
  are pinned to exact versions in `apps/extension/package.json`; everything else
  resolves through the lockfile.
- Always install with `--frozen-lockfile` for a release build. This fails if the
  lockfile and manifests disagree, guaranteeing the exact dependency tree that
  was reviewed.
- Never run a release build after a bare `pnpm install` that mutated the
  lockfile — regenerate and review the lockfile change first.

## Inputs that MUST be pinned for a bit-identical build

1. **Source tree** — a specific git commit/tag (the release tag).
2. **`pnpm-lock.yaml`** — as committed at that tag.
3. **Toolchain** — pnpm `9.15.9`, the exact Node version, per the table above.
4. **`VITE_API_BASE_URL`** — the production API origin (see next section). This
   is baked into the manifest `host_permissions` **and** the background service
   worker's API base URL constant (`src/shared/config.ts`), so a different value
   produces a different (still deterministic) bundle. Two people who set the same
   value get the same bytes; an unset value silently changes the output.
5. **`VITE_WEB_BASE_URL`** — the public site origin baked into `src/shared/
   config.ts`, used only for the popup's "Report an error" link
   (`/corrections?channel=UC…`). It does not affect `host_permissions` (the link
   is a user-initiated navigation, not a fetch), but it is baked into the bundle,
   so a different value changes the output. Default `http://localhost:3000`; set
   the production site origin for a release build.
6. **`manifest.config.ts` `version`** — the release version string (see below).

Nothing else influences the output. There are no timestamps, absolute paths, or
random IDs embedded in the unpacked bundle (verified by the byte-identical
double build).

## API origin (`VITE_API_BASE_URL`) — do not skip

`apps/extension/manifest.config.ts` reads:

```
const API_ORIGIN = process.env.VITE_API_BASE_URL ?? "http://localhost:8787";
```

- If `VITE_API_BASE_URL` is **unset**, the build defaults to
  `http://localhost:8787` — a bundle that only talks to a local dev server and
  whose host permission is `http://`, which Chrome will reject for a public
  release. **A store build with the default origin is broken.**
- For a release, export the production HTTPS origin **before** building:

  ```bash
  export VITE_API_BASE_URL="https://api.channelwatch.example"   # real origin
  ```

- The baked value appears in `dist/manifest.json` `host_permissions` (e.g.
  `"https://api.channelwatch.example/*"`) and is the sole non-YouTube origin the
  extension may contact. Verify it in the built manifest before submitting.

## Version string

`manifest.config.ts` ships `version: "0.0.0"`. Set a real release version before
building (e.g. `0.1.0`). The version is part of the deterministic output, so the
verifier must use the same value. Prefer editing `manifest.config.ts` in a
release commit so the version is captured in git at the release tag.

## Build steps (release)

From the repo root, on the pinned toolchain, at the release commit:

```bash
# 1. Exact dependency tree from the committed lockfile.
corepack enable
pnpm install --frozen-lockfile

# 2. Bake the production API origin (REQUIRED — see above) and site origin.
export VITE_API_BASE_URL="https://api.channelwatch.example"
export VITE_WEB_BASE_URL="https://www.channelwatch.example"

# 3. Clean and build the MV3 bundle.
rm -rf apps/extension/dist
pnpm --filter @channelwatch/extension build

# 4. Output is apps/extension/dist/ — the unpacked, loadable extension.
```

## How a third party verifies the store bundle matches source

1. Note the release **git tag**, the **exact Node version**, and the
   **`VITE_API_BASE_URL`** / **`VITE_WEB_BASE_URL`** values from the release
   notes.
2. Check out the tag, then run the Build steps above with the same Node version
   and the same `VITE_API_BASE_URL` / `VITE_WEB_BASE_URL`.
3. Download the published extension (the store `.crx`/ZIP, or the loaded
   extension's directory) and unpack it.
4. Compare the **unpacked file hashes**, not the ZIP bytes:

   ```bash
   # Deterministic aggregate hash over every file in a build directory:
   ( cd apps/extension/dist && find . -type f -exec shasum -a 256 {} \; \
       | sort | shasum -a 256 )
   ```

   Run the same command over the unpacked store bundle. The two aggregate
   hashes must match. (The store `.crx` additionally contains a signature block
   and Chrome may re-zip on install, so hash the extracted files, not the
   container.)

A mismatch means the store bundle was not built from the tagged source with the
declared inputs — investigate before trusting it.

## Producing a deterministic ZIP (optional)

If you also want a reproducible ZIP artifact (not just matching unpacked
hashes), normalize timestamps and entry order:

```bash
cd apps/extension/dist
# Fixed mtime + sorted entries + no extra metadata:
find . -type f | sort | zip -X -D ../channelwatch-<version>.zip -@
# Then strip timestamps for full determinism:
# (or build the zip with SOURCE_DATE_EPOCH-aware tooling)
```

Matching **unpacked file hashes** is the primary, recommended verification path;
a reproducible ZIP is a convenience on top of it.

## Known gaps / notes

- **Node pinned to major only.** `engines.node` is `>=20` and CI uses
  `node-version: 20`. For bit-exact third-party verification, pin and publish the
  exact patch version (a `.nvmrc` would make this explicit; none exists today).
- **ZIP container non-determinism** is inherent to ZIP; handled by verifying
  unpacked hashes (above).
- **No CI job builds/attests the release bundle yet.** CI builds the extension
  as part of `turbo run ... build`, but does not publish a hash or signed
  attestation of a release artifact. A future improvement is a release workflow
  that records the aggregate SHA-256 and the pinned inputs alongside the tag.
