import Link from "next/link";
import { BADGE_LABELS, SITE_COPY } from "@channelwatch/schemas";
import { SearchBox } from "../components/index.js";
import { fetchChannelSearch } from "../lib/api-client.js";

/**
 * Home + search page (M3 Track C). A short, MANIFESTO-derived "what is this"
 * blurb (from the reviewed copy module), then a search over
 * `/api/v1/channels/search`. Search is GET-style: the `SearchBox` navigates to
 * `/?q=…` and this server component fetches + lists the matches, each linking to
 * its channel page. All user-facing strings come from the reviewed copy module
 * (CLAUDE.md rule 2). Rendered per-request so results are always live.
 */
export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();

  return (
    <main>
      <h1>{SITE_COPY.homeHeading}</h1>
      {SITE_COPY.homeBlurb.map((paragraph, i) => (
        <p key={i} className={i > 0 ? "cw-muted" : undefined}>
          {paragraph}
        </p>
      ))}
      <p>
        <Link href="/methodology">{SITE_COPY.methodologyLinkText}</Link>
      </p>

      <h2>{SITE_COPY.searchHeading}</h2>
      <SearchBox initialQuery={query} />

      {query === "" ? (
        <p className="cw-muted">{SITE_COPY.searchPrompt}</p>
      ) : (
        <SearchResults query={query} />
      )}
    </main>
  );
}

async function SearchResults({ query }: { query: string }) {
  const result = await fetchChannelSearch(query);

  if (!result.ok) {
    return <p className="cw-muted">{SITE_COPY.lookupError}</p>;
  }
  if (result.data.results.length === 0) {
    return <p className="cw-muted">{SITE_COPY.searchNoResults}</p>;
  }

  return (
    <section aria-label={SITE_COPY.searchResultsHeading}>
      <h2>{SITE_COPY.searchResultsHeading}</h2>
      <ul className="cw-results">
        {result.data.results.map((c) => (
          <li className="cw-result" key={c.youtube_channel_id}>
            <Link href={`/channel/${encodeURIComponent(c.youtube_channel_id)}`}>
              {c.display_name}
            </Link>
            {c.handle ? <span className="cw-muted"> · {c.handle}</span> : null}
            {c.classification ? (
              <div className="cw-muted">{BADGE_LABELS[c.classification]}</div>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
