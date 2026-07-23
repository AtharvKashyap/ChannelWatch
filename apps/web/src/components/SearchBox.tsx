"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SITE_COPY } from "@channelwatch/schemas";

/**
 * The home-page search control. A thin client component: it navigates to
 * `/?q=…` (a GET-style search) and lets the server component render the results
 * from `/api/v1/channels/search`. All labels come from the reviewed copy module
 * (CLAUDE.md rule 2).
 */
export interface SearchBoxProps {
  initialQuery?: string;
}

export function SearchBox({ initialQuery = "" }: SearchBoxProps) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = query.trim();
    router.push(trimmed ? `/?q=${encodeURIComponent(trimmed)}` : "/");
  }

  return (
    <form className="cw-search" role="search" onSubmit={onSubmit}>
      <label htmlFor="cw-search-input">{SITE_COPY.searchLabel}</label>
      <input
        id="cw-search-input"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={SITE_COPY.searchPlaceholder}
      />
      <button type="submit">{SITE_COPY.searchButton}</button>
    </form>
  );
}
