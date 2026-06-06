import { DEFAULT_LOCALE, type SupportedLocale } from "@/lib/i18n";

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
      chartData: "May 2026 monthly report chart data.",
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
      "Recent tracker release diffs with newly extracted claims, comparable policy-text changes, source snapshot changes, review states, and versioned public JSON links.",
    kicker: "Changes",
    heading: "Tracker release changes and source freshness",
    lead:
      "Release-to-release tracker diffs for public university AI policy records. Newly extracted claims and source snapshot changes are separated from comparable policy-text changes.",
    summaryLabel: "Recent changes summary",
    recordsWithDiffRows: "records with tracker diff rows",
    policyTextChanges: "comparable policy-text changes",
    newlyExtractedClaims: "newly extracted claims",
    privateSourceTextChanges: "private source text changes",
    answersLabel: "Change feed answer blocks",
    artifactTitle: "Public changes artifact",
    artifactDescription: "Versioned feed for records and agents.",
    recentChangesJson: "Recent changes JSON",
    recentChangesJsonDescription:
      "Recent changed or checked records with canonical URLs, review states, claim counts, and claim evidence where available.",
    latestDiffJson: "Latest release diff JSON",
    latestDiffJsonDescription:
      "Latest release-to-release tracker diff with semantic categories for policy text, extracted claims, evidence, and source snapshots.",
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
        title: "What changed means",
        text:
          "A release diff compares the current promoted claim/evidence snapshot with the previous public release. A newly extracted claim is not necessarily newly published by the university."
      },
      {
        title: "What source hash means",
        text:
          "A changed snapshot hash means the same source URL produced different tracker content. It may reflect policy text, page layout, navigation, or metadata."
      },
      {
        title: "How agents should use it",
        text:
          "Use semantic fields such as policyTextChanged, newlyExtractedClaims, and sourceSnapshotChanged before describing a record as a policy update."
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

const coreTranslations: Record<
  Exclude<SupportedLocale, "en">,
  PartialDeep<typeof en>
> = {
  zh: {
    datasets: {
      kicker: "数据集",
      heading: "公共 JSON 文件和发布元数据",
      leadPrefix: "版本化公共 JSON 位于",
      leadSuffix: "并由与可见页面相同的已发布数据集生成。",
      publicUniversityRecords: "公共高校记录",
      sourceBackedClaims: "有来源证据的声明",
      officialSourceAttributions: "官方来源归属",
      publicJsonSchemaVersion: "公共 JSON schema 版本",
      releaseDownloadArtifacts: "发布下载文件",
      analysisProfiles: "分析档案",
      whatReusableTitle: "哪些内容可复用",
      whatReusableText: "Tracker 元数据、记录 URL、审查状态、引用字段和公共 JSON 可按 tracker 元数据许可复用。",
      externalTitle: "哪些内容仍属外部来源",
      externalText: "官方来源文件、页面文字、PDF 和高校政策措辞保留原始权利和条款。",
      retrieveTitle: "智能体如何检索数据",
      retrieveText: "从 API 索引开始，用搜索解析实体，获取规范高校 JSON，然后引用声明证据和来源 URL。",
      versionedJsonTitle: "版本化公共 JSON",
      versionedJsonDescription: "按用途分组的实时只读文件。",
      coreRecords: "核心记录",
      searchAnalysis: "搜索和分析",
      reportsEmbeds: "报告和嵌入",
      reviewIntegrations: "审查和集成",
      releaseDownloadsTitle: "数据集发布下载",
      releaseDownloadsDescription: "包含行数、大小和校验和的批量文件。",
      release: "发布",
      period: "期间",
      published: "发布时间",
      rankingTitle: "排名和索引边界",
      rankingDescription: "发现输入，不是政策结论。",
      githubTitle: "GitHub 信任资产",
      githubDescription: "仓库级信任材料。",
      manifestTitle: "当前发布清单",
      promotedRuns: "已发布运行",
      manifestText: "该清单控制哪些已审查的暂存产物目录进入公共页面和公共 JSON。",
      conceptsTitle: "数据集概念",
      conceptsLead: "v1 记录当前公开的内容",
      licenseTitle: "许可、权利和引用",
      trackerMetadata: "tracker 元数据",
      trackerMetadataTitle: "Tracker 元数据",
      officialRightsTitle: "官方来源权利",
      citationExpectationsTitle: "引用要求",
      citationExpectationsText: "同时引用规范页面和公共 JSON。声明级复用应保留来源 URL、来源语言、快照哈希、审查状态、置信度和原始证据片段。",
      citationRulesPrefix: "引用规则见",
      recentFreshnessPrefix: "近期数据新鲜度见"
    },
    methodology: {
      kicker: "方法",
      heading: "记录如何成为有来源证据的声明",
      lead: "官方来源、快照、短证据片段、置信度和明确审查状态。",
      answersLabel: "方法说明",
      tocLabel: "方法章节",
      toc: {
        workflow: "证据流程",
        reviewStates: "审查状态",
        rankingBoundaries: "排名边界",
        publicationRules: "发布规则",
        limitations: "限制"
      },
      workflowDescription: "从公共来源发现到可引用记录。",
      reviewDescription: "审查状态是工作流状态；置信度是机器评估的支持度。",
      rankingDescription: "排名行用于优先级和筛选，不是政策声明。",
      publicationDescription: "公开声明前必须具备的内容。",
      limitationsDescription: "当前证据层的已知边界。",
      answers: [
        { title: "记录如何公开", text: "记录经过来源发现、快照哈希、声明抽取、证据绑定、审查状态标注，并从已发布公共数据集生成后公开。" },
        { title: "审查状态是什么意思", text: "审查状态描述工作流进度。置信度是独立的机器支持度分数，不会让声明变成官方结论。" },
        { title: "什么证据是规范的", text: "原文证据、来源 URL 和官方高校页面保持规范；翻译或摘要只是辅助显示元数据。" }
      ]
    },
    citation: {
      kicker: "引用",
      heading: "分别引用 tracker 元数据和官方来源",
      lead: "把规范页面、公共 JSON、来源 URL、快照哈希、审查状态、置信度和原始证据放在一起。",
      answersLabel: "引用说明",
      tocLabel: "引用章节",
      toc: {
        formats: "建议格式",
        fields: "引用字段",
        json: "公共 JSON",
        ranking: "排名来源",
        rights: "权利和边界"
      },
      universityPolicyRecord: "高校政策记录",
      datasetSurface: "数据集页面",
      changesFeed: "变更 feed 或报告",
      pageDataIdentity: "页面和数据身份",
      freshnessReview: "新鲜度和审查",
      sourceEvidence: "来源证据",
      apiIndex: "API 索引",
      universitiesList: "高校列表",
      universityRecord: "高校记录",
      recentChanges: "近期变更",
      universityRecords: "高校记录",
      methodology: "方法",
      datasetAccess: "数据集访问",
      answers: [
        { title: "如何引用高校记录", text: "同时引用规范可见记录页和对应公共 JSON URL，并保留来源 URL、审查状态、置信度和最后检查日期。" },
        { title: "如何引用声明证据", text: "声明级复用应包含声明文本、原文证据片段、来源语言、来源 URL、快照哈希、置信度和审查状态。" },
        { title: "什么不能当作官方内容引用", text: "University AI Policy Tracker 元数据不是高校官方声明；机构政策措辞请另行引用链接的官方来源。" }
      ]
    },
    analysis: {
      kicker: "政策分析",
      heading: "有来源证据的分析档案，不是政策建议",
      lead: "基于公共声明/证据记录派生的维度。每个非空结果保留声明 ID、来源 URL、来源语言和证据。",
      profiles: "档案",
      publicApi: "公共 API",
      analysisProfiles: "分析档案",
      evidenceBackedDimensions: "有证据的维度",
      averageCoverageScore: "平均公共覆盖分",
      sourceLanguagesPreserved: "保留的来源语言",
      answersLabel: "政策分析说明",
      summaryTitle: "摘要",
      tocLabel: "分析章节",
      toc: {
        meaning: "边界",
        dimensions: "维度",
        coverage: "覆盖分",
        themes: "主题分析",
        quality: "质量门槛",
        review: "审查流程",
        json: "公共 JSON",
        citation: "引用"
      },
      openCoverageTable: "打开覆盖表",
      pageQualityJson: "页面质量 JSON",
      openReviewWorkflow: "打开审查流程",
      queue: "队列",
      publicMutation: "公共修改",
      notAllowed: "不允许",
      reviewStates: "审查状态",
      openAnalysis: "打开分析",
      held: "等待证据阈值",
      evidenceBacked: "有证据",
      notMentioned: "未提及",
      gate: "门槛",
      analysisIndex: "分析索引",
      universityAnalysisProfile: "高校分析档案",
      coverageScores: "覆盖分",
      analysisPageQuality: "分析页面质量",
      suggestedCitation: "建议引用",
      answers: [
        { title: "分析是什么意思", text: "分析档案是公共声明/证据记录上的派生元数据；它们总结政策维度，但不替代来源证据。" },
        { title: "覆盖分是什么意思", text: "覆盖分衡量可见公共证据的广度，不代表政策质量、安全性、合法性、严格程度或合规性。" },
        { title: "如何引用分析", text: "把分析 JSON 与相关高校记录、依据声明 ID、来源 URL、审查状态和原始证据一起引用。" }
      ]
    },
    changes: {
      kicker: "变更",
      heading: "Tracker 发布变更和来源新鲜度",
      lead: "公共高校 AI 政策记录的发布间 diff。新抽取声明和来源快照变更会与可比较政策文本变更分开。",
      recordsWithDiffRows: "有 tracker diff 行的记录",
      policyTextChanges: "可比较政策文本变更",
      newlyExtractedClaims: "新抽取声明",
      privateSourceTextChanges: "私有来源文本变更",
      answersLabel: "变更 feed 说明",
      artifactTitle: "公共变更文件",
      artifactDescription: "面向读者和智能体的版本化 feed。",
      recentChangesJson: "近期变更 JSON",
      latestDiffJson: "最新发布 diff JSON",
      timelineTitle: "变更时间线",
      changeDetail: "变更详情",
      universityPage: "高校页面",
      publicJson: "公共 JSON",
      diff: "Diff",
      claims: "声明",
      sources: "来源",
      checked: "检查",
      changed: "变更",
      noPublicDate: "暂无公开日期",
      boundaryTitle: "边界",
      boundaryLead: "仅为新鲜度信号",
      answers: [
        { title: "changed 表示什么", text: "发布 diff 比较当前已发布声明/证据快照与上一公共发布。新抽取声明不一定表示高校刚发布。" },
        { title: "来源哈希表示什么", text: "快照哈希变化表示同一来源 URL 产生了不同 tracker 内容，可能是政策文本、页面布局、导航或元数据变化。" },
        { title: "智能体应如何使用", text: "描述政策更新前，应先使用 policyTextChanged、newlyExtractedClaims 和 sourceSnapshotChanged 等语义字段。" }
      ]
    },
    contribute: {
      kicker: "贡献入口",
      heading: "把证据提交到审查队列",
      lead: "贡献可以扩展覆盖范围，但不会直接创建规范政策事实。每个来源 URL、修正、翻译修复或课程级提交都会先成为审查任务。",
      pathsTitle: "贡献路径",
      openTemplate: "打开模板",
      queue: "队列",
      canonicalFact: "规范事实",
      no: "否",
      boundaryTitle: "提交可以和不可以做什么",
      courseTitle: "课程级提交",
      allowedStart: "允许的起点",
      initialState: "初始状态",
      publicationModel: "发布模型",
      apiTitle: "贡献 API 元数据",
      contributionIndex: "贡献索引",
      reviewPolicy: "审查政策",
      readOnlyMetadata: "只读元数据"
    }
  },
  fr: {
    datasets: { kicker: "Jeux de donnees", heading: "Artefacts JSON publics et metadonnees de version", leadPrefix: "JSON public versionne sous", leadSuffix: "cree depuis le meme jeu de donnees promu que les pages visibles.", publicUniversityRecords: "dossiers universitaires publics", sourceBackedClaims: "affirmations etayees", officialSourceAttributions: "sources officielles", analysisProfiles: "profils d'analyse", whatReusableTitle: "Ce qui peut etre reutilise", externalTitle: "Ce qui reste externe", retrieveTitle: "Comment les agents recuperent les donnees", versionedJsonTitle: "JSON public versionne", coreRecords: "Dossiers principaux", searchAnalysis: "Recherche et analyse", reportsEmbeds: "Rapports et integrations", reviewIntegrations: "Revue et integrations", conceptsTitle: "Concepts du jeu de donnees", licenseTitle: "Licence, droits et citation" },
    methodology: { kicker: "Methodologie", heading: "Comment les dossiers deviennent des affirmations etayees", lead: "Sources officielles, instantanes, courts extraits de preuve, confiance et etat de revue explicite.", toc: { workflow: "Flux de preuve", reviewStates: "Etats de revue", rankingBoundaries: "Limites des classements", publicationRules: "Regles de publication", limitations: "Limites" } },
    citation: { kicker: "Citation", heading: "Citez separement les metadonnees du tracker et les sources officielles", lead: "Gardez ensemble page canonique, JSON public, URL source, hash d'instantane, etat de revue, confiance et preuve originale.", toc: { formats: "Formats suggeres", fields: "Champs de citation", json: "JSON public", ranking: "Sources de classement", rights: "Droits et limites" } },
    analysis: { kicker: "Analyse de politique", heading: "Profils d'analyse etayes, pas des conseils de politique", lead: "Dimensions derivees des dossiers publics de revendications et preuves.", analysisProfiles: "profils d'analyse", evidenceBackedDimensions: "dimensions etayees", averageCoverageScore: "score moyen de couverture", sourceLanguagesPreserved: "langues sources conservees", toc: { meaning: "Limite", dimensions: "Dimensions", coverage: "Score de couverture", themes: "Analyse thematique", quality: "Seuils qualite", review: "Flux de revue", json: "JSON public", citation: "Citation" } },
    changes: { kicker: "Changements", heading: "Changements de version et fraicheur des sources", lead: "Diffs entre versions pour les dossiers publics de politiques IA universitaires.", recordsWithDiffRows: "dossiers avec lignes de diff", policyTextChanges: "changements de texte comparables", newlyExtractedClaims: "affirmations nouvellement extraites", privateSourceTextChanges: "changements de texte source prive", timelineTitle: "Chronologie des changements", boundaryTitle: "Limite", boundaryLead: "Signaux de fraicheur seulement" },
    contribute: { kicker: "Contribution", heading: "Soumettre des preuves dans une file de revue", lead: "Les contributions elargissent la couverture mais ne creent pas directement des faits canoniques.", pathsTitle: "Chemins de contribution", openTemplate: "Ouvrir le modele", boundaryTitle: "Ce qu'une soumission peut faire", courseTitle: "Soumissions au niveau cours", apiTitle: "Metadonnees API de contribution" }
  },
  pl: {
    datasets: { kicker: "Zbiory danych", heading: "Publiczne artefakty JSON i metadane wydania", leadPrefix: "Wersjonowany publiczny JSON w", leadSuffix: "zbudowany z tego samego wydania co widoczne strony.", publicUniversityRecords: "publiczne rekordy uczelni", sourceBackedClaims: "twierdzenia ze zrodlami", officialSourceAttributions: "oficjalne zrodla", analysisProfiles: "profile analizy", whatReusableTitle: "Co mozna ponownie uzyc", externalTitle: "Co pozostaje zewnetrzne", retrieveTitle: "Jak agenci pobieraja dane", versionedJsonTitle: "Wersjonowany publiczny JSON", coreRecords: "Rekordy glowne", searchAnalysis: "Wyszukiwanie i analiza", reportsEmbeds: "Raporty i osadzenia", reviewIntegrations: "Przeglad i integracje", conceptsTitle: "Pojecia zbioru danych", licenseTitle: "Licencja, prawa i cytowanie" },
    methodology: { kicker: "Metodologia", heading: "Jak rekordy staja sie twierdzeniami ze zrodlami", lead: "Oficjalne zrodla, migawki, krotkie dowody, pewnosc i jawny stan przegladu.", toc: { workflow: "Przeplyw dowodow", reviewStates: "Stany przegladu", rankingBoundaries: "Granice rankingow", publicationRules: "Reguly publikacji", limitations: "Ograniczenia" } },
    citation: { kicker: "Cytowanie", heading: "Cytuj metadane trackera i oficjalne zrodla oddzielnie", lead: "Zachowaj razem strone kanoniczna, publiczny JSON, URL zrodla, hash migawki, stan przegladu, pewnosc i oryginalny dowod.", toc: { formats: "Sugerowane formaty", fields: "Pola cytowania", json: "Publiczny JSON", ranking: "Zrodla rankingowe", rights: "Prawa i granice" } },
    analysis: { kicker: "Analiza polityk", heading: "Profile analizy oparte na zrodlach, nie porady", lead: "Wymiary pochodne nad publicznymi rekordami twierdzen i dowodow.", analysisProfiles: "profile analizy", evidenceBackedDimensions: "wymiary z dowodami", averageCoverageScore: "sredni wynik pokrycia", sourceLanguagesPreserved: "zachowane jezyki zrodel", toc: { meaning: "Granica", dimensions: "Wymiary", coverage: "Wynik pokrycia", themes: "Analiza tematyczna", quality: "Bramki jakosci", review: "Przeplyw przegladu", json: "Publiczny JSON", citation: "Cytowanie" } },
    changes: { kicker: "Zmiany", heading: "Zmiany wydan i swiezosc zrodel", lead: "Diffy miedzy wydaniami publicznych rekordow polityk AI uczelni.", recordsWithDiffRows: "rekordy z wierszami diff", policyTextChanges: "porownywalne zmiany tekstu", newlyExtractedClaims: "nowo wyodrebnione twierdzenia", privateSourceTextChanges: "prywatne zmiany tekstu zrodla", timelineTitle: "Os czasu zmian", boundaryTitle: "Granica", boundaryLead: "Tylko sygnaly swiezosci" },
    contribute: { kicker: "Wklad", heading: "Przeslij dowody do kolejki przegladu", lead: "Wklady poszerzaja pokrycie, ale nie tworza bezposrednio faktow kanonicznych.", pathsTitle: "Sciezki wkladu", openTemplate: "Otworz szablon", boundaryTitle: "Co moze zrobic zgloszenie", courseTitle: "Zgloszenia kursowe", apiTitle: "Metadane API wkladu" }
  },
  es: {
    datasets: { kicker: "Datos", heading: "Artefactos JSON publicos y metadatos de version", leadPrefix: "JSON publico versionado en", leadSuffix: "creado desde el mismo conjunto publicado que las paginas visibles.", publicUniversityRecords: "registros universitarios publicos", sourceBackedClaims: "afirmaciones con fuentes", officialSourceAttributions: "fuentes oficiales", analysisProfiles: "perfiles de analisis", whatReusableTitle: "Que se puede reutilizar", externalTitle: "Que sigue externo", retrieveTitle: "Como recuperan datos los agentes", versionedJsonTitle: "JSON publico versionado", coreRecords: "Registros centrales", searchAnalysis: "Busqueda y analisis", reportsEmbeds: "Reportes e incrustaciones", reviewIntegrations: "Revision e integraciones", conceptsTitle: "Conceptos del dataset", licenseTitle: "Licencia, derechos y cita" },
    methodology: { kicker: "Metodologia", heading: "Como los registros se vuelven afirmaciones respaldadas", lead: "Fuentes oficiales, capturas, breves evidencias, confianza y estado de revision explicito.", toc: { workflow: "Flujo de evidencia", reviewStates: "Estados de revision", rankingBoundaries: "Limites de rankings", publicationRules: "Reglas de publicacion", limitations: "Limitaciones" } },
    citation: { kicker: "Cita", heading: "Cita los metadatos del tracker y las fuentes oficiales por separado", lead: "Mantiene juntos la pagina canonica, JSON publico, URL fuente, hash, estado de revision, confianza y evidencia original.", toc: { formats: "Formatos sugeridos", fields: "Campos de cita", json: "JSON publico", ranking: "Fuentes de ranking", rights: "Derechos y limites" } },
    analysis: { kicker: "Analisis de politicas", heading: "Perfiles de analisis con fuentes, no asesoramiento", lead: "Dimensiones derivadas sobre registros publicos de afirmaciones y evidencia.", analysisProfiles: "perfiles de analisis", evidenceBackedDimensions: "dimensiones con evidencia", averageCoverageScore: "puntaje medio de cobertura", sourceLanguagesPreserved: "idiomas fuente conservados", toc: { meaning: "Limite", dimensions: "Dimensiones", coverage: "Puntaje de cobertura", themes: "Analisis tematico", quality: "Controles de calidad", review: "Flujo de revision", json: "JSON publico", citation: "Cita" } },
    changes: { kicker: "Cambios", heading: "Cambios de version y frescura de fuentes", lead: "Diffs entre versiones para registros publicos de politicas universitarias de IA.", recordsWithDiffRows: "registros con filas diff", policyTextChanges: "cambios comparables de texto", newlyExtractedClaims: "afirmaciones nuevas extraidas", privateSourceTextChanges: "cambios privados de texto fuente", timelineTitle: "Linea de tiempo de cambios", boundaryTitle: "Limite", boundaryLead: "Solo senales de frescura" },
    contribute: { kicker: "Contribuir", heading: "Enviar evidencia a una cola de revision", lead: "Las contribuciones amplian la cobertura, pero no crean hechos canonicos directamente.", pathsTitle: "Vias de contribucion", openTemplate: "Abrir plantilla", boundaryTitle: "Que puede hacer un envio", courseTitle: "Envios de cursos", apiTitle: "Metadatos API de contribucion" }
  },
  nl: {
    datasets: { kicker: "Datasets", heading: "Publieke JSON-bestanden en release-metadata", leadPrefix: "Geversioneerde publieke JSON onder", leadSuffix: "gebouwd uit dezelfde gepubliceerde dataset als de zichtbare pagina's.", publicUniversityRecords: "publieke universiteitsrecords", sourceBackedClaims: "brononderbouwde claims", officialSourceAttributions: "officiele bronnen", analysisProfiles: "analyseprofielen", whatReusableTitle: "Wat herbruikbaar is", externalTitle: "Wat extern blijft", retrieveTitle: "Hoe agents data ophalen", versionedJsonTitle: "Geversioneerde publieke JSON", coreRecords: "Kernrecords", searchAnalysis: "Zoeken en analyse", reportsEmbeds: "Rapporten en embeds", reviewIntegrations: "Review en integraties", conceptsTitle: "Datasetconcepten", licenseTitle: "Licentie, rechten en citatie" },
    methodology: { kicker: "Methodologie", heading: "Hoe records brononderbouwde claims worden", lead: "Officiele bronnen, snapshots, korte bewijsfragmenten, vertrouwen en expliciete reviewstatus.", toc: { workflow: "Bewijsproces", reviewStates: "Reviewstatussen", rankingBoundaries: "Rankinggrenzen", publicationRules: "Publicatieregels", limitations: "Beperkingen" } },
    citation: { kicker: "Citatie", heading: "Citeer tracker-metadata en officiele bronnen apart", lead: "Houd canonieke pagina, publieke JSON, bron-URL, snapshot-hash, reviewstatus, vertrouwen en origineel bewijs samen.", toc: { formats: "Voorgestelde formats", fields: "Citatievelden", json: "Publieke JSON", ranking: "Rankingbronnen", rights: "Rechten en grenzen" } },
    analysis: { kicker: "Beleidsanalyse", heading: "Brononderbouwde analyseprofielen, geen beleidsadvies", lead: "Afgeleide dimensies over publieke claim- en bewijsrecords.", analysisProfiles: "analyseprofielen", evidenceBackedDimensions: "dimensies met bewijs", averageCoverageScore: "gemiddelde dekkingsscore", sourceLanguagesPreserved: "bewaarde brontalen", toc: { meaning: "Grens", dimensions: "Dimensies", coverage: "Dekkingsscore", themes: "Thema-analyse", quality: "Kwaliteitscontroles", review: "Reviewproces", json: "Publieke JSON", citation: "Citatie" } },
    changes: { kicker: "Wijzigingen", heading: "Releasewijzigingen en bronversheid", lead: "Diffs tussen releases voor publieke universitaire AI-beleidsrecords.", recordsWithDiffRows: "records met diff-regels", policyTextChanges: "vergelijkbare tekstwijzigingen", newlyExtractedClaims: "nieuw geextraheerde claims", privateSourceTextChanges: "private brontekstwijzigingen", timelineTitle: "Wijzigingstijdlijn", boundaryTitle: "Grens", boundaryLead: "Alleen versheidssignalen" },
    contribute: { kicker: "Bijdragen", heading: "Dien bewijs in bij een reviewrij", lead: "Bijdragen vergroten dekking, maar maken niet direct canonieke feiten.", pathsTitle: "Bijdragepaden", openTemplate: "Template openen", boundaryTitle: "Wat een inzending kan doen", courseTitle: "Cursusinzendingen", apiTitle: "API-metadata voor bijdragen" }
  },
  ms: {
    datasets: { kicker: "Dataset", heading: "Artifak JSON awam dan metadata keluaran", leadPrefix: "JSON awam berversi di", leadSuffix: "dibina daripada dataset keluaran yang sama seperti halaman kelihatan.", publicUniversityRecords: "rekod universiti awam", sourceBackedClaims: "tuntutan bersumber", officialSourceAttributions: "sumber rasmi", analysisProfiles: "profil analisis", whatReusableTitle: "Apa yang boleh digunakan semula", externalTitle: "Apa yang kekal luaran", retrieveTitle: "Cara agen mendapatkan data", versionedJsonTitle: "JSON awam berversi", coreRecords: "Rekod teras", searchAnalysis: "Carian dan analisis", reportsEmbeds: "Laporan dan benaman", reviewIntegrations: "Semakan dan integrasi", conceptsTitle: "Konsep dataset", licenseTitle: "Lesen, hak dan petikan" },
    methodology: { kicker: "Metodologi", heading: "Bagaimana rekod menjadi tuntutan bersumber", lead: "Sumber rasmi, petikan, bukti ringkas, keyakinan dan keadaan semakan jelas.", toc: { workflow: "Aliran bukti", reviewStates: "Keadaan semakan", rankingBoundaries: "Had ranking", publicationRules: "Peraturan penerbitan", limitations: "Had" } },
    citation: { kicker: "Petikan", heading: "Petik metadata tracker dan sumber rasmi secara berasingan", lead: "Simpan halaman kanonik, JSON awam, URL sumber, hash petikan, keadaan semakan, keyakinan dan bukti asal bersama.", toc: { formats: "Format cadangan", fields: "Medan petikan", json: "JSON awam", ranking: "Sumber ranking", rights: "Hak dan had" } },
    analysis: { kicker: "Analisis dasar", heading: "Profil analisis bersumber, bukan nasihat dasar", lead: "Dimensi terbitan atas rekod tuntutan dan bukti awam.", analysisProfiles: "profil analisis", evidenceBackedDimensions: "dimensi berbukti", averageCoverageScore: "skor liputan purata", sourceLanguagesPreserved: "bahasa sumber dikekalkan", toc: { meaning: "Had", dimensions: "Dimensi", coverage: "Skor liputan", themes: "Analisis tema", quality: "Pintu kualiti", review: "Aliran semakan", json: "JSON awam", citation: "Petikan" } },
    changes: { kicker: "Perubahan", heading: "Perubahan keluaran dan kesegaran sumber", lead: "Diff antara keluaran untuk rekod dasar AI universiti awam.", recordsWithDiffRows: "rekod dengan baris diff", policyTextChanges: "perubahan teks dasar setara", newlyExtractedClaims: "tuntutan baru diekstrak", privateSourceTextChanges: "perubahan teks sumber peribadi", timelineTitle: "Garis masa perubahan", boundaryTitle: "Had", boundaryLead: "Isyarat kesegaran sahaja" },
    contribute: { kicker: "Sumbang", heading: "Hantar bukti ke baris semakan", lead: "Sumbangan meluaskan liputan tetapi tidak terus mencipta fakta kanonik.", pathsTitle: "Laluan sumbangan", openTemplate: "Buka templat", boundaryTitle: "Apa yang boleh dibuat oleh hantaran", courseTitle: "Hantaran peringkat kursus", apiTitle: "Metadata API sumbangan" }
  }
};

const pageCopies = {
  en,
  zh: localize(en, {
    ...coreTranslations.zh,
    home: {
      metadataTitle: (count) => `高校 AI 政策数据库：搜索 ${count} 条有来源证据支撑的生成式 AI 政策`,
      description: "搜索和引用有官方来源、审查状态、公共 JSON 与可引用证据的高校生成式 AI 政策记录。",
      kicker: "高校 AI 政策数据库",
      lead: "查找、引用并检索有来源证据支撑的高校生成式 AI 政策记录。可按机构、来源域名、AI 工具、政策主题或公共证据短语搜索。",
      searchLabel: "搜索公共高校 AI 政策记录",
      searchPlaceholder: "搜索高校、主题、来源域名...",
      searchButton: "搜索",
      suggestedSearches: "建议搜索",
      note: "搜索只是公共记录的路由辅助，不是政策结论。引用前请打开记录页和公共 JSON。",
      universityRecords: "高校记录",
      sourceBackedClaims: "有来源证据的声明",
      officialSourceAttributions: "官方来源归属",
      analysisProfiles: "分析档案",
      answersLabel: "数据库说明",
      matchingRecords: "匹配记录",
      openSearch: "打开搜索",
      record: "记录",
      claims: "声明",
      sources: "来源",
      recentChecks: "最近检查",
      viewChanges: "查看变更",
      noPublicFreshnessDate: "暂无公开更新时间",
      agentRetrievalTitle: "智能体和引用检索",
      agentRetrievalLead: "请同时使用规范页面和版本化公共 JSON。",
      aiSystemsTitle: "面向 AI/搜索系统",
      aiSystemsText: "先通过搜索解析实体，打开规范高校记录，再引用声明证据和公共 JSON 字段，不替换官方来源原文。",
      researchersTitle: "面向研究者和记者",
      researchersText: "把 tracker 元数据视为引用层。官方来源页面、PDF 和政策文件仍是机构措辞的最终来源。",
      developersTitle: "面向开发者",
      developersText: "公共端点在版本化 API 命名空间下提供只读记录、搜索、实体、数据集、近期变更、分析档案和引用元数据。",
      changed: "变更于",
      checked: "检查于",
      homeAnswers: [
        { title: "这个数据库是什么", text: "一个公开、来源支撑的高校生成式 AI 政策索引，包含规范页面、审查状态、来源 URL、证据片段和公共 JSON。" },
        { title: "这个数据库不是什么", text: "它不是法律建议、学术诚信建议，也不是高校官方声明。官方高校来源页面仍是规范来源。" },
        { title: "如何引用记录", text: "同时引用可见记录页和对应公共 JSON，并保留来源 URL、审查状态、置信度、最后检查日期和原文证据。" }
      ]
    },
    universities: {
      kicker: "证据记录",
      heading: "浏览有来源证据支撑的高校 AI 政策记录",
      lead: "按机构、排名覆盖、声明、官方来源、审查状态和版本化公共 JSON 筛选公共记录。",
      universityRecords: "高校记录",
      sourceBackedClaims: "有来源证据的声明",
      officialSourceAttributions: "官方来源归属",
      rankedRecords: (ranking) => `${ranking} 排名记录`,
      indexTitle: "索引",
      indexLead: "排名筛选只用于发现和覆盖分析；政策声明仍来自官方来源。",
      search: "搜索",
      searchPlaceholder: "高校、国家、城市",
      ranking: "排名",
      coverage: "覆盖",
      sort: "排序",
      order: "顺序",
      allRecords: "全部记录",
      rankedInSelectedSystem: "在所选体系中有排名",
      missingSelectedRank: "缺少所选排名",
      selectedRanking: "所选排名",
      recentlyChecked: "最近检查",
      universityName: "高校名称",
      claimCount: "声明数量",
      sourceCount: "来源数量",
      ascending: "升序",
      descending: "降序",
      apply: "应用",
      reset: "重置",
      showing: (visible, total) => `显示 ${visible} / ${total} 条记录。`,
      searchSummary: (query) => `搜索：“${query}”。`,
      rankingView: (ranking) => `排名视图：${ranking}。`,
      university: "高校",
      rank: (ranking) => `${ranking} 排名`,
      claims: "声明",
      sources: "来源",
      lastChecked: "最后检查",
      publicJson: "公共 JSON",
      locationUnknown: "位置未知",
      confidence: "置信度",
      unknown: "未知",
      noMatches: "没有记录匹配当前搜索和排名覆盖筛选。",
      notIndexed: "未索引",
      partialSource: "部分来源",
      derivedOrder: "派生排序",
      answerCards: [
        { title: "索引覆盖什么", text: "已发布的公共高校记录，包含有来源证据的声明数量、官方来源归属、审查状态和规范记录 URL。" },
        { title: "如何使用排名", text: "排名筛选只支持发现和覆盖分析；它们不会创建或覆盖政策声明。" },
        { title: "复用边界", text: "本 tracker 不是法律建议、学术诚信建议，也不是官方高校声明，除非链接来源本身是高校官方页面。" }
      ]
    }
  }),
  fr: localize(en, {
    ...coreTranslations.fr,
    home: {
      metadataTitle: (count) => `Base de politiques IA universitaires : ${count} politiques GenAI etayees par des sources`,
      kicker: "Base de politiques IA universitaires",
      lead: "Trouvez, citez et recuperez des dossiers de politiques GenAI universitaires etayes par des sources.",
      searchButton: "Rechercher",
      searchPlaceholder: "Universites, themes, domaines sources...",
      universityRecords: "dossiers universitaires",
      sourceBackedClaims: "affirmations etayees par des sources",
      officialSourceAttributions: "attributions de sources officielles",
      analysisProfiles: "profils d'analyse",
      matchingRecords: "Dossiers correspondants",
      recentChecks: "Controles recents",
      viewChanges: "Voir les changements",
      homeAnswers: [
        { title: "Ce qu'est cette base", text: "Un index public etaye par des sources pour les politiques GenAI universitaires, avec pages canoniques, etat de revue, URL sources, extraits de preuve et JSON public." },
        { title: "Ce que cette base n'est pas", text: "Ce n'est pas un avis juridique, un conseil d'integrite academique, ni une declaration officielle d'universite. Les pages sources officielles restent canoniques." },
        { title: "Comment citer les dossiers", text: "Citez ensemble la page visible et le JSON public correspondant, puis conservez URL source, etat de revue, confiance, date de controle et preuve en langue originale." }
      ]
    },
    universities: {
      kicker: "Dossiers de preuve",
      heading: "Parcourir les dossiers de politiques IA universitaires etayes par des sources",
      lead: "Filtrez les dossiers publics par etablissement, classement, affirmations, sources officielles, etat de revue et JSON public versionne.",
      universityRecords: "dossiers universitaires",
      sourceBackedClaims: "affirmations etayees",
      officialSourceAttributions: "sources officielles",
      rankedRecords: (ranking) => `dossiers classes ${ranking}`,
      indexTitle: "Index",
      search: "Rechercher",
      ranking: "Classement",
      coverage: "Couverture",
      sort: "Tri",
      order: "Ordre",
      apply: "Appliquer",
      reset: "Reinitialiser",
      showing: (visible, total) => `${visible} dossiers affiches sur ${total}.`,
      university: "Universite",
      claims: "Affirmations",
      sources: "Sources",
      lastChecked: "Dernier controle",
      noMatches: "Aucun dossier ne correspond aux filtres actuels.",
      answerCards: [
        { title: "Ce que couvre l'index", text: "Dossiers publics promus avec nombre d'affirmations etayees, sources officielles, etat de revue et URL canonique." },
        { title: "Utiliser les classements", text: "Les filtres de classement servent seulement a la decouverte et a l'analyse de couverture." },
        { title: "Limite de reutilisation", text: "Le tracker n'est pas un avis juridique, un conseil d'integrite academique ni une declaration officielle." }
      ]
    }
  }),
  pl: localize(en, {
    ...coreTranslations.pl,
    home: {
      metadataTitle: (count) => `Baza polityk AI uczelni: ${count} rekordow GenAI opartych na zrodlach`,
      kicker: "Baza polityk AI uczelni",
      lead: "Znajduj, cytuj i pobieraj rekordy polityk GenAI uczelni oparte na zrodlach.",
      searchButton: "Szukaj",
      searchPlaceholder: "Uczelnie, tematy, domeny zrodel...",
      universityRecords: "rekordy uczelni",
      sourceBackedClaims: "twierdzenia ze zrodlami",
      officialSourceAttributions: "oficjalne zrodla",
      analysisProfiles: "profile analizy",
      matchingRecords: "Pasujace rekordy",
      recentChecks: "Ostatnie kontrole",
      viewChanges: "Zobacz zmiany",
      homeAnswers: [
        { title: "Czym jest ta baza", text: "Publiczny indeks polityk GenAI uczelni oparty na zrodlach, z kanonicznymi stronami, stanem przegladu, URL zrodel, fragmentami dowodow i publicznym JSON." },
        { title: "Czym ta baza nie jest", text: "Nie jest porada prawna, porada o uczciwosci akademickiej ani oficjalnym stanowiskiem uczelni." },
        { title: "Jak cytowac rekordy", text: "Cytuj widoczna strone rekordu razem z publicznym JSON i zachowaj URL zrodla, stan przegladu, pewnosc, date kontroli i oryginalny dowod." }
      ]
    },
    universities: {
      kicker: "Rekordy dowodowe",
      heading: "Przegladaj rekordy polityk AI uczelni oparte na zrodlach",
      lead: "Filtruj rekordy publiczne wedlug instytucji, rankingow, twierdzen, zrodel, stanu przegladu i publicznego JSON.",
      universityRecords: "rekordy uczelni",
      sourceBackedClaims: "twierdzenia ze zrodlami",
      officialSourceAttributions: "oficjalne zrodla",
      rankedRecords: (ranking) => `rekordy w rankingu ${ranking}`,
      indexTitle: "Indeks",
      search: "Szukaj",
      ranking: "Ranking",
      coverage: "Pokrycie",
      sort: "Sortuj",
      order: "Kolejnosc",
      apply: "Zastosuj",
      reset: "Reset",
      showing: (visible, total) => `Pokazuje ${visible} z ${total} rekordow.`,
      university: "Uczelnia",
      claims: "Twierdzenia",
      sources: "Zrodla",
      lastChecked: "Ostatnio sprawdzono",
      noMatches: "Brak rekordow pasujacych do obecnych filtrow."
    }
  }),
  es: localize(en, {
    ...coreTranslations.es,
    home: {
      metadataTitle: (count) => `Base de politicas de IA universitarias: ${count} politicas GenAI con fuentes`,
      kicker: "Base de politicas de IA universitarias",
      lead: "Encuentra, cita y recupera registros universitarios de politicas GenAI respaldados por fuentes.",
      searchButton: "Buscar",
      searchPlaceholder: "Universidades, temas, dominios fuente...",
      universityRecords: "registros universitarios",
      sourceBackedClaims: "afirmaciones con fuentes",
      officialSourceAttributions: "fuentes oficiales",
      analysisProfiles: "perfiles de analisis",
      matchingRecords: "Registros coincidentes",
      recentChecks: "Revisiones recientes",
      viewChanges: "Ver cambios"
    },
    universities: {
      kicker: "Registros con evidencia",
      heading: "Explora registros universitarios de politicas de IA respaldados por fuentes",
      lead: "Filtra registros publicos por institucion, ranking, afirmaciones, fuentes oficiales, estado de revision y JSON publico.",
      universityRecords: "registros universitarios",
      sourceBackedClaims: "afirmaciones con fuentes",
      officialSourceAttributions: "fuentes oficiales",
      rankedRecords: (ranking) => `registros clasificados en ${ranking}`,
      indexTitle: "Indice",
      search: "Buscar",
      ranking: "Ranking",
      coverage: "Cobertura",
      sort: "Ordenar",
      order: "Orden",
      apply: "Aplicar",
      reset: "Restablecer",
      showing: (visible, total) => `Mostrando ${visible} de ${total} registros.`,
      university: "Universidad",
      claims: "Afirmaciones",
      sources: "Fuentes",
      lastChecked: "Ultima revision",
      noMatches: "No hay registros que coincidan con los filtros actuales."
    }
  }),
  nl: localize(en, {
    ...coreTranslations.nl,
    home: {
      metadataTitle: (count) => `Universitaire AI-beleidsdatabase: zoek ${count} brononderbouwde GenAI-beleidsrecords`,
      kicker: "Universitaire AI-beleidsdatabase",
      lead: "Vind, citeer en haal brononderbouwde GenAI-beleidsrecords van universiteiten op.",
      searchButton: "Zoeken",
      searchPlaceholder: "Universiteiten, onderwerpen, brondomeinen...",
      universityRecords: "universiteitsrecords",
      sourceBackedClaims: "brononderbouwde claims",
      officialSourceAttributions: "officiele bronvermeldingen",
      analysisProfiles: "analyseprofielen",
      matchingRecords: "Overeenkomende records",
      recentChecks: "Recente controles",
      viewChanges: "Wijzigingen bekijken"
    },
    universities: {
      kicker: "Bewijsrecords",
      heading: "Bekijk brononderbouwde AI-beleidsrecords van universiteiten",
      lead: "Filter publieke records op instelling, ranking, claims, officiele bronnen, reviewstatus en publieke JSON.",
      universityRecords: "universiteitsrecords",
      sourceBackedClaims: "brononderbouwde claims",
      officialSourceAttributions: "officiele bronnen",
      rankedRecords: (ranking) => `${ranking}-gerangschikte records`,
      indexTitle: "Index",
      search: "Zoeken",
      ranking: "Ranking",
      coverage: "Dekking",
      sort: "Sorteren",
      order: "Volgorde",
      apply: "Toepassen",
      reset: "Reset",
      showing: (visible, total) => `${visible} van ${total} records getoond.`,
      university: "Universiteit",
      claims: "Claims",
      sources: "Bronnen",
      lastChecked: "Laatst gecontroleerd",
      noMatches: "Geen records passen bij de huidige filters."
    }
  }),
  ms: localize(en, {
    ...coreTranslations.ms,
    home: {
      metadataTitle: (count) => `Pangkalan data dasar AI universiti: cari ${count} dasar GenAI bersumber`,
      kicker: "Pangkalan data dasar AI universiti",
      lead: "Cari, petik dan dapatkan rekod dasar GenAI universiti yang disokong sumber.",
      searchButton: "Cari",
      searchPlaceholder: "Universiti, topik, domain sumber...",
      universityRecords: "rekod universiti",
      sourceBackedClaims: "tuntutan bersumber",
      officialSourceAttributions: "atribusi sumber rasmi",
      analysisProfiles: "profil analisis",
      matchingRecords: "Rekod sepadan",
      recentChecks: "Semakan terkini",
      viewChanges: "Lihat perubahan"
    },
    universities: {
      kicker: "Rekod bukti",
      heading: "Semak rekod dasar AI universiti yang disokong sumber",
      lead: "Tapis rekod awam mengikut institusi, liputan ranking, tuntutan, sumber rasmi, keadaan semakan dan JSON awam.",
      universityRecords: "rekod universiti",
      sourceBackedClaims: "tuntutan bersumber",
      officialSourceAttributions: "sumber rasmi",
      rankedRecords: (ranking) => `rekod beranking ${ranking}`,
      indexTitle: "Indeks",
      search: "Cari",
      ranking: "Ranking",
      coverage: "Liputan",
      sort: "Susun",
      order: "Tertib",
      apply: "Guna",
      reset: "Tetap semula",
      showing: (visible, total) => `Memaparkan ${visible} daripada ${total} rekod.`,
      university: "Universiti",
      claims: "Tuntutan",
      sources: "Sumber",
      lastChecked: "Semakan terakhir",
      noMatches: "Tiada rekod sepadan dengan tapis semasa."
    }
  })
} satisfies Record<SupportedLocale, typeof en>;

type PageCopies = typeof en;

export function getPageCopy(locale: SupportedLocale): PageCopies {
  return pageCopies[locale] ?? pageCopies[DEFAULT_LOCALE];
}

function localize<T>(base: T, overrides: PartialDeep<T>): T {
  return mergeDeep(base, overrides);
}

type PartialDeep<T> = {
  [K in keyof T]?: T[K] extends (...args: never[]) => unknown
    ? T[K]
    : T[K] extends readonly (infer U)[]
      ? readonly (PartialDeep<U> | U)[]
      : T[K] extends object
        ? PartialDeep<T[K]>
        : T[K];
};

function mergeDeep<T>(base: T, overrides: PartialDeep<T> | undefined): T {
  if (!overrides) return base;
  if (Array.isArray(base)) {
    return (Array.isArray(overrides) ? overrides : base) as T;
  }
  if (!isPlainObject(base) || !isPlainObject(overrides)) {
    return (overrides ?? base) as T;
  }

  const result: Record<string, unknown> = { ...base };
  for (const key of Object.keys(overrides)) {
    result[key] = mergeDeep(
      (base as Record<string, unknown>)[key],
      (overrides as Record<string, unknown>)[key] as never
    );
  }

  return result as T;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
