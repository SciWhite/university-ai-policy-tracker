import type { SupportedLocale } from "@/lib/i18n";
import zhTranslations from "@/messages/pages/zh.json";
import frTranslations from "@/messages/pages/fr.json";
import plTranslations from "@/messages/pages/pl.json";
import esTranslations from "@/messages/pages/es.json";
import nlTranslations from "@/messages/pages/nl.json";
import msTranslations from "@/messages/pages/ms.json";

const en = {
  home: {
    metadataTitle: (count: string) =>
      `University AI Policy Database: Search ${count} Source-Backed GenAI Policies`,
    description:
      "Search and cite source-backed university GenAI policy records with official sources, review states, public JSON, and citation-ready evidence.",
    kicker: "University AI policy database",
    lead:
      "Find, cite, and retrieve source-backed university GenAI policy records. Search by institution, source domain, AI tool, policy theme, or public evidence phrase.",
    searchLabel: "Search public university AI policy records",
    searchPlaceholder: "Search universities, topics, source domains...",
    searchButton: "Search",
    suggestedSearches: "Suggested searches",
    note:
      "Search is a routing aid over promoted public records, not a policy conclusion. Open the record and public JSON before citation.",
    publicJson: "Public JSON",
    searchApi: "Search API",
    license: "License",
    universityRecords: "university records",
    sourceBackedClaims: "source-backed claims",
    officialSourceAttributions: "official source attributions",
    analysisProfiles: "analysis profiles",
    answersLabel: "Database answer blocks",
    entryGroupsLabel: "Secondary entrances",
    matchingRecords: "Matching records",
    openSearch: "Open search",
    record: "Record",
    claims: "Claims",
    sources: "Sources",
    recentChecks: "Recent checks",
    viewChanges: "View changes",
    noPublicFreshnessDate: "No public freshness date",
    agentRetrievalTitle: "Agent and citation retrieval",
    agentRetrievalLead: "Use canonical pages and versioned public JSON together.",
    aiSystemsTitle: "For AI/search systems",
    aiSystemsText:
      "Resolve an entity with search, open the canonical university record, then cite claim evidence and public JSON fields without replacing official university source language.",
    aiSearchReference: "AI/search reference",
    researchersTitle: "For researchers and journalists",
    researchersText:
      "Treat tracker metadata as a citation layer. Official source pages, PDFs, and policy documents keep their own rights and remain the final source for institutional wording.",
    citationGuide: "Citation guide",
    methodology: "Methodology",
    developersTitle: "For developers",
    developersText:
      "Public endpoints expose read-only records, search, entities, datasets, recent changes, analysis profiles, and citation metadata under the versioned API namespace.",
    apiDocs: "API docs",
    apiIndex: "API index",
    changed: "Changed",
    checked: "Checked",
    homeAnswers: [
      {
        title: "What this database is",
        text:
          "A public, source-backed index of university GenAI policy records with canonical pages, review state, source URLs, evidence snippets, and public JSON."
      },
      {
        title: "What this database is not",
        text:
          "It is not legal advice, academic integrity advice, or an official university statement. Official university source pages remain canonical."
      },
      {
        title: "How to cite records",
        text:
          "Cite the visible record page and matching public JSON together, then preserve source URL, review state, confidence, last checked date, and original-language evidence."
      }
    ],
    entryGroups: [
      {
        title: "Start",
        links: [
          { label: "Search records", href: "/search" },
          { label: "Universities", href: "/universities" },
          { label: "AI Policy Database", href: "/university-ai-policy-database" }
        ]
      },
      {
        title: "Data and API",
        links: [
          { label: "Datasets", href: "/datasets" },
          { label: "API", href: "/api-reference" },
          { label: "MCP", href: "/mcp" },
          { label: "Widgets", href: "/widgets" }
        ]
      },
      {
        title: "Updates",
        links: [
          { label: "Changes", href: "/changes" },
          { label: "Reports", href: "/reports" },
          { label: "Feeds", href: "/feeds/atom.xml" }
        ]
      },
      {
        title: "Coverage and review",
        links: [
          { label: "Coverage", href: "/coverage" },
          { label: "Source health", href: "/source-health" },
          { label: "Review", href: "/review" },
          { label: "Queue", href: "/review/queue" }
        ]
      },
      {
        title: "Trust and citation",
        links: [
          { label: "Methodology", href: "/methodology" },
          { label: "Citation", href: "/citation" },
          { label: "llms.txt", href: "/llms.txt" },
          { label: "Contribute", href: "/contribute" }
        ]
      }
    ]
  },
  universities: {
    title: "University AI Policy Database: Source-Backed GenAI Records",
    description:
      "Browse university AI policy, ChatGPT, and GenAI rule records with official sources, review state, last checked dates, and public JSON links.",
    kicker: "Evidence records",
    heading: "Browse source-backed university AI policy records",
    lead:
      "Filter public records by institution, ranking coverage, claims, official sources, review state, and versioned public JSON.",
    coverageLabel: "University coverage",
    universityRecords: "university records",
    sourceBackedClaims: "source-backed claims",
    officialSourceAttributions: "official source attributions",
    rankedRecords: (ranking: string) => `${ranking} ranked records`,
    answersLabel: "University index answers",
    priorityTitle: "Priority university AI policy records",
    priorityLead:
      "High-impression records from Search Console, linked with their canonical policy pages, change history, official-source counts, and public JSON.",
    priorityReportsLink: "Monthly report",
    priorityChangeLink: "Change history",
    priorityRecordLink: "Policy record",
    indexTitle: "Index",
    indexLead:
      "Ranking filters are discovery aids; policy claims still come from official sources.",
    search: "Search",
    searchPlaceholder: "University, country, city",
    ranking: "Ranking",
    coverage: "Coverage",
    sort: "Sort",
    order: "Order",
    allRecords: "All records",
    rankedInSelectedSystem: "Ranked in selected system",
    missingSelectedRank: "Missing selected rank",
    selectedRanking: "Selected ranking",
    recentlyChecked: "Recently checked",
    universityName: "University name",
    claimCount: "Claim count",
    sourceCount: "Source count",
    ascending: "Ascending",
    descending: "Descending",
    apply: "Apply",
    reset: "Reset",
    showing: (visible: number, total: number) =>
      `Showing ${visible} of ${total} records.`,
    searchSummary: (query: string) => `Search: "${query}".`,
    rankingView: (ranking: string) => `Ranking view: ${ranking}.`,
    university: "University",
    rank: (ranking: string) => `${ranking} rank`,
    claims: "Claims",
    sources: "Sources",
    lastChecked: "Last checked",
    publicJson: "Public JSON",
    locationUnknown: "Location unknown",
    confidence: "Confidence",
    unknown: "Unknown",
    json: "JSON",
    noMatches:
      "No records match the current search and ranking coverage filters.",
    candidateNotice: (count: number) =>
      `${count} candidate or needs-review claim records remain visible for auditability. Review state is separate from confidence.`,
    notIndexed: "Not indexed",
    partialSource: "partial source",
    derivedOrder: "derived order",
    answerCards: [
      {
        title: "What this index covers",
        text:
          "Promoted public university records with source-backed claim counts, official source attributions, review state, and canonical record URLs."
      },
      {
        title: "How to use rankings",
        text:
          "Ranking filters support discovery and coverage analysis only; they do not create or override policy claims."
      },
      {
        title: "Reuse boundary",
        text:
          "The tracker is not legal advice, academic integrity advice, or an official university statement unless a linked source is the university's own official page."
      }
    ]
  },
  datasets: {
    title: "Datasets | University AI Policy Tracker",
    description:
      "Versioned public JSON endpoints, dataset concepts, licensing, source rights caveats, and citation expectations for University AI Policy Tracker.",
    kicker: "Datasets",
    heading: "Public JSON artifacts and release metadata",
    leadPrefix: "Versioned public JSON under",
    leadSuffix:
      "built from the same promoted release dataset as the visible pages.",
    coverageLabel: "Current dataset coverage",
    publicUniversityRecords: "public university records",
    sourceBackedClaims: "source-backed claims",
    officialSourceAttributions: "official source attributions",
    publicJsonSchemaVersion: "public JSON schema version",
    releaseDownloadArtifacts: "release download artifacts",
    analysisProfiles: "analysis profiles",
    answersLabel: "Dataset answer blocks",
    whatReusableTitle: "What can be reused",
    whatReusableText:
      "Tracker metadata, record URLs, review states, citation fields, and public JSON artifacts are reusable under the tracker metadata license.",
    externalTitle: "What remains external",
    externalText:
      "Official source documents, page text, PDFs, and university policy language retain their original rights and terms.",
    retrieveTitle: "How agents retrieve data",
    retrieveText:
      "Start with the API index, resolve entities with search, fetch the canonical university JSON, then cite claim evidence and source URLs.",
    versionedJsonTitle: "Versioned public JSON",
    versionedJsonDescription: "Live read-only artifacts grouped by use.",
    coreRecords: "Core records",
    searchAnalysis: "Search and analysis",
    reportsEmbeds: "Reports and embeds",
    reviewIntegrations: "Review and integrations",
    releaseDownloadsTitle: "Dataset release downloads",
    releaseDownloadsDescription: "Bulk files with row counts, sizes, and checksums.",
    release: "Release",
    period: "Period",
    published: "Published",
    rankingTitle: "Ranking and index boundaries",
    rankingDescription: "Discovery inputs, not policy conclusions.",
    githubTitle: "GitHub trust assets",
    githubDescription: "Repository-level trust assets.",
    manifestTitle: "Current release manifest",
    promotedRuns: "Promoted runs",
    manifestText:
      "The manifest controls which reviewed staged artifact directories are promoted into public pages and public JSON.",
    conceptsTitle: "Dataset concepts",
    conceptsLead: "What the v1 records expose today",
    licenseTitle: "License, rights, and citation",
    trackerMetadata: "tracker metadata",
    trackerMetadataTitle: "Tracker metadata",
    officialRightsTitle: "Official source rights",
    citationExpectationsTitle: "Citation expectations",
    citationExpectationsText:
      "Cite the canonical page and public JSON together. For claim-level reuse, retain source URL, source language, snapshot hash, review state, confidence, and the original evidence snippet.",
    citationRulesPrefix: "Citation rules are documented at",
    recentFreshnessPrefix: "Recent data freshness is visible at",
    apiGroups: {
      apiIndex: "Endpoint discovery and trust links.",
      universities: "University records with review state, dates, and JSON URLs.",
      perUniversity: "Example public university record.",
      claims: "Example claim/evidence rows.",
      recentChanges: "Checked and changed records.",
      manifest: "Release artifacts, row counts, sizes, and checksums.",
      searchJson: "Entity search over promoted public records.",
      searchIndex: "Safe search index; no raw snapshots or staging artifacts.",
      entityAliases: "Canonical aliases and retrieval hints.",
      analysisIndex: "Policy analysis dimension manifest.",
      analysisProfile: "Example per-university analysis profile.",
      coverageScores: "Coverage breadth scores, not policy quality.",
      analysisQuality: "Public analysis page gates.",
      reportsIndex: "Public report index.",
      outreach: "Media and newsletter copy with boundaries.",
      chartData: "June 2026 monthly report chart data.",
      widgetIndex: "Widget discovery.",
      policyCoverageWidget: "Example coverage widget.",
      sourceFreshnessWidget: "Example source freshness widget.",
      reviewStateWidget: "Example review-state widget.",
      qsCoverage: "QS 2026 collection coverage.",
      sourceHealth: "Source status for repair and recrawl planning.",
      reviewQueue: "Unpromoted staging run queue metadata.",
      mcpManifest: "Read-only MCP alpha manifest.",
      mcpToolCatalog: "Read-only MCP tool catalog.",
      citationMetadata: "Citation templates and reuse rules.",
      contributionIndex: "Contribution workflow metadata.",
      reviewPolicy: "Contribution review policy."
    },
    concepts: [
      {
        name: "Universities",
        status: "Available now",
        description:
          "Canonical university records are available as visible pages and per-university public JSON records."
      },
      {
        name: "Claims",
        status: "Available inside university JSON",
        description:
          "Claims include claim text, claim type, confidence, review state, dates, and evidence arrays."
      },
      {
        name: "Sources",
        status: "Available inside public records",
        description:
          "Official sources appear as source attributions and evidence source URLs with rights caveats."
      },
      {
        name: "Snapshots",
        status: "Hash metadata available now",
        description:
          "Public records expose source snapshot hashes. Raw HTML, PDFs, and screenshots are not published as tracker metadata."
      },
      {
        name: "Recent changes",
        status: "Available now",
        description:
          "The recent changes JSON feed summarizes checked and changed university records with review states."
      },
      {
        name: "Analysis profiles",
        status: "Available now",
        description:
          "Deterministic policy analysis profiles derive dimensions and coverage scores from existing public claim/evidence records."
      },
      {
        name: "Coverage dashboards",
        status: "Available now",
        description:
          "QS coverage, source-health, and review-queue metadata expose collection status and crawler/review work without publishing staging claims."
      },
      {
        name: "Entity resolution and search",
        status: "Available now",
        description:
          "Canonical entity aliases and safe search indexes improve recall without creating policy facts or exposing unpublished artifacts."
      }
    ]
  },
  methodology: {
    title: "Methodology | University AI Policy Tracker",
    description:
      "How University AI Policy Tracker discovers sources, snapshots pages, binds evidence, separates confidence from review state, and publishes citation-ready records.",
    kicker: "Methodology",
    heading: "How records become source-backed claims",
    lead:
      "Official sources, snapshots, short evidence snippets, confidence, and explicit review state.",
    answersLabel: "Methodology answer blocks",
    tocLabel: "Methodology sections",
    toc: {
      workflow: "Evidence workflow",
      reviewStates: "Review states",
      rankingBoundaries: "Ranking boundaries",
      publicationRules: "Publication rules",
      limitations: "Limitations"
    },
    workflowDescription: "From public source discovery to citation-ready records.",
    reviewDescription:
      "Review state is workflow status. Confidence is machine-assessed support.",
    rankingDescription:
      "Ranking rows help prioritize and filter source discovery. They are not policy claims.",
    publicationDescription: "What must exist before a claim is public.",
    limitationsDescription: "Known boundaries of the current evidence layer.",
    footer: "Use the citation guide for attribution rules, the datasets page for public JSON access, and recent changes for freshness signals.",
    links: {
      citationGuide: "citation guide",
      datasetsPage: "datasets page",
      recentChanges: "recent changes"
    },
    answers: [
      {
        title: "How records become public",
        text:
          "Records become public after source discovery, snapshot hashing, claim extraction, evidence binding, review-state labeling, and publication from the promoted public dataset."
      },
      {
        title: "What review state means",
        text:
          "Review state describes workflow status. Confidence is a separate machine-assessed support score and does not make a claim official."
      },
      {
        title: "What evidence is canonical",
        text:
          "Original-language evidence, source URLs, and official university pages remain canonical; translations or summaries are helper metadata."
      }
    ],
    workflowSteps: [
      {
        title: "Source discovery",
        description:
          "Public university policy pages, teaching guidance, IT/security pages, procurement pages, PDFs, and source-attributed materials."
      },
      {
        title: "Crawl and snapshot",
        description:
          "Fetched source text receives a content hash for future change checks."
      },
      {
        title: "Claim extraction",
        description: "Claims keep confidence separate from review state."
      },
      {
        title: "Evidence binding",
        description:
          "Every public claim needs a source URL, snapshot hash, evidence snippet, source language, and rights caveat."
      },
      {
        title: "Change detection",
        description:
          "Changed hashes can create new snapshots, candidates, claim updates, and change records."
      },
      {
        title: "Multilingual source-first evidence",
        description:
          "Original-language evidence is canonical; translations are display helpers."
      }
    ],
    reviewStates: [
      {
        label: "machine_candidate",
        description: "Produced by crawler, extractor, or seed process; not final."
      },
      {
        label: "needs_review",
        description: "Source, extraction, date, or classification needs review."
      },
      {
        label: "agent_reviewed",
        description: "Agent checked evidence and classification."
      },
      {
        label: "human_reviewed",
        description:
          "Human reviewer or deterministic publish rule approved the claim."
      },
      {
        label: "rejected",
        description: "Retained only for audit context."
      }
    ],
    rankingRules: [
      "QS 2026 currently remains the main crawl batching source for expanding public coverage.",
      "THE 2026, ARWU 2025, U.S. News 2025-2026, and CWTS Leiden 2025 are supported as ranking, index, and filter sources.",
      "CWTS Leiden 2025 is a derived metric order, not an overall global university rank.",
      "Different ranking years are not presented as one unified 2026 ranking.",
      "Ranking data does not create or override policy claims; visible claims still require official sources, evidence snippets, confidence, and review state."
    ],
    publicationRules: [
      "Every public claim needs a source URL and source snapshot hash.",
      "Evidence snippets stay short, necessary, and source-attributed.",
      "Original-language evidence is canonical; translation is display-only.",
      "Canonical facts and localized display must remain separate.",
      "Candidate claims must be labeled and must not be used as final summaries.",
      "Public pages and public JSON should be generated from the same promoted public release dataset.",
      "Official source documents retain their original rights and terms."
    ],
    limitations: [
      "University policies can be distributed across departments, courses, PDFs, and internal systems.",
      "Sparse records remain labeled as early coverage until reviewed evidence supports stronger conclusions.",
      "The tracker records source-check and claim-evidence metadata; it does not provide legal advice or academic integrity advice."
    ]
  },
  citation: {
    title: "Citation | University AI Policy Tracker",
    description:
      "Citation formats, source attribution rules, public JSON fields, rights caveats, and advice boundaries for University AI Policy Tracker.",
    kicker: "Citation",
    heading: "Cite tracker metadata and official sources separately",
    lead:
      "Keep the canonical page, public JSON, source URL, snapshot hash, review state, confidence, and original evidence together.",
    answersLabel: "Citation answer blocks",
    tocLabel: "Citation sections",
    toc: {
      formats: "Suggested formats",
      fields: "Citation fields",
      json: "Public JSON",
      ranking: "Ranking sources",
      rights: "Rights and boundaries"
    },
    formatsDescription: "Copy-ready examples.",
    universityPolicyRecord: "University policy record",
    datasetSurface: "Dataset surface",
    changesFeed: "Changes feed or report",
    fieldsDescription: "Retain these fields.",
    pageDataIdentity: "Page and data identity",
    freshnessReview: "Freshness and review",
    sourceEvidence: "Source evidence",
    jsonDescription: "Versioned records for reuse.",
    apiIndex: "API index",
    universitiesList: "Universities list",
    universityRecord: "University record",
    recentChanges: "Recent changes",
    rankingDescription: "Reference indexes, not policy rankings.",
    rightsDescription: "tracker metadata",
    browsePrefix: "Browse",
    readPrefix: "read the",
    reviewPrefix: "or review",
    universityRecords: "university records",
    methodology: "methodology",
    datasetAccess: "dataset access",
    answers: [
      {
        title: "How to cite a university record",
        text:
          "Cite the canonical visible record page and the matching public JSON URL together, then preserve source URL, review state, confidence, and last checked date."
      },
      {
        title: "How to cite claim evidence",
        text:
          "For claim-level reuse, include claim text, original-language evidence snippet, source language, source URL, snapshot hash, confidence, and review state."
      },
      {
        title: "What not to cite as official",
        text:
          "University AI Policy Tracker metadata is not an official university statement; cite linked official sources separately for institutional policy wording."
      }
    ],
    identityRules: [
      "Canonical URL for the visible public page.",
      "Versioned public JSON URL under the public API namespace.",
      "Public pages and public JSON should describe the same promoted public release record.",
      "Schema version."
    ],
    freshnessRules: [
      "Last checked date, when the source was most recently checked.",
      "Last changed date, when a tracked source or claim changed.",
      "Review state, which is separate from machine confidence."
    ],
    evidenceRules: [
      "Official or clearly labeled source URLs.",
      "Source snapshot hashes for change and citation traceability.",
      "Short original-language evidence snippets and source language."
    ],
    rankingRules: [
      "QS 2026 currently remains the main crawl batching source.",
      "THE 2026, ARWU 2025, U.S. News 2025-2026, and CWTS Leiden 2025 are supported as ranking, index, and filter sources.",
      "CWTS Leiden 2025 is a derived metric order, not an overall global university rank.",
      "Do not cite mixed ranking years as one unified 2026 ranking. Cite the tracker record and public JSON for policy evidence, and cite the relevant ranking source separately when ranking context matters."
    ]
  },
  analysis: {
    title: "Policy Analysis | University AI Policy Tracker",
    description:
      "Deterministic, evidence-backed university AI policy analysis profiles with source claim IDs, review states, coverage scores, and versioned public JSON.",
    kicker: "Policy analysis",
    heading: "Source-backed analysis profiles, not policy advice",
    lead:
      "Derived dimensions over public claim/evidence records. Each non-empty result keeps claim IDs, source URLs, source language, and evidence.",
    profiles: "Profiles",
    schema: "Schema",
    publicApi: "Public API",
    coverageLabel: "Policy analysis coverage",
    analysisProfiles: "analysis profiles",
    evidenceBackedDimensions: "evidence-backed dimensions",
    averageCoverageScore: "average public coverage score",
    sourceLanguagesPreserved: "source languages preserved",
    answersLabel: "Policy analysis answer blocks",
    summaryTitle: "Summary",
    summaryDescription: "For citation context.",
    scoreNotice:
      "Policy Coverage Score measures breadth of public, source-backed coverage. It is not a quality, strictness, legal adequacy, safety, or institutional compliance score.",
    tocLabel: "Analysis sections",
    toc: {
      meaning: "Boundary",
      dimensions: "Dimensions",
      coverage: "Coverage score",
      themes: "Theme analysis",
      quality: "Quality gates",
      review: "Review workflow",
      json: "Public JSON",
      citation: "Citation"
    },
    meaningDescription: "Derived metadata with source links.",
    dimensionsDescription: "All dimensions are visible and contract-backed.",
    coverageDescription: "The score is a coverage breadth measure only.",
    openCoverageTable: "Open coverage table",
    coverageText:
      "Coverage score components sum to 100 points across public evidence categories such as central guidance, academic integrity, disclosure, coursework, exams, privacy/data entry, approved tools, and teaching or research guidance.",
    coverageWarning:
      "The score should never be described as best policy, worst policy, most compliant, legally safe, or institutionally endorsed.",
    qualityDescription:
      "Publication gates keep analysis pages useful for search and AI answer engines without turning sparse data into thin pages.",
    pageQualityJson: "Page-quality JSON",
    qualityStatus: (status: string, count: number) =>
      `Current page-quality status: ${status}. The report covers ${count} public analysis pages and keeps review state separate from page publication readiness.`,
    reviewDescription:
      "Quality checks do not publish canonical analysis. They route questionable records into review.",
    openReviewWorkflow: "Open review workflow",
    queue: "Queue",
    publicMutation: "Public mutation",
    notAllowed: "Not allowed",
    reviewStates: "Review states",
    themesDescription:
      "Only themes with enough public evidence are linked from this index.",
    openAnalysis: "Open analysis",
    held: "Held until evidence threshold",
    jsonDescription: "Versioned read-only endpoints for downstream reuse.",
    citationDescription: "Use the canonical page and public JSON together.",
    suggestedCitation: "Suggested citation",
    answers: [
      {
        title: "What analysis means",
        text:
          "Analysis profiles are derived metadata over public claim/evidence records. They summarize policy dimensions without replacing source evidence."
      },
      {
        title: "What coverage score means",
        text:
          "Coverage score measures breadth of visible public evidence, not policy quality, safety, legality, strictness, or compliance."
      },
      {
        title: "How to cite analysis",
        text:
          "Cite the analysis JSON with the related university record, basis claim IDs, source URLs, review state, and original evidence."
      }
    ],
    boundaryRules: [
      "Dimensions summarize public tracker claims into consistent labels.",
      "Original-language evidence remains canonical.",
      "Confidence is separate from review state.",
      "not_mentioned means no matching public tracker evidence is present in the current profile.",
      "Open basis claim IDs and source URLs before reuse."
    ],
    evidenceBacked: "Evidence-backed",
    notMentioned: "Not mentioned",
    gate: "Gate",
    analysisIndex: "Analysis index",
    analysisIndexDescription:
      "Analysis endpoint manifest with dimension definitions and version metadata.",
    universityAnalysisProfile: "University analysis profile",
    universityAnalysisProfileDescription:
      "Example per-university analysis profile with dimensions, basis evidence, and coverage score.",
    coverageScores: "Coverage scores",
    coverageScoresDescription:
      "Coverage score list for public analysis profiles.",
    analysisPageQuality: "Analysis page quality",
    analysisPageQualityDescription:
      "Read-only report of page-quality gates, indexability status, analysis review workflow, and no-advice boundaries."
  },
  changes: {
    title: "Recent Changes | University AI Policy Tracker",
    description:
      "Searchable university policy change timelines with old/new claim comparisons, source freshness, review states, and versioned public JSON links.",
    kicker: "Changes",
    heading: "University policy change timelines",
    lead:
      "Search and compare public university AI policy change records by theme, review state, source health, and release history.",
    summaryLabel: "Change timeline summary",
    recordsWithDiffRows: "change records with diff rows",
    policyTextChanges: "comparable policy-text changes",
    newlyExtractedClaims: "newly extracted claims",
    privateSourceTextChanges: "private source text changes",
    answersLabel: "Change timeline answer blocks",
    artifactTitle: "Public changes artifact",
    artifactDescription: "Versioned timeline for records and agents.",
    recentChangesJson: "Recent changes JSON",
    recentChangesJsonDescription:
      "Recent changed or checked records with canonical URLs, review states, claim counts, and claim evidence where available.",
    latestDiffJson: "Latest release diff JSON",
    latestDiffJsonDescription:
      "Latest release-to-release tracker diff with semantic categories for policy text, extracted claims, evidence, and source snapshots.",
    indexJson: "Changes index JSON",
    indexJsonDescription:
      "Filter metadata and university-level timeline records for the /changes page.",
    filtersTitle: "Timeline filters",
    filtersLead:
      "Filter by university text, policy theme, review state, source health, or sort order.",
    searchLabel: "Search",
    searchPlaceholder: "University, claim text, theme, citation...",
    themeLabel: "Theme",
    reviewLabel: "Review state",
    sourceHealthLabel: "Source health",
    sortLabel: "Sort",
    applyFilters: "Apply filters",
    resetFilters: "Reset",
    allThemes: "All themes",
    allReviewStates: "All review states",
    allSourceHealth: "All source health",
    sortChanged: "Most recently changed",
    sortChecked: "Most recently checked",
    sortClaims: "Most claims",
    sortSources: "Most sources",
    firstSeen: "First seen",
    oldClaim: "Old claim",
    newClaim: "New claim",
    timelineTitle: "Change timeline",
    timelineLead: (current: string, previous: string | undefined, sources: number, records: number) =>
      `Latest release ${current}${previous ? ` compared with ${previous}` : " is the initial tracked release"}. ${sources} source attributions across ${records} records.`,
    changeDetail: "Change detail",
    universityPage: "University page",
    publicJson: "Public JSON",
    diff: "Diff",
    claims: "Claims",
    sources: "Sources",
    checked: "Checked",
    changed: "Changed",
    noPublicDate: "No public date yet",
    noChanges:
      "No claim/evidence changes are recorded for the latest public release. The versioned feed URL remains available for readers and agents.",
    boundaryTitle: "Boundary",
    boundaryLead: "Freshness signals only",
    answers: [
      {
        title: "What the timeline shows",
        text:
          "Each record combines the visible university page, public JSON, change history, and source freshness so search users can jump from a query to a citation-ready record."
      },
      {
        title: "How to read claims",
        text:
          "Old and new claims show the latest tracked policy comparison. A newly extracted claim or source snapshot change is a tracker event, not automatically a policy conclusion."
      },
      {
        title: "How to reuse it",
        text:
          "Use the page citation block plus the linked JSON endpoints. The theme, review, and source-health filters are discovery aids, not policy judgments."
      }
    ],
    summary: (name: string, claims: number, sources: number, changedDate: string | undefined, diffRows: number, policy: number, extracted: number, snapshot: number, sourceText: number) =>
      `${name} has ${claims} source-backed claim records and ${sources} official source attributions.${changedDate ? ` The latest tracked changed date is ${changedDate}.` : " No changed date has been published yet."}${diffRows ? ` Latest tracker diff: ${policy} comparable policy-text changes, ${extracted} newly extracted claims, ${snapshot} source snapshot changes, and ${sourceText} private source-text changes where private snapshots are available.` : " No claim/evidence changes are recorded for the latest release."}`
  },
  contribute: {
    title: "Contribute | University AI Policy Tracker",
    description:
      "Submit official university AI policy sources, corrections, course-level AI policy evidence, translation fixes, and dataset issues into a review-task workflow.",
    kicker: "Contribution intake",
    heading: "Submit evidence into a review queue",
    lead:
      "Contributions help expand coverage, but they do not create canonical policy facts directly. Every source URL, correction, translation fix, or course-level submission starts as a review task with privacy, copyright, source-language, and evidence checks.",
    pathsTitle: "Contribution paths",
    pathsDescription:
      "The first live intake channel is GitHub issue templates, so submissions are visible, auditable, and reviewable before publication.",
    openTemplate: "Open template",
    queue: "Queue",
    canonicalFact: "Canonical fact",
    no: "No",
    boundaryTitle: "What a submission can and cannot do",
    boundaryDescription:
      "This is the publication boundary for all contribution types.",
    courseTitle: "Course-level submissions",
    courseDescription:
      "Course-level policy submissions are useful, but they are handled as evidence records, not as open comments.",
    courseText:
      "Course records must reuse the same claim/evidence structure as university records: entity, term, source type, claim, original-language evidence, source language, review state, and moderation status. Do not paste full syllabi, LMS content, private student information, or non-public instructor data.",
    allowedStart: "Allowed starting point",
    allowedStartValue: "Short excerpt or public syllabus URL for review",
    initialState: "Initial state",
    initialStateValue: "pending review task, not a public claim",
    publicationModel: "Publication model",
    publicationModelValue: "claim/evidence after moderation and rights review",
    apiTitle: "Contribution API metadata",
    apiDescription:
      "Machine-readable intake policy for agents, developers, and contributors.",
    contributionIndex: "Contribution index",
    contributionIndexDescription:
      "Contribution workflows, required fields, GitHub issue template URLs, safeguards, and publication rules.",
    reviewPolicy: "Review policy",
    reviewPolicyDescription:
      "Review queues, publication gates, moderation rules, and contribution review boundaries.",
    readOnlyMetadata: "Read-only metadata",
    notice:
      "The tracker is not legal advice, not academic integrity advice, and not an official university statement unless a linked source is the university's own official page."
  }
};

type PageCopies = typeof en;

const translationTrees = {
  zh: zhTranslations,
  fr: frTranslations,
  pl: plTranslations,
  es: esTranslations,
  nl: nlTranslations,
  ms: msTranslations
} as const;

const formatterArguments: Record<string, string[]> = {
  "home.metadataTitle": ["count"],
  "universities.rankedRecords": ["ranking"],
  "universities.showing": ["visible", "total"],
  "universities.searchSummary": ["query"],
  "universities.rankingView": ["ranking"],
  "universities.rank": ["ranking"],
  "universities.candidateNotice": ["count"],
  "analysis.qualityStatus": ["status", "count"]
};

const localizedPageCopies: Record<SupportedLocale, PageCopies> = {
  en,
  zh: compilePageCopy(en, translationTrees.zh, "zh"),
  fr: compilePageCopy(en, translationTrees.fr, "fr"),
  pl: compilePageCopy(en, translationTrees.pl, "pl"),
  es: compilePageCopy(en, translationTrees.es, "es"),
  nl: compilePageCopy(en, translationTrees.nl, "nl"),
  ms: compilePageCopy(en, translationTrees.ms, "ms")
};

export function getPageCopy(locale: SupportedLocale): PageCopies {
  return localizedPageCopies[locale];
}

function compilePageCopy(
  base: PageCopies,
  translations: unknown,
  locale: Exclude<SupportedLocale, "en">
): PageCopies {
  return compileNode(base, translations, locale) as PageCopies;
}

function compileNode(
  base: unknown,
  translated: unknown,
  locale: Exclude<SupportedLocale, "en">,
  currentPath = ""
): unknown {
  if (typeof base === "function") {
    const conditional = getConditionalFormatter(locale, currentPath);
    if (conditional) return conditional;
    if (typeof translated !== "string") {
      throw new Error(`Invalid translated formatter at ${locale}:${currentPath}`);
    }
    const argumentNames = formatterArguments[currentPath];
    if (!argumentNames) {
      throw new Error(`Missing formatter definition at ${locale}:${currentPath}`);
    }
    return (...args: unknown[]) =>
      interpolateTemplate(
        translated,
        Object.fromEntries(argumentNames.map((name, index) => [name, args[index]]))
      );
  }

  if (Array.isArray(base)) {
    if (!Array.isArray(translated) || translated.length !== base.length) {
      throw new Error(`Invalid translated array at ${locale}:${currentPath}`);
    }
    return base.map((item, index) =>
      compileNode(item, translated[index], locale, `${currentPath}[${index}]`)
    );
  }

  if (isPlainObject(base)) {
    if (!isPlainObject(translated)) {
      throw new Error(`Invalid translated object at ${locale}:${currentPath}`);
    }
    return Object.fromEntries(
      Object.entries(base).map(([key, value]) => [
        key,
        compileNode(
          value,
          translated[key],
          locale,
          currentPath ? `${currentPath}.${key}` : key
        )
      ])
    );
  }

  if (typeof base === "string" && typeof translated !== "string") {
    throw new Error(`Missing translated string at ${locale}:${currentPath}`);
  }
  return translated;
}

function interpolateTemplate(
  template: string,
  values: Record<string, unknown>
): string {
  return template.replace(/\{([^}]+)\}/g, (_match, key: string) =>
    String(values[key] ?? "")
  );
}

function getConditionalFormatter(
  locale: Exclude<SupportedLocale, "en">,
  path: string
): ((...args: never[]) => string) | undefined {
  if (path === "changes.timelineLead") {
    return ((current: string, previous: string | undefined, sources: number, records: number) => {
      const values = { current, previous: previous ?? "—", sources, records };
      const templates = {
        zh: "比较 {current} 与 {previous}，覆盖 {sources} 个来源、{records} 条高校记录。",
        fr: "Comparaison de {current} avec {previous}, couvrant {sources} sources et {records} dossiers universitaires.",
        pl: "Porównanie {current} z {previous}, obejmujące {sources} źródeł i {records} rekordów uczelni.",
        es: "Comparación de {current} con {previous}, que abarca {sources} fuentes y {records} registros universitarios.",
        nl: "Vergelijking van {current} met {previous}, voor {sources} bronnen en {records} universiteitsrecords.",
        ms: "Perbandingan {current} dengan {previous}, meliputi {sources} sumber dan {records} rekod universiti."
      };
      return interpolateTemplate(templates[locale], values);
    }) as (...args: never[]) => string;
  }

  if (path === "changes.summary") {
    return ((name: string, claims: number, sources: number, changedDate: string | undefined, diffRows: number, policy: number, extracted: number, snapshot: number, sourceText: number) => {
      const values = { name, claims, sources, changedDate, policy, extracted, snapshot, sourceText };
      const baseTemplates = {
        zh: "{name} 有 {claims} 条有来源证据的声明和 {sources} 个官方来源归属。",
        fr: "{name} compte {claims} affirmations étayées et {sources} attributions de sources officielles.",
        pl: "{name} ma {claims} twierdzeń popartych źródłami i {sources} oficjalnych atrybucji źródeł.",
        es: "{name} tiene {claims} afirmaciones respaldadas y {sources} atribuciones de fuentes oficiales.",
        nl: "{name} heeft {claims} brononderbouwde claims en {sources} officiële bronvermeldingen.",
        ms: "{name} mempunyai {claims} tuntutan bersumber dan {sources} atribusi sumber rasmi."
      };
      const dateTemplates = {
        zh: changedDate ? " 最近记录的变更日期是 {changedDate}。" : " 尚未发布变更日期。",
        fr: changedDate ? " La dernière date de modification suivie est le {changedDate}." : " Aucune date de modification n’a encore été publiée.",
        pl: changedDate ? " Ostatnia śledzona data zmiany to {changedDate}." : " Nie opublikowano jeszcze daty zmiany.",
        es: changedDate ? " La última fecha de cambio registrada es {changedDate}." : " Aún no se ha publicado una fecha de cambio.",
        nl: changedDate ? " De laatst gevolgde wijzigingsdatum is {changedDate}." : " Er is nog geen wijzigingsdatum gepubliceerd.",
        ms: changedDate ? " Tarikh perubahan terkini yang dijejak ialah {changedDate}." : " Tiada tarikh perubahan diterbitkan lagi."
      };
      const diffTemplates = {
        zh: diffRows ? " 最新 tracker 差异：{policy} 项可比较政策文本变更、{extracted} 条新抽取声明、{snapshot} 项来源快照变更，以及 {sourceText} 项可用私有快照的来源文本变更。" : " 最新发布没有记录声明或证据变更。",
        fr: diffRows ? " Dernier diff du tracker : {policy} changements de texte comparables, {extracted} affirmations nouvellement extraites, {snapshot} changements d’instantané et {sourceText} changements de texte source lorsque les instantanés privés sont disponibles." : " Aucun changement d’affirmation ou de preuve n’est enregistré pour la dernière version.",
        pl: diffRows ? " Najnowszy diff trackera: {policy} porównywalnych zmian tekstu zasad, {extracted} nowo wyodrębnionych twierdzeń, {snapshot} zmian migawek źródeł i {sourceText} zmian tekstu źródłowego, gdy dostępne są prywatne migawki." : " W najnowszym wydaniu nie odnotowano zmian twierdzeń ani dowodów.",
        es: diffRows ? " Último diff del tracker: {policy} cambios comparables de texto, {extracted} afirmaciones recién extraídas, {snapshot} cambios de instantáneas y {sourceText} cambios de texto fuente cuando hay instantáneas privadas." : " No se registran cambios de afirmaciones o evidencias en la última versión.",
        nl: diffRows ? " Laatste tracker-diff: {policy} vergelijkbare beleidstekstwijzigingen, {extracted} nieuw geëxtraheerde claims, {snapshot} bronmomentopnamewijzigingen en {sourceText} brontekstwijzigingen waar private momentopnamen beschikbaar zijn." : " Voor de nieuwste release zijn geen claim- of bewijswijzigingen geregistreerd.",
        ms: diffRows ? " Diff tracker terkini: {policy} perubahan teks dasar yang boleh dibandingkan, {extracted} tuntutan baharu diekstrak, {snapshot} perubahan petikan sumber dan {sourceText} perubahan teks sumber apabila petikan peribadi tersedia." : " Tiada perubahan tuntutan atau bukti direkodkan bagi keluaran terkini."
      };
      return [baseTemplates[locale], dateTemplates[locale], diffTemplates[locale]]
        .map((template) => interpolateTemplate(template, values))
        .join("");
    }) as (...args: never[]) => string;
  }

  return undefined;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
