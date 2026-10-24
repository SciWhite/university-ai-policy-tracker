import {SchoolChangeHistoryPage} from "@/components/change-history-pages";
import {changeHistoryMetadata} from "@/lib/change-history-view";
import { localizeSurfaceTree } from "@/lib/surface-localization";
import { changesUi, changeSummaryText } from "@/lib/changes-ui";
import { exactClaimDiffLines, hasRecordedChanges } from "@/lib/change-presentation";
import Link from "next/link";
import { notFound } from "next/navigation";
import { NO_ADVICE_BOUNDARY } from "@uapt/shared";
import { DiffBlock } from "@/components/diff-block";
import { MetaLabel } from "@/components/meta-label";
import { ReferenceBox } from "@/components/reference-box";
import { StateLabel } from "@/components/state-label";
import { JsonLd } from "@/components/json-ld";
import {
  getEntityChangeHistory,
  getReleaseChangeRecords,
  type ChangeRecord
} from "@/lib/change-records";
import { normalizeLocale, type SupportedLocale } from "@/lib/i18n";
import { getLocalizedInstitutionName } from "@/lib/institution-localization";
import { getKnownReleaseIds } from "@/lib/release-diffs";
import { getAbsoluteSiteUrl } from "@/lib/site-url";
import { redirectAliasSlugPage } from "@/lib/entity-alias-redirect";
import { getLocalizedAlternates } from "@/lib/i18n-metadata";
import { formatDateMedium } from "@/lib/format-date";
import { currentMonthlyReportPath } from "@/lib/reports";

interface ChangeDetailPageProps {
  params: Promise<{
    locale?: string;
    releaseId: string;
  }>;
}

export const dynamic = "force-static";
export const dynamicParams = true;
export const revalidate = false;

export async function generateStaticParams() {
  const releaseIds = await getKnownReleaseIds();

  return releaseIds.map((releaseId) => ({ releaseId }));
}

export async function generateMetadata({ params }: ChangeDetailPageProps) {
  const { locale: localeParam, releaseId } = await params;
  const locale = normalizeLocale(localeParam);
  await redirectAliasSlugPage(releaseId, locale, (slug) => `/changes/${slug}`);
  const eventMetadata=await changeHistoryMetadata(releaseId,locale);
  if(eventMetadata)return eventMetadata;
  const releaseRecords = await getReleaseChangeRecords(releaseId);
  if (releaseRecords) {
    const canonical = getAbsoluteSiteUrl(`/changes/${releaseId}`);
    const changedCount = releaseRecords.filter(hasRecordedChanges).length;

    return {
      title: `University AI Policy Tracker Release Diff: ${releaseId}`,
      description: `${changedCount} university tracker records have release diff rows in ${releaseId}.`,
      alternates: getLocalizedAlternates(`/changes/${releaseId}`, "en"),
      openGraph: {
        title: `University AI Policy Tracker Release Diff: ${releaseId}`,
        description: `${changedCount} university tracker records have release diff rows in ${releaseId}.`,
        url: canonical,
        type: "article"
      }
    };
  }

  const history = await getEntityChangeHistory(releaseId, locale);
  const canonical = getAbsoluteSiteUrl(`/changes/${releaseId}`);
  const displayName = history
    ? getLocalizedInstitutionName(history.record.slug, history.record.name, locale)
    : undefined;
  const title = history
    ? getEntityHistoryTitle(displayName, history.record)
    : "Change record not found";
  const description = history
    ? getEntityHistoryMetaDescription(history.record, history.releaseRecords, locale)
    : "University AI Policy Tracker change record not found.";

  return {
    title,
    description,
    alternates: getLocalizedAlternates(`/changes/${releaseId}`, "en"),
    openGraph: {
      title,
      description,
      url: canonical,
      type: "article"
    }
  };
}

export default async function ChangeDetailPage({
  params
}: ChangeDetailPageProps) {
  const { locale: localeParam, releaseId } = await params;
  const locale = normalizeLocale(localeParam);
  await redirectAliasSlugPage(releaseId, locale, (slug) => `/changes/${slug}`);
  const eventPage=await SchoolChangeHistoryPage({slug:releaseId,locale});
  if(eventPage)return eventPage;
  const recordsForRelease = await getReleaseChangeRecords(releaseId);
  if (recordsForRelease) {
    return (
      <ReleaseOverviewPage
        locale={locale}
        records={recordsForRelease}
        releaseId={releaseId}
      />
    );
  }

  const history = await getEntityChangeHistory(releaseId, locale);

  if (!history) notFound();
  const { record, releaseRecords } = history;
  const displayName = getLocalizedInstitutionName(record.slug, record.name, locale);
  const summaryText = getSummaryText(record, locale);
  const diffLines = exactClaimDiffLines(record);
  const summary = changeSummaryText(record.changeSummary, locale, history.summaryLanguage);
  const canonical = getAbsoluteSiteUrl(`/changes/${record.slug}`);

  return localizeSurfaceTree(
    <main className="page-shell page-shell--wide">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: `${displayName} AI policy change history`,
          description: summaryText,
          url: canonical,
          dateModified: record.lastChangedAt ?? record.lastCheckedAt,
          isPartOf: {
            "@type": "WebSite",
            name: "University AI Policy Tracker",
            url: getAbsoluteSiteUrl("/")
          },
          mainEntity: {
            "@type": "Dataset",
            name: `${displayName} source-backed AI policy change history`,
            description: summaryText,
            url: canonical,
            isAccessibleForFree: true,
            distribution: {
              "@type": "DataDownload",
              name: `${displayName} public university JSON record`,
              encodingFormat: "application/json",
              contentUrl: record.publicJsonUrl
            }
          }
        }}
      />
      {record.publicationKind === "scoped_record_correction" ? (
        <div className="notice-card">
          {summary ? <p data-i18n="preserve" lang={summary.language}>{summary.text}</p> : null}
          <p>{changesUi("Tracker correction published: {0}. This is not a university policy effective date.", locale, record.lastChangedAt ? formatDateMedium(record.lastChangedAt, locale) : "—")}</p>
        </div>
      ) : null}
      <section className="entity-header">
        <div className="entity-header__main">
          <p className="entity-header__eyebrow">Change log</p>
          <h1 data-i18n="preserve">{displayName}</h1>
          <p className="entity-header__summary">
            {getEntityHistoryLead(record, releaseRecords.length, locale)}
          </p>
          <div className="entity-header__metadata">
            <StateLabel locale={locale} reviewState={record.reviewState} />
            {record.lastCheckedAt ? (
              <MetaLabel label="Last checked">
                {formatDateMedium(record.lastCheckedAt, locale)}
              </MetaLabel>
            ) : null}
            {record.lastChangedAt ? (
              <MetaLabel label="Last changed">
                {formatDateMedium(record.lastChangedAt, locale)}
              </MetaLabel>
            ) : null}
            <MetaLabel label="Claims">{record.claimCount}</MetaLabel>
            <MetaLabel label="Sources">{record.sourceCount}</MetaLabel>
            {record.releaseId ? (
              <MetaLabel label="Latest release">{record.releaseId}</MetaLabel>
            ) : null}
            <MetaLabel label="Release records">{releaseRecords.length}</MetaLabel>
          </div>
        </div>
        <div className="entity-header__actions">
          <Link locale={false} className="site-action" href={record.universityUrl}>
            University page
          </Link>
          <a className="site-action" href={record.publicJsonUrl}>
            Public JSON
          </a>
          <Link locale={false} className="site-action" href={currentMonthlyReportPath}>
            Monthly report
          </Link>
          <Link locale={false} className="site-action" href="/universities">
            University index
          </Link>
        </div>
      </section>

      <div className="entity-record-layout">
        <div className="entity-record-main">
          <ReferenceBox
            description="Current public record freshness and review state."
            title="Change summary"
          >
            <p>{summaryText}</p>
            <p className="notice-card">
              This page combines all public release diffs for{" "}
              <span data-i18n="preserve">{displayName}</span>. Individual release snapshots remain available from
              their release-specific URLs.
            </p>
            {!diffLines.length ? (
              <p className="notice-card">
                {changesUi(hasRecordedChanges(record) || releaseRecords.some(hasRecordedChanges)
                  ? "Recorded updates are available; a comparable before-and-after text preview is not available for this revision."
                  : "No recorded updates are available in this tracker history.", locale)}
              </p>
            ) : null}
            <p className="notice-card">{NO_ADVICE_BOUNDARY}</p>
            <p className="notice-card">
              Newly extracted claims are tracker additions and are not
              necessarily newly published by the university. Source snapshot
              changes show hash changes for the same source URL and are not by
              themselves policy changes.
            </p>
          </ReferenceBox>

          <ReferenceBox
            description="Semantic classification for this release diff."
            title="Diff categories"
          >
            <div className="tag-row">
              <MetaLabel label="Tracker claim text">
                {record.policyTextChanged}
              </MetaLabel>
              <MetaLabel label="Newly extracted">
                {record.newlyExtractedClaims}
              </MetaLabel>
              <MetaLabel label="Evidence">{record.evidenceChanged}</MetaLabel>
              <MetaLabel label="Source snapshots">
                {record.sourceSnapshotChanged}
              </MetaLabel>
              <MetaLabel label="Source text">
                {record.sourceTextChanged}
              </MetaLabel>
              <MetaLabel label="Source added">{record.sourceAdded}</MetaLabel>
              <MetaLabel label="Source removed">{record.sourceRemoved}</MetaLabel>
            </div>
          </ReferenceBox>

          <ReferenceBox
            description="Only recorded comparisons with an exact Claim ID match are shown."
            title="Recorded text comparisons"
          >
            {diffLines.length ? (
              <DiffBlock
                description={changesUi("Exact Claim ID comparisons from recorded releases.", locale)}
                lines={diffLines}
                title={`${displayName} combined release diff`}
              />
            ) : (
              <p className="notice-card">
                {changesUi(hasRecordedChanges(record) || releaseRecords.some(hasRecordedChanges)
                  ? "Recorded updates are available; a comparable before-and-after text preview is not available for this revision."
                  : "No recorded updates are available in this tracker history.", locale)}
              </p>
            )}
          </ReferenceBox>

          <section className="record-section">
            <div className="section-heading">
              <h2>Release history</h2>
              <p>{changesUi("Tracker history: {0} release records.", locale, releaseRecords.length)}</p>
            </div>
            <div className="source-attribution-list">
              {releaseRecords.map((releaseRecord) => (
                <article
                  className="source-attribution-row"
                  key={`${releaseRecord.releaseId}:${releaseRecord.slug}`}
                >
                  <div>
                    <h3>{releaseRecord.releaseId}</h3>
                    <p>
                      {releaseRecord.previousReleaseId
                        ? `Compared with ${releaseRecord.previousReleaseId}.`
                        : "Initial tracked release."}
                    </p>
                    <div className="tag-row">
                      <MetaLabel label="Tracker claim text">
                        {releaseRecord.policyTextChanged}
                      </MetaLabel>
                      <MetaLabel label="Newly extracted">
                        {releaseRecord.newlyExtractedClaims}
                      </MetaLabel>
                      <MetaLabel label="Source snapshots">
                        {releaseRecord.sourceSnapshotChanged}
                      </MetaLabel>
                      <MetaLabel label="Source text">
                        {releaseRecord.sourceTextChanged}
                      </MetaLabel>
                    </div>
                  </div>
                  <div className="tag-row">
                    {releaseRecord.releaseId ? (
                      <Link locale={false} href={`/changes/${releaseRecord.releaseId}/${record.slug}`}>
                        Release diff
                      </Link>
                    ) : null}
                    {releaseRecord.releaseId ? (
                      <a
                        href={`/api/public/v1/changes/${releaseRecord.releaseId}/${record.slug}.json`}
                      >
                        Diff JSON
                      </a>
                    ) : null}
                  </div>
                  {exactClaimDiffLines(releaseRecord).length ? (
                    <DiffBlock
                      description={changesUi("Comparing {0} to {1}.", locale, releaseRecord.previousReleaseId ?? "—", releaseRecord.releaseId ?? "—")}
                      lines={exactClaimDiffLines(releaseRecord)}
                      title={`${displayName} ${releaseRecord.releaseId} diff`}
                    />
                  ) : null}
                </article>
              ))}
            </div>
          </section>

          <section className="record-section">
            <div className="section-heading">
              <h2>Current claim records</h2>
              <p>{changesUi("Current claim records: {0}.", locale, record.claimChanges.length)}</p>
            </div>
            <div className="source-attribution-list">
              {record.claimChanges.map((claim) => (
                <article
                  className="source-attribution-row"
                  key={claim.claimId ?? claim.claimText}
                >
                  <div>
                    <h3>{claim.claimType}</h3>
                    <p data-i18n="preserve">{claim.claimText}</p>
                  </div>
                  <div className="tag-row">
                    <StateLabel locale={locale} reviewState={claim.reviewState} />
                    <MetaLabel label="Confidence">
                      {Math.round(claim.confidence * 100)}%
                    </MetaLabel>
                    <MetaLabel label="Evidence">{claim.evidenceCount}</MetaLabel>
                    {claim.sourceLanguages.length ? (
                      <MetaLabel label="Languages">
                        {claim.sourceLanguages.join(", ")}
                      </MetaLabel>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="record-section">
            <div className="section-heading">
              <h2>Source snapshots</h2>
              <p>{changesUi("Official source records: {0}.", locale, record.sourceChanges.length)}</p>
            </div>
            <div className="source-attribution-list">
              {record.sourceChanges.map((source) => (
                <article
                  className="source-attribution-row"
                  key={`${source.sourceUrl}:${source.snapshotHash}`}
                >
                  <div>
                    <h3 data-i18n="preserve">{source.citationTitle}</h3>
                    <p className="muted">
                      {source.sourceType ?? "official source"}{" "}
                      {formatSourceFreshness(source, locale)}
                    </p>
                  </div>
                  <dl className="source-attribution-row__meta">
                    <div>
                      <dt>Source URL</dt>
                      <dd>
                        <a href={source.sourceUrl}>{source.sourceUrl}</a>
                      </dd>
                    </div>
                    <div>
                      <dt>Snapshot hash</dt>
                      <dd className="hash-value">{source.snapshotHash}</dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
          </section>
        </div>

        <aside className="entity-sidebar">
          <ReferenceBox title="Diff record">
            <div className="tag-row">
              <MetaLabel label="Reviewed claims">
                {record.reviewedClaimCount}
              </MetaLabel>
              <MetaLabel label="Candidate claims">
                {record.candidateClaimCount}
              </MetaLabel>
              <MetaLabel label="Tracker claim text">
                {record.policyTextChanged}
              </MetaLabel>
              <MetaLabel label="Newly extracted">
                {record.newlyExtractedClaims}
              </MetaLabel>
              <MetaLabel label="Source hash">
                {record.sourceSnapshotChanged}
              </MetaLabel>
            </div>
            <ul className="compact-list">
              <li>
                <Link locale={false} href="/changes">All changes</Link>
              </li>
              <li>
                <Link locale={false} href={record.universityUrl}>University record</Link>
              </li>
              <li>
                <Link locale={false} href={currentMonthlyReportPath}>Monthly report</Link>
              </li>
              <li>
                <Link locale={false} href="/universities">University index</Link>
              </li>
              <li>
                <a href={record.publicJsonUrl}>Versioned public JSON</a>
              </li>
            </ul>
          </ReferenceBox>
        </aside>
      </div>
    </main>, locale
  );
}

function ReleaseOverviewPage({
  locale,
  records,
  releaseId
}: {
  locale: SupportedLocale;
  records: ChangeRecord[];
  releaseId: string;
}) {
  const changedRecords = records.filter(hasRecordedChanges);

  return localizeSurfaceTree(
    <main className="page-shell page-shell--wide">
      {records[0]?.publicationKind === "scoped_record_correction" ? <p className="notice-card" data-i18n="preserve">Tracker audit correction: {typeof records[0].changeSummary === "object" && records[0].changeSummary !== null ? ((records[0].changeSummary as any)[locale] || (records[0].changeSummary as any).en) : records[0].changeSummary} This is a scoped tracker correction, not a newly established university policy publication or effective date. Historical global releases remain unchanged.</p> : null}
      <section className="hero">
        <p className="kicker">Release diff</p>
        <h1>University AI Policy Tracker Release Diff: {releaseId}</h1>
        <p className="lead">
          Release-to-release tracker changes. Comparable tracker claim text changes,
          newly extracted claims, and source snapshot changes are counted
          separately.
        </p>
      </section>

      <section className="metrics-grid" aria-label="Release diff summary">
        <div>
          <span>{changedRecords.length}</span>
          <p>records with tracker diff rows</p>
        </div>
        <div>
          <span>
            {changedRecords.reduce((total, record) => total + record.policyTextChanged, 0)}
          </span>
          <p>tracker claim text changes</p>
        </div>
        <div>
          <span>
            {changedRecords.reduce((total, record) => total + record.newlyExtractedClaims, 0)}
          </span>
          <p>newly extracted claims</p>
        </div>
        <div>
          <span>
            {changedRecords.reduce((total, record) => total + record.sourceSnapshotChanged, 0)}
          </span>
          <p>source snapshot changes</p>
        </div>
      </section>

      <section className="section">
        <div className="section-heading">
          <h2>Changed universities</h2>
          <p>{changedRecords.length} records with release diff rows.</p>
        </div>
        <div className="source-attribution-list">
          {changedRecords.map((record) => (
            <article className="source-attribution-row" key={record.slug}>
              <div>
                <h3>{getLocalizedInstitutionName(record.slug, record.name, locale)}</h3>
                <p>
                  Policy text {record.policyTextChanged}; newly extracted{" "}
                  {record.newlyExtractedClaims}; source snapshots{" "}
                  {record.sourceSnapshotChanged}
                </p>
              </div>
              <div className="tag-row">
                <Link locale={false} href={`/changes/${releaseId}/${record.slug}`}>
                  Release diff
                </Link>
                <Link locale={false} href={`/changes/${record.slug}`}>University history</Link>
                <Link locale={false} href={record.universityUrl}>University page</Link>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>, locale
  );
}

function getEntityHistoryMetaDescription(
  record: ChangeRecord,
  releaseRecords: ChangeRecord[],
  locale: SupportedLocale
): string {
  const displayName = getLocalizedInstitutionName(record.slug, record.name, locale);
  const checkedText = record.lastCheckedAt
    ? ` Last checked ${formatDateMedium(record.lastCheckedAt, locale)}.`
    : "";

  if (releaseRecords.length > 0 && record.diffRows.length > 0) {
    return `${displayName} AI policy change history with ${releaseRecords.length} public release diff ${pluralize("record", releaseRecords.length)}, ${record.policyTextChanged} tracker claim text changes, ${record.newlyExtractedClaims} newly extracted claims, source freshness, and public JSON.${checkedText}`;
  }

  return `${displayName} source-backed AI policy change history with ${record.claimCount} claim ${pluralize("record", record.claimCount)}, ${record.sourceCount} official source ${pluralize("attribution", record.sourceCount)}, review state, source freshness, and public JSON.${checkedText}`;
}

function getEntityHistoryTitle(
  displayName: string | undefined,
  record: ChangeRecord
): string {
  if (record.diffRows.length > 0) {
    return `${displayName} AI Policy Change History | University AI Policy Tracker`;
  }

  return `${displayName} AI Policy Source History | University AI Policy Tracker`;
}

function getEntityHistoryLead(
  _record: ChangeRecord,
  releaseRecordCount: number,
  locale: SupportedLocale
): string {
  return changesUi("Tracker history: {0} release records.", locale, releaseRecordCount);
}

function getSummaryText(record: ChangeRecord, locale: SupportedLocale): string {
  return changesUi("{0} current claims; {1} official sources.", locale, record.claimCount, record.sourceCount);
}

function pluralize(label: string, count: number): string {
  return count === 1 ? label : `${label}s`;
}

function formatTimestamp(value: string, locale: SupportedLocale): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC"
  }).format(new Date(value));
}

function formatSourceFreshness(source: {
  retrievedAt?: string;
  sourceLastModified?: string;
  trackerCheckedAt?: string;
}, locale: SupportedLocale): string {
  if (source.sourceLastModified) {
    return changesUi("Source Last-Modified {0}", locale, formatTimestamp(source.sourceLastModified, locale));
  }

  const checkedAt = source.trackerCheckedAt ?? source.retrievedAt;
  return checkedAt ? changesUi("Tracker checked at {0}", locale, formatTimestamp(checkedAt, locale)) : "";
}
