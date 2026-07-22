# YouTube page snapshots (sanitized)

Static HTML snapshots used by the channel-resolver unit tests (`tests/content/`).
They are parsed in a jsdom environment; the resolver must extract the immutable
`UC…` channel ID from them exactly as it would from a live page.

## Provenance

| File                | Source URL                                  | Fetched (UTC) | Channel ID                 |
| ------------------- | ------------------------------------------- | ------------- | -------------------------- |
| `watch-page.html`   | https://www.youtube.com/watch?v=AF8d72mA41M | 2026-07-22    | `UCHnyfMqiRRG1u-2MsSQLbXA` |
| `channel-page.html` | https://www.youtube.com/@veritasium         | 2026-07-22    | `UCHnyfMqiRRG1u-2MsSQLbXA` |

Both pages belong to the **Veritasium** channel (`UCHnyfMqiRRG1u-2MsSQLbXA`),
chosen because it is a well-known public channel and its ID is stable.

## Sanitization

Fetched with `curl` (desktop UA, `Cookie: SOCS=CAI;` to skip the EU consent
interstitial), then sanitized so no third-party/tracking material or PII is
committed and the file stays small (~30 KB each, target < 400 KB):

- **All `<script>` bodies removed** EXCEPT the initial-state JSON blobs the
  resolver parses, which were **truncated to only the relevant subtrees**:
  - watch page: `ytInitialPlayerResponse.videoDetails` (`{videoId, channelId,
author, title}`) and the `ytInitialData` owner subtree
    (`…videoSecondaryInfoRenderer.owner.videoOwnerRenderer` → `browseEndpoint.browseId`).
  - channel page: `ytInitialData.metadata.channelMetadataRenderer`
    (`{externalId, title, vanityChannelUrl}`).
- **All `<style>` bodies removed.**
- **`nonce="…"` attributes stripped.**
- DOM structure and the resolver-relevant `<head>` metadata are preserved:
  `<link rel="canonical">`, `<meta property="og:url">`, and the microdata
  `itemprop="author"` block (which carries only the `@handle`, exercising the
  deferred-to-M3 path).

To refresh, re-fetch the URLs above and re-run the same sanitization; update the
fetch date in this table.
