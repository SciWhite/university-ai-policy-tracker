"use client";
import { UniversityMark } from "./university-mark";
import React, { useEffect, useId, useRef, useState } from "react";
import { policyV6InteractionCopy } from "@/lib/policy-v6-interaction-copy";
import type { SupportedLocale } from "@/lib/i18n";

type Result = { entitySlug: string; entityName: string };
export function PolicyV6SearchPicker({
  locale,
  selected,
  names,
  onToggle,
}: {
  locale: SupportedLocale;
  selected: string[];
  names: Record<string, string>;
  onToggle: (slug: string) => void;
}) {
  const ui = policyV6InteractionCopy(locale);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [status, setStatus] = useState("idle");
  const [active, setActive] = useState(-1);
  const [retry, setRetry] = useState(0);
  const [foundNames, setFoundNames] = useState<Record<string, string>>({});
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();
  useEffect(() => {
    const controller = new AbortController();
    setActive(-1);
    setResults([]);
    if (query.trim().length < 2) {
      setStatus("idle");
      return;
    }
    setStatus("loading");
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/public/v1/search.json?q=${encodeURIComponent(query.trim())}&limit=8`,
          { signal: controller.signal },
        );
        if (!response.ok) throw new Error("Search unavailable");
        const payload = await response.json();
        if (controller.signal.aborted) return;
        const items: Result[] = (payload.data?.results ?? []).filter(
          (item: Result) =>
            typeof item.entityName === "string" &&
            /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.entitySlug),
        );
        setResults(items);
        setStatus(items.length ? "ready" : "empty");
        setFoundNames((previous) => ({
          ...previous,
          ...Object.fromEntries(
            items.map((item) => [item.entitySlug, item.entityName]),
          ),
        }));
      } catch {
        if (!controller.signal.aborted) setStatus("error");
      }
    }, 180);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, retry]);
  const name = (slug: string, fallback?: string) =>
    names[slug] ?? foundNames[slug] ?? fallback ?? slug;
  function add(result: Result) {
    if (selected.includes(result.entitySlug) || selected.length >= 4) return;
    onToggle(result.entitySlug);
    setQuery("");
    setActive(-1);
    input.current?.focus();
  }
  return (
    <div className="policy-v6-searchPicker">
      <div className="policy-v6-selectedHeading">
        <span>{ui.selected}</span>
        <small>{selected.length}/4</small>
      </div>
      <div
        className="policy-v6-selectedSchools"
        role="group"
        aria-label={ui.selected}
      >
        {selected.map((slug) => (
          <span key={slug}>
            <UniversityMark slug={slug} size="chip" />
            <span>{name(slug)}</span>
            <button
              aria-label={`${ui.remove}: ${name(slug)}`}
              onClick={() => onToggle(slug)}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <label htmlFor={`${listId}-input`}>{ui.search}</label>
      <div className="policy-v6-searchField">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          aria-hidden="true"
        >
          <circle cx="10.8" cy="10.8" r="7" />
          <path d="m16 16 5 5" />
        </svg>
        <input
          ref={input}
          id={`${listId}-input`}
          role="combobox"
          aria-autocomplete="list"
          aria-controls={listId}
          aria-expanded={query.trim().length >= 2}
          aria-activedescendant={
            active >= 0 ? `${listId}-${active}` : undefined
          }
          placeholder={ui.placeholder}
          value={query}
          autoComplete="off"
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" && results.length) {
              event.preventDefault();
              setActive((index) => (index + 1) % results.length);
            }
            if (event.key === "ArrowUp" && results.length) {
              event.preventDefault();
              setActive((index) =>
                index < 0
                  ? results.length - 1
                  : (index - 1 + results.length) % results.length,
              );
            }
            if (event.key === "Enter" && active >= 0 && results[active]) {
              event.preventDefault();
              add(results[active]);
            }
            if (event.key === "Escape" && query) {
              event.preventDefault();
              event.stopPropagation();
              setQuery("");
            }
          }}
        />
        {query ? (
          <button
            aria-label={ui.remove}
            onClick={() => {
              setQuery("");
              input.current?.focus();
            }}
          >
            ×
          </button>
        ) : null}
      </div>
      {query.trim().length >= 2 ? (
        <div
          className="policy-v6-searchResults"
          id={listId}
          role="listbox"
          aria-label={ui.search}
          aria-busy={status === "loading"}
        >
          {results.map((result, index) => (
            <button
              type="button"
              key={result.entitySlug}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={selected.includes(result.entitySlug)}
              data-active={active === index}
              disabled={
                selected.includes(result.entitySlug) || selected.length >= 4
              }
              onClick={() => add(result)}
            >
              <UniversityMark slug={result.entitySlug} />
              <span>{name(result.entitySlug, result.entityName)}</span>
              <small>
                {selected.includes(result.entitySlug)
                  ? ui.added
                  : `+ ${ui.add}`}
              </small>
            </button>
          ))}
          {status !== "ready" ? (
            <p role="status">
              {status === "loading"
                ? ui.searching
                : status === "empty"
                  ? ui.empty
                  : ui.error}{" "}
              {status === "error" ? (
                <button onClick={() => setRetry((value) => value + 1)}>
                  {ui.retry}
                </button>
              ) : null}
            </p>
          ) : null}
        </div>
      ) : null}
      {selected.length >= 4 ? (
        <p role="status" className="policy-v6-muted">
          {ui.limit}
        </p>
      ) : null}
    </div>
  );
}
