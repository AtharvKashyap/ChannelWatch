# CHANNELWATCH Privacy Policy

CHANNELWATCH is built to give viewers context about who owns channels — not to
watch the viewers. This policy is adapted from Spec §22 and is binding on the
extension and backend. We reject surveillance of viewers and the collection of
unnecessary browsing history (Spec §4).

---

## What the Extension Sends (Spec §22.2)

To look up a channel, the extension sends **only**:

```text
YouTube channel ID
Extension version
Requested data version
```

That is the complete request payload for an ownership lookup. Channels are
identified by their immutable `youtube_channel_id`, which is all the backend needs
to match a record.

---

## What We Never Collect (Spec §22.1, §22.2)

The extension does **not** collect:

- Full browsing history.
- Video watch duration.
- Search queries.
- Comments.
- Google account identity.
- Subscription list.
- Personally identifying viewer information.

And it avoids sending:

- Video ID (unless strictly required for a lookup).
- User identity.
- Full page URL.
- Referrer.
- YouTube cookies.

The extension stores **no** user data at all. It does not write to
`chrome.storage`, and it keeps no history of the channels a user views. The only
caching is an **in-memory session cache** in the background service worker (a
plain `Map` keyed by channel ID) that avoids re-fetching the same channel within
a session; it is never persisted to disk and is gone when the service worker or
browser restarts (Spec §18.6). Extension permissions are kept minimal — no
`storage` permission, no full browsing history, no `tabs` permission, no
`scripting` permission, no cookies, no identity permissions, and no access to
unrelated sites (Spec §18.7). The only host access is `youtube.com` (to read the
public channel ID on the watch page) and the fixed API origin.

---

## Telemetry (Spec §22.3)

Telemetry is **disabled by default and strictly opt-in**. When enabled by the
user, it must be aggregated, documented, easy to disable, and free of any
channel-viewing history. Users can disable extension analytics at any time
(Spec §9.5).

Permitted telemetry, when opted in, is limited to:

- Extension version.
- API latency.
- Rendering failures.
- Selector failures.
- Anonymous crash data.

Telemetry never includes which channels or videos a user viewed.

---

## Creator and Subject Data

Separately from viewer privacy, CHANNELWATCH never publishes home addresses,
personal phone numbers, family information, private email addresses, confidential
contracts, leaked personal documents, speculative personal wealth, or any
information unrelated to ownership transparency (Spec §22.4). See
`docs/evidence-policy.md` §5.
