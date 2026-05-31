"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent
} from "react";
import { usePathname } from "next/navigation";
import { DocumentLink as Link } from "@/components/document-link";
import { MetaLabel } from "@/components/meta-label";
import { StateLabel } from "@/components/state-label";
import { getLocaleFromPathname, localizeHref } from "@/lib/i18n";
import { getLocalizedInstitutionName } from "@/lib/institution-localization";

interface SearchAutocompleteProps {
  defaultValue?: string;
  id: string;
  name: string;
  placeholder: string;
}

interface SuggestionResult {
  claimCount: number;
  entityName: string;
  entitySlug: string;
  matchReason: string;
  publicJsonUrl: string;
  reviewState: string;
  score: number;
  sourceBackedSnippet: string;
  sourceCount: number;
}

type SuggestionStatus = "idle" | "loading" | "ready" | "empty" | "error";

export function SearchAutocomplete({
  defaultValue = "",
  id,
  name,
  placeholder
}: SearchAutocompleteProps) {
  const [query, setQuery] = useState(defaultValue);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [results, setResults] = useState<SuggestionResult[]>([]);
  const [status, setStatus] = useState<SuggestionStatus>("idle");
  const listboxId = useId();
  const controllerRef = useRef<AbortController | null>(null);
  const pathname = usePathname();
  const locale = getLocaleFromPathname(pathname);
  const trimmedQuery = query.trim();
  const activeResult = activeIndex >= 0 ? results[activeIndex] : undefined;

  useEffect(() => {
    setQuery(defaultValue);
  }, [defaultValue]);

  useEffect(() => {
    controllerRef.current?.abort();
    setActiveIndex(-1);

    if (trimmedQuery.length < 2) {
      setResults([]);
      setStatus("idle");
      return;
    }

    const controller = new AbortController();
    controllerRef.current = controller;
    setStatus("loading");

    const timeout = window.setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/public/v1/search.json?q=${encodeURIComponent(trimmedQuery)}&limit=8`,
          { signal: controller.signal }
        );

        if (!response.ok) throw new Error(`Search failed: ${response.status}`);

        const payload = (await response.json()) as {
          data?: {
            results?: SuggestionResult[];
          };
        };
        const nextResults = Array.isArray(payload.data?.results)
          ? payload.data.results
          : [];

        setResults(nextResults);
        setStatus(nextResults.length ? "ready" : "empty");
      } catch (error) {
        if (controller.signal.aborted) return;
        setResults([]);
        setStatus("error");
      }
    }, 180);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [trimmedQuery]);

  const panelMessage = useMemo(() => {
    if (status === "loading") return "Loading suggestions...";
    if (status === "empty") return "No public records match this query.";
    if (status === "error") return "Suggestions are unavailable. Submit the search instead.";
    return "";
  }, [status]);

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!results.length) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % results.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) =>
        current <= 0 ? results.length - 1 : current - 1
      );
    } else if (event.key === "Escape") {
      setActiveIndex(-1);
      setResults([]);
      setStatus("idle");
    } else if (event.key === "Enter" && activeResult) {
      event.preventDefault();
      window.location.assign(
        localizeHref(`/universities/${activeResult.entitySlug}`, locale)
      );
    }
  }

  return (
    <div className="search-autocomplete">
      <input
        aria-activedescendant={
          activeResult ? `${listboxId}-${activeResult.entitySlug}` : undefined
        }
        aria-autocomplete="list"
        aria-controls={listboxId}
        aria-expanded={status === "ready" || status === "loading"}
        autoComplete="off"
        defaultValue={defaultValue}
        id={id}
        name={name}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        role="combobox"
        type="search"
      />
      {status === "ready" || panelMessage ? (
        <div className="search-autocomplete__panel" id={listboxId} role="listbox">
          {panelMessage ? (
            <p className="search-autocomplete__status">{panelMessage}</p>
          ) : null}
          {results.map((result, index) => (
            <div
              aria-selected={activeIndex === index}
              className="search-autocomplete__option"
              id={`${listboxId}-${result.entitySlug}`}
              key={result.entitySlug}
              role="option"
            >
              <div className="search-autocomplete__option-main">
                <Link href={`/universities/${result.entitySlug}`}>
                  {getLocalizedInstitutionName(
                    result.entitySlug,
                    result.entityName,
                    locale
                  )}
                </Link>
                <p>{result.sourceBackedSnippet}</p>
                <div className="table-record-meta">
                  <StateLabel reviewState={result.reviewState} />
                  <MetaLabel label="Match">{result.matchReason}</MetaLabel>
                  <MetaLabel label="Score">{result.score}</MetaLabel>
                </div>
              </div>
              <div className="search-autocomplete__option-actions">
                <MetaLabel label="Claims">{result.claimCount}</MetaLabel>
                <MetaLabel label="Sources">{result.sourceCount}</MetaLabel>
                <a href={result.publicJsonUrl}>JSON</a>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
