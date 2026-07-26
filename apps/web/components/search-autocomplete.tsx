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
import { MetaLabel } from "@/components/meta-label";
import { StateLabel } from "@/components/state-label";
import { trackResearchEvent } from "@/lib/analytics-client";
import { getQueryAnalytics } from "@/lib/analytics-events";
import { getLocaleFromPathname, localizeHref } from "@/lib/i18n";
import { getLocalizedInstitutionName } from "@/lib/institution-localization";
import { localizeMatchReason } from "@/lib/match-reason-labels";

const autocompleteCopy = {
  en: { loading: "Loading suggestions...", empty: "No public records match this query.", error: "Suggestions are unavailable. Submit the search instead.", match: "Match", score: "Score", claims: "Claims", sources: "Sources", resultsReady: (count: number) => `${count} suggestions available. Use the up and down arrow keys to browse.` },
  zh: { loading: "正在加载建议…", empty: "没有公开记录匹配此查询。", error: "暂时无法提供建议，请直接提交搜索。", match: "匹配", score: "得分", claims: "声明", sources: "来源", resultsReady: (count: number) => `有 ${count} 条建议。使用上下方向键浏览。` },
  fr: { loading: "Chargement des suggestions…", empty: "Aucun enregistrement public ne correspond à cette requête.", error: "Les suggestions sont indisponibles. Lancez plutôt la recherche.", match: "Correspondance", score: "Score", claims: "Affirmations", sources: "Sources", resultsReady: (count: number) => `${count} suggestions disponibles. Utilisez les flèches haut et bas pour parcourir.` },
  pl: { loading: "Wczytywanie sugestii…", empty: "Brak publicznych rekordów pasujących do zapytania.", error: "Sugestie są niedostępne. Zamiast tego uruchom wyszukiwanie.", match: "Dopasowanie", score: "Wynik", claims: "Twierdzenia", sources: "Źródła", resultsReady: (count: number) => `Dostępne sugestie: ${count}. Użyj klawiszy strzałek w górę i w dół, aby przeglądać.` },
  es: { loading: "Cargando sugerencias…", empty: "Ningún registro público coincide con esta consulta.", error: "Las sugerencias no están disponibles. Envía la búsqueda directamente.", match: "Coincidencia", score: "Puntuación", claims: "Afirmaciones", sources: "Fuentes", resultsReady: (count: number) => `${count} sugerencias disponibles. Usa las teclas de flecha arriba y abajo para navegar.` },
  nl: { loading: "Suggesties laden…", empty: "Er komen geen openbare records overeen met deze zoekopdracht.", error: "Suggesties zijn niet beschikbaar. Voer de zoekopdracht rechtstreeks uit.", match: "Overeenkomst", score: "Score", claims: "Claims", sources: "Bronnen", resultsReady: (count: number) => `${count} suggesties beschikbaar. Gebruik de pijltjestoetsen omhoog en omlaag om te bladeren.` },
  ms: { loading: "Memuatkan cadangan…", empty: "Tiada rekod awam sepadan dengan pertanyaan ini.", error: "Cadangan tidak tersedia. Hantar carian secara terus.", match: "Padanan", score: "Skor", claims: "Tuntutan", sources: "Sumber", resultsReady: (count: number) => `${count} cadangan tersedia. Gunakan kekunci anak panah atas dan bawah untuk melihat.` }
} as const;

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
  const copy = autocompleteCopy[locale];
  const trimmedQuery = query.trim();
  const queryAnalytics = getQueryAnalytics(trimmedQuery);
  const queryKind = String(queryAnalytics.query_kind ?? "");
  const queryLengthBucket = String(queryAnalytics.query_length_bucket ?? "");
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

        // A newer query may have aborted this request while json() resolved.
        if (controller.signal.aborted) return;

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
    if (status === "loading") return copy.loading;
    if (status === "empty") return copy.empty;
    if (status === "error") return copy.error;
    return "";
  }, [copy, status]);

  function openResult(result: SuggestionResult, rank: number) {
    trackResearchEvent("autocomplete_keyboard_open", {
      entity_slug: result.entitySlug,
      locale,
      page_type: "search",
      result_rank: rank,
      ...queryAnalytics
    });
    window.location.assign(
      localizeHref(`/universities/${result.entitySlug}`, locale)
    );
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setActiveIndex(-1);
      setResults([]);
      setStatus("idle");
      return;
    }

    if (!results.length) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % results.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) =>
        current <= 0 ? results.length - 1 : current - 1
      );
    } else if (event.key === "Enter" && activeResult) {
      event.preventDefault();
      openResult(activeResult, activeIndex + 1);
    }
  }

  const isPanelOpen = status === "ready" || panelMessage !== "";
  const announcement =
    status === "ready" ? copy.resultsReady(results.length) : panelMessage;

  return (
    <div className="search-autocomplete">
      <input
        aria-activedescendant={
          activeResult ? `${listboxId}-${activeResult.entitySlug}` : undefined
        }
        aria-autocomplete="list"
        aria-controls={listboxId}
        aria-expanded={isPanelOpen}
        autoComplete="off"
        id={id}
        name={name}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        role="combobox"
        type="search"
        value={query}
      />
      <span className="visually-hidden" role="status">
        {announcement}
      </span>
      {isPanelOpen ? (
        <div className="search-autocomplete__panel">
          {panelMessage ? (
            <p className="search-autocomplete__status">{panelMessage}</p>
          ) : null}
          <div id={listboxId} role="listbox">
            {results.map((result, index) => (
              // Options carry a single action (open the record) to satisfy the
              // combobox contract; keyboard users activate them with Enter via
              // aria-activedescendant, so the option itself is not focusable.
              <div
                aria-selected={activeIndex === index}
                className="search-autocomplete__option"
                data-analytics-entity-slug={result.entitySlug}
                data-analytics-event="autocomplete_result_click"
                data-analytics-query-kind={queryKind}
                data-analytics-query-length-bucket={queryLengthBucket}
                data-analytics-result-rank={index + 1}
                id={`${listboxId}-${result.entitySlug}`}
                key={result.entitySlug}
                onClick={() => openResult(result, index + 1)}
                role="option"
              >
                <div className="search-autocomplete__option-main">
                  <span className="search-autocomplete__option-title">
                    {getLocalizedInstitutionName(
                      result.entitySlug,
                      result.entityName,
                      locale
                    )}
                  </span>
                  <p>{result.sourceBackedSnippet}</p>
                  <div className="table-record-meta">
                    <StateLabel locale={locale} reviewState={result.reviewState} />
                    <MetaLabel label={copy.match}>
                      {localizeMatchReason(result.matchReason, locale)}
                    </MetaLabel>
                    <MetaLabel label={copy.score}>{result.score}</MetaLabel>
                  </div>
                </div>
                <div className="search-autocomplete__option-actions">
                  <MetaLabel label={copy.claims}>{result.claimCount}</MetaLabel>
                  <MetaLabel label={copy.sources}>{result.sourceCount}</MetaLabel>
                  {/* Mouse-only shortcut: nested interactive content is not
                      allowed inside an option, so it is hidden from AT and
                      removed from the tab order. */}
                  <a
                    aria-hidden="true"
                    data-analytics-entity-slug={result.entitySlug}
                    data-analytics-event="autocomplete_json_click"
                    data-analytics-query-kind={queryKind}
                    data-analytics-query-length-bucket={queryLengthBucket}
                    data-analytics-result-rank={index + 1}
                    href={result.publicJsonUrl}
                    onClick={(event) => event.stopPropagation()}
                    tabIndex={-1}
                  >
                    JSON
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
