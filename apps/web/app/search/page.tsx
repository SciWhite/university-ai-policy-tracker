import { PUBLIC_API_VERSION } from "@uapt/shared";
import { DataList, DataListRow } from "@/components/data-list";
import { DocumentLink as Link } from "@/components/document-link";
import { JsonLd } from "@/components/json-ld";
import { MetaLabel } from "@/components/meta-label";
import { ReferenceBox } from "@/components/reference-box";
import { SearchAutocomplete } from "@/components/search-autocomplete";
import { StateLabel } from "@/components/state-label";
import {
  getEntityResolutionRecords,
  getSearchIndexRecords,
  searchIndexRecords,
  type SearchIndexRecord
} from "@/lib/entity-search";
import { getAbsoluteSiteUrl } from "@/lib/site-url";
import { getLocalizedAlternates } from "@/lib/i18n-metadata";
import { localizeHref, normalizeLocale, type SupportedLocale } from "@/lib/i18n";

const searchCopy: Record<
  SupportedLocale,
  {
    alias: string;
    aliases: string;
    apiBoxDescription: string;
    apiBoxTitle: string;
    button: string;
    description: string;
    empty: string;
    entities: string;
    highSignal: string;
    kicker: string;
    matches: string;
    note: string;
    placeholder: string;
    record: string;
    reset: string;
    resultsFor: (query: string) => string;
    searchApi: string;
    searchJson: string;
    searchLabel: string;
    sourceNote: string;
    suggestedRecords: string;
    title: string;
  }
> = {
  en: {
    alias: "Alias",
    aliases: "aliases",
    apiBoxDescription: "Read-only public search contracts.",
    apiBoxTitle: "Search APIs",
    button: "Search",
    description:
      "Search public university AI policy records by university name, alias, source domain, claim text, and analysis dimension.",
    empty:
      "No public records match this query. The current public release may still lack a promoted record for that institution or topic.",
    entities: "entities",
    highSignal: "High-signal records",
    kicker: "Search",
    matches: "matches",
    note:
      "Search is a routing aid over promoted public records, not a policy conclusion. Open the record page, public JSON, and source evidence before reuse.",
    placeholder: "University, topic, source domain...",
    record: "Record",
    reset: "Reset",
    resultsFor: (query) => `Results for "${query}"`,
    searchApi: "search API",
    searchJson: "Search JSON",
    searchLabel: "Search public records",
    sourceNote:
      "Search names, aliases, source domains, policy themes, AI tools, and public claim summaries. Results route to canonical records and JSON.",
    suggestedRecords: "suggested records",
    title: "Find source-backed university AI policy records"
  },
  zh: {
    alias: "别名",
    aliases: "别名",
    apiBoxDescription: "只读公共搜索接口。",
    apiBoxTitle: "搜索 API",
    button: "搜索",
    description: "按高校名称、别名、来源域名、声明文本和分析维度搜索公共高校 AI 政策记录。",
    empty: "没有公共记录匹配此查询。当前公共发布可能还没有推广该机构或主题的记录。",
    entities: "实体",
    highSignal: "高信号记录",
    kicker: "搜索",
    matches: "匹配",
    note: "搜索只是公共记录的路由辅助，不是政策结论。复用前请打开记录页、公共 JSON 和来源证据。",
    placeholder: "高校、主题、来源域名...",
    record: "记录",
    reset: "重置",
    resultsFor: (query) => `"${query}" 的结果`,
    searchApi: "搜索 API",
    searchJson: "搜索 JSON",
    searchLabel: "搜索公共记录",
    sourceNote: "搜索名称、别名、来源域名、政策主题、AI 工具和公共声明摘要。结果会指向规范记录和 JSON。",
    suggestedRecords: "建议记录",
    title: "查找有来源证据支撑的高校 AI 政策记录"
  },
  fr: {
    alias: "Alias",
    aliases: "alias",
    apiBoxDescription: "Contrats de recherche publics en lecture seule.",
    apiBoxTitle: "API de recherche",
    button: "Rechercher",
    description:
      "Rechercher les politiques IA universitaires publiques par nom, alias, domaine source, texte de revendication et dimension d'analyse.",
    empty:
      "Aucun dossier public ne correspond a cette requete. La version publique actuelle peut ne pas encore contenir de dossier promu pour cet etablissement ou ce sujet.",
    entities: "entites",
    highSignal: "Dossiers a fort signal",
    kicker: "Recherche",
    matches: "resultats",
    note:
      "La recherche sert a orienter vers les dossiers publics promus; elle n'est pas une conclusion de politique. Ouvrez la page du dossier, le JSON public et les preuves sources avant reutilisation.",
    placeholder: "Universite, sujet, domaine source...",
    record: "Dossier",
    reset: "Reinitialiser",
    resultsFor: (query) => `Resultats pour \"${query}\"`,
    searchApi: "API de recherche",
    searchJson: "JSON de recherche",
    searchLabel: "Rechercher les dossiers publics",
    sourceNote:
      "Recherchez noms, alias, domaines sources, themes de politique, outils IA et resumes de revendications publiques. Les resultats menent aux dossiers canoniques et au JSON.",
    suggestedRecords: "dossiers suggeres",
    title: "Trouver des dossiers de politiques IA universitaires appuyes par des sources"
  },
  pl: {
    alias: "Alias",
    aliases: "aliasy",
    apiBoxDescription: "Publiczne kontrakty wyszukiwania tylko do odczytu.",
    apiBoxTitle: "API wyszukiwania",
    button: "Szukaj",
    description: "Szukaj publicznych rekordow polityk AI wedlug uczelni, aliasu, domeny zrodla, tekstu roszczenia i wymiaru analizy.",
    empty: "Brak publicznych rekordow pasujacych do zapytania.",
    entities: "jednostki",
    highSignal: "Rekordy o wysokim sygnale",
    kicker: "Szukaj",
    matches: "wyniki",
    note: "Wyszukiwanie pomaga kierowac do publicznych rekordow; nie jest konkluzja polityki.",
    placeholder: "Uczelnia, temat, domena zrodla...",
    record: "Rekord",
    reset: "Reset",
    resultsFor: (query) => `Wyniki dla \"${query}\"`,
    searchApi: "API wyszukiwania",
    searchJson: "JSON wyszukiwania",
    searchLabel: "Szukaj publicznych rekordow",
    sourceNote: "Szukaj nazw, aliasow, domen zrodel, tematow polityk, narzedzi AI i publicznych streszczen.",
    suggestedRecords: "sugerowane rekordy",
    title: "Znajdz rekordy polityk AI uczelni oparte na zrodlach"
  },
  es: {
    alias: "Alias",
    aliases: "alias",
    apiBoxDescription: "Contratos publicos de busqueda de solo lectura.",
    apiBoxTitle: "API de busqueda",
    button: "Buscar",
    description: "Busca registros publicos de politicas universitarias de IA por universidad, alias, dominio fuente, texto y dimension de analisis.",
    empty: "No hay registros publicos que coincidan con esta busqueda.",
    entities: "entidades",
    highSignal: "Registros destacados",
    kicker: "Buscar",
    matches: "coincidencias",
    note: "La busqueda ayuda a navegar registros publicos; no es una conclusion de politica.",
    placeholder: "Universidad, tema, dominio fuente...",
    record: "Registro",
    reset: "Restablecer",
    resultsFor: (query) => `Resultados para \"${query}\"`,
    searchApi: "API de busqueda",
    searchJson: "JSON de busqueda",
    searchLabel: "Buscar registros publicos",
    sourceNote: "Busca nombres, alias, dominios fuente, temas de politica, herramientas de IA y resumenes publicos.",
    suggestedRecords: "registros sugeridos",
    title: "Encuentra registros universitarios de politicas de IA respaldados por fuentes"
  },
  nl: {
    alias: "Alias",
    aliases: "aliassen",
    apiBoxDescription: "Alleen-lezen publieke zoekcontracten.",
    apiBoxTitle: "Zoek-API's",
    button: "Zoeken",
    description: "Zoek publieke AI-beleidsrecords op universiteitsnaam, alias, brondomein, claimtekst en analysedimensie.",
    empty: "Geen publieke records komen overeen met deze zoekopdracht.",
    entities: "entiteiten",
    highSignal: "Sterke records",
    kicker: "Zoeken",
    matches: "matches",
    note: "Zoeken helpt navigeren naar publieke records; het is geen beleidsconclusie.",
    placeholder: "Universiteit, onderwerp, brondomein...",
    record: "Record",
    reset: "Reset",
    resultsFor: (query) => `Resultaten voor \"${query}\"`,
    searchApi: "zoek-API",
    searchJson: "Zoek-JSON",
    searchLabel: "Zoek publieke records",
    sourceNote: "Zoek namen, aliassen, brondomeinen, beleidsthema's, AI-tools en publieke samenvattingen.",
    suggestedRecords: "voorgestelde records",
    title: "Vind brononderbouwde AI-beleidsrecords van universiteiten"
  },
  ms: {
    alias: "Alias",
    aliases: "alias",
    apiBoxDescription: "Kontrak carian awam baca sahaja.",
    apiBoxTitle: "API carian",
    button: "Cari",
    description: "Cari rekod dasar AI universiti awam mengikut nama universiti, alias, domain sumber, teks tuntutan dan dimensi analisis.",
    empty: "Tiada rekod awam sepadan dengan carian ini.",
    entities: "entiti",
    highSignal: "Rekod isyarat tinggi",
    kicker: "Cari",
    matches: "padanan",
    note: "Carian membantu laluan ke rekod awam; ia bukan kesimpulan dasar.",
    placeholder: "Universiti, topik, domain sumber...",
    record: "Rekod",
    reset: "Tetap semula",
    resultsFor: (query) => `Hasil untuk \"${query}\"`,
    searchApi: "API carian",
    searchJson: "JSON carian",
    searchLabel: "Cari rekod awam",
    sourceNote: "Cari nama, alias, domain sumber, tema dasar, alat AI dan ringkasan awam.",
    suggestedRecords: "rekod cadangan",
    title: "Cari rekod dasar AI universiti yang disokong sumber"
  }
};

const exampleQueries = ["MIT", "privacy", "disclosure", "Copilot", "harvard.edu"] as const;

interface SearchPageProps {
  params?: Promise<{
    locale?: string;
  }>;
  searchParams: Promise<{
    q?: string;
  }>;
}

export async function generateMetadata({
  params
}: Pick<SearchPageProps, "params"> = {}) {
  const locale = normalizeLocale((await params)?.locale);
  const copy = searchCopy[locale];
  const alternates = getLocalizedAlternates("/search", locale);
  const canonical = String(alternates.canonical);

  return {
    title: `${copy.kicker} | University AI Policy Tracker`,
    description: copy.description,
    alternates,
    openGraph: {
      title: copy.title,
      description: copy.description,
      url: canonical,
      type: "website"
    }
  };
}

export default async function SearchPage({ params, searchParams }: SearchPageProps) {
  const locale = normalizeLocale((await params)?.locale);
  const copy = searchCopy[locale];
  const resolvedSearchParams = await searchParams;
  const query =
    typeof resolvedSearchParams.q === "string"
      ? resolvedSearchParams.q.trim()
      : "";
  const searchPath = localizeHref("/search", locale);
  const [searchIndex, entityIndex] = await Promise.all([
    fetchSearchIndexRecords(),
    fetchEntityIndexSummary()
  ]);
  const results = searchIndexRecords(searchIndex, query, { limit: 30 });
  const suggestedRecords = [...searchIndex]
    .sort(
      (left, right) =>
        right.claimCount - left.claimCount ||
        right.sourceCount - left.sourceCount ||
        left.entityName.localeCompare(right.entityName)
    )
    .slice(0, 8);

  return (
    <main className="page-shell page-shell--wide">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "SearchResultsPage",
          name: copy.title,
          description: copy.description,
          url: getAbsoluteSiteUrl(
            query ? `/search?q=${encodeURIComponent(query)}` : "/search"
          ),
          isPartOf: {
            "@type": "WebSite",
            name: "University AI Policy Tracker",
            url: getAbsoluteSiteUrl("/")
          }
        }}
      />
      <section className="search-page-header" aria-labelledby="search-title">
        <div>
          <p className="kicker">{copy.kicker}</p>
          <h1 id="search-title">{copy.title}</h1>
          <p className="compact-note">{copy.sourceNote}</p>
        </div>
        <form action={searchPath} className="home-search-form" method="get">
          <label className="visually-hidden" htmlFor="search-page-input">
            {copy.searchLabel}
          </label>
          <SearchAutocomplete
            defaultValue={query}
            id="search-page-input"
            name="q"
            placeholder={copy.placeholder}
          />
          <button type="submit">{copy.button}</button>
        </form>
      </section>

      <div className="quick-query-row" aria-label={copy.searchLabel}>
        {exampleQueries.map((example) => (
          <Link href={`/search?q=${encodeURIComponent(example)}`} key={example}>
            {example}
          </Link>
        ))}
      </div>

      <section className="metrics-grid metrics-grid--compact" aria-label="Search coverage">
        <div>
          <span>{entityIndex.count}</span>
          <p>{copy.entities}</p>
        </div>
        <div>
          <span>{entityIndex.aliasCount}</span>
          <p>{copy.aliases}</p>
        </div>
        <div>
          <span>{query ? results.length : suggestedRecords.length}</span>
          <p>{query ? copy.matches : copy.suggestedRecords}</p>
        </div>
        <div>
          <span>v1</span>
          <p>{copy.searchApi}</p>
        </div>
      </section>

      <p className="compact-note">{copy.note}</p>

      <section className="section compact-section">
        <div className="section-heading">
          <h2>{query ? copy.resultsFor(query) : copy.highSignal}</h2>
          {query ? <Link href="/search">{copy.reset}</Link> : null}
        </div>

        {query ? (
          results.length ? (
            <SearchResults copy={copy} results={results} />
          ) : (
            <p className="notice-card">{copy.empty}</p>
          )
        ) : (
          <DataList>
            {suggestedRecords.map((record) => (
              <DataListRow
                actions={
                  <>
                    <Link href={`/universities/${record.entitySlug}`}>
                      {copy.record}
                    </Link>
                    <a href={record.publicJsonUrl}>JSON</a>
                  </>
                }
                key={record.entitySlug}
                metadata={
                  <>
                    <StateLabel reviewState={record.reviewState} />
                    <MetaLabel label="Claims">{record.claimCount}</MetaLabel>
                    <MetaLabel label="Sources">{record.sourceCount}</MetaLabel>
                  </>
                }
              >
                <div className="table-record-title">
                  <Link href={`/universities/${record.entitySlug}`}>
                    {record.entityName}
                  </Link>
                </div>
                <p>{record.fields.summary ?? "Open the public record."}</p>
              </DataListRow>
            ))}
          </DataList>
        )}
      </section>

      <ReferenceBox
        className="compact-reference-box"
        description={copy.apiBoxDescription}
        title={copy.apiBoxTitle}
      >
        <ul className="compact-link-list">
          <li>
            <a href={`/api/public/${PUBLIC_API_VERSION}/search.json?q=mit`}>
              {copy.searchJson}
            </a>
          </li>
          <li>
            <a href={`/api/public/${PUBLIC_API_VERSION}/search/index.json`}>
              Search index
            </a>
          </li>
          <li>
            <a href={`/api/public/${PUBLIC_API_VERSION}/entities/index.json`}>
              Entity aliases
            </a>
          </li>
        </ul>
      </ReferenceBox>
    </main>
  );
}

type SearchResult = ReturnType<typeof searchIndexRecords>[number];

async function fetchSearchIndexRecords(): Promise<SearchIndexRecord[]> {
  const payload = await fetchPublicJson<{
    data?: {
      records?: SearchIndexRecord[];
    };
  }>(`/api/public/${PUBLIC_API_VERSION}/search/index.json`);

  if (Array.isArray(payload?.data?.records)) return payload.data.records;

  return getSearchIndexRecords();
}

async function fetchEntityIndexSummary(): Promise<{
  aliasCount: number;
  count: number;
}> {
  const payload = await fetchPublicJson<{
    data?: {
      aliasCount?: number;
      count?: number;
    };
  }>(`/api/public/${PUBLIC_API_VERSION}/entities/index.json`);

  if (payload?.data) {
    return {
      aliasCount: Number(payload.data.aliasCount ?? 0),
      count: Number(payload.data.count ?? 0)
    };
  }

  const records = await getEntityResolutionRecords();

  return {
    aliasCount: records.reduce((total, record) => total + record.aliasCount, 0),
    count: records.length
  };
}

async function fetchPublicJson<T>(pathname: string): Promise<T | undefined> {
  try {
    const response = await fetch(getAbsoluteSiteUrl(pathname), {
      cache: "no-store"
    });

    if (!response.ok) return undefined;

    return (await response.json()) as T;
  } catch {
    return undefined;
  }
}

function SearchResults({
  copy,
  results
}: {
  copy: (typeof searchCopy)[SupportedLocale];
  results: SearchResult[];
}) {
  return (
    <DataList>
      {results.map((result) => (
        <DataListRow
          actions={
            <>
              <Link href={`/universities/${result.entitySlug}`}>
                {copy.record}
              </Link>
              <a href={result.publicJsonUrl}>JSON</a>
            </>
          }
          key={result.entitySlug}
          metadata={
            <>
              <StateLabel reviewState={result.reviewState} />
              <MetaLabel label="Score">{result.score}</MetaLabel>
              <MetaLabel label="Claims">{result.claimCount}</MetaLabel>
              <MetaLabel label="Sources">{result.sourceCount}</MetaLabel>
            </>
          }
        >
          <div className="table-record-title">
            <Link href={`/universities/${result.entitySlug}`}>
              {result.entityName}
            </Link>
          </div>
          <p>{result.sourceBackedSnippet}</p>
          <div className="table-record-meta">
            <MetaLabel label="Match">{result.matchReason}</MetaLabel>
            {result.confidence !== undefined ? (
              <MetaLabel label="Confidence">
                {Math.round(result.confidence * 100)}%
              </MetaLabel>
            ) : null}
          </div>
          {result.matchedAliases.length ? (
            <p className="table-record-subtitle">
              {copy.alias}: {result.matchedAliases.join(", ")}
            </p>
          ) : null}
        </DataListRow>
      ))}
    </DataList>
  );
}
