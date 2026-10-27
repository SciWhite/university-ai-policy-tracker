import { createHash } from "node:crypto";
import type { ChangeRecord } from "./change-records";
import type { PublicEntitySummary } from "@uapt/shared";
import type { CorrectionIds } from "./change-presentation";

import {CHANGE_RULES_VERSION,countChangeItems} from "./change-event-rules";
export {CHANGE_RULES_VERSION} from "./change-event-rules";
export const OVERVIEW_MAX_BYTES = 10_240;
export const eventHash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
export type ChangeCategory = "tracker_correction" | "tracker_addition" | "tracker_text_change" | "historical_unclassified" | "held" | "source_update" | "page_update" | "record_maintenance";
export interface ChangeItem {
  id: string;
  category: ChangeCategory;
  theme: string;
  themes?: string[];
  claimId?: string;
  recordKind?: "tool";
  matchMethod: string;
  oldText?: string;
  newText?: string;
  comparison?: "exact_claim_id";
  sourceUrls: string[];
}
export interface ChangeEvent {
  id: string;
  slug: string;
  revision: string;
  previousRevision?: string;
  publishedAt: string | null;
  url: string;
  rulesVersion: typeof CHANGE_RULES_VERSION;
  items: ChangeItem[];
  counts: { added: number; modified: number; held: number; affected: number; toolRecords?: number; unnumberedRecords?: number };
  gaps: string[];
  provenance: { kind: string; sha256: string }[];
}
export interface LegacyEventSource { kind: "legacy" | "record_repair"; record: ChangeRecord }
export interface ScopedEventSource {
  kind: "scoped";
  slug: string;
  revision: string;
  previousRevision?: string;
  publishedAt: string;
  current: PublicEntitySummary;
  before?: PublicEntitySummary;
  held: PublicEntitySummary["claims"];
  changes: CorrectionIds;
  gaps: string[];
  // Explicit presentation/metadata changes are distinct from missing history.
  metadataChanged: boolean;
  /** Explicit tracker presentation change; never a university-policy amendment. */
  pageUpdate?: string;
  claimThemes?: Record<string,string[]>;
}
export type ChangeEventSource = LegacyEventSource | ScopedEventSource;
export interface ChangeProjectionInput {
  schemaVersion: "uapt-change-history-input-v2";
  revision: string;
  basisSha256: string;
  rulesVersion: typeof CHANGE_RULES_VERSION;
  schools: Record<string, {
    currentRecordSha256?: string;
    currentRevision?: string;
    themeOrder?: string[];
    currentClaimIds: string[];
    sources: ChangeEventSource[];
    gaps: string[];
  }>;
}
export interface EventHistory {
  schemaVersion: "uapt-school-change-events-v2";
  revision: string;
  slug: string;
  basisSha256: string;
  rulesVersion: typeof CHANGE_RULES_VERSION;
  currentRecordSha256?: string;
  currentClaimIds: string[];
  themeOrder: string[];
  events: ChangeEvent[];
  coverage: { recordedFrom: string | null; gaps: string[] };
}
export type EventPreview = Pick<ChangeEvent, "id" | "revision" | "publishedAt" | "url" | "counts"> & { categories: ChangeCategory[]; themes: string[] };
export interface ChangeOverview {
  schemaVersion: "uapt-v6-change-overview-v1";
  revision: string;
  slug: string;
  projectionSha256: string;
  basisSha256: string;
  rulesVersion: typeof CHANGE_RULES_VERSION;
  recordSha256: string;
  recordedFrom: string | null;
  themeOrder: string[];
  gaps: string[];
  // Every date is indexed; full text only lives in on-demand event histories.
  timeline: EventPreview[];
}
export interface ChangeOverviewPackage {
  schemaVersion: "uapt-v6-change-overviews-v1";
  revision: string;
  projectionSha256: string;
  basisSha256: string;
  rulesVersion: typeof CHANGE_RULES_VERSION;
  schools: Record<string, ChangeOverview>;
}
const identity = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export function assertChangeIdentity(value: string) {
  if (!identity.test(value)) throw Error("Invalid change identity");
}
function makeEvent(slug: string, revision: string, previousRevision: string | undefined, date: string | undefined): ChangeEvent {
  assertChangeIdentity(slug); assertChangeIdentity(revision);
  return { id: `${slug}:${revision}`, slug, revision, previousRevision, publishedAt: date && Number.isFinite(Date.parse(date)) ? date : null,
    url: `/changes/${revision}/${slug}`, rulesVersion: CHANGE_RULES_VERSION, items: [], counts: {added:0,modified:0,held:0,affected:0}, gaps: [], provenance: [] };
}
function normalize(event: ChangeEvent): ChangeEvent {
  const items = new Map<string, ChangeItem>();
  for (const item of event.items) {
    const prior = items.get(item.id);
    if (prior && eventHash(prior) !== eventHash(item)) throw Error(`Conflicting change item: ${event.id}/${item.id}`);
    items.set(item.id, item);
  }
  event.items = [...items.values()].sort((a,b) => a.id.localeCompare(b.id));
  event.counts = countChangeItems(event.items);
  event.gaps = [...new Set([...event.gaps, ...(!event.publishedAt ? ["publication_date_unknown"] : [])])].sort();
  return event;
}
function scopedEvent(source: ScopedEventSource): ChangeEvent | undefined {
  if (source.current.entity.slug !== source.slug || source.before && source.before.entity.slug !== source.slug) throw Error("Foreign scoped change input");
  const event = makeEvent(source.slug, source.revision, source.previousRevision, source.publishedAt);
  event.gaps.push(...source.gaps);
  if (!source.before) event.gaps.push("previous_record_unavailable");
  const before = new Map(source.before?.claims.map(c => [c.id!, c]) ?? []);
  const current = new Map(source.current.claims.map(c => [c.id!, c]));
  const held = new Map(source.held.map(c => [c.id!, c]));
  const added = new Set(source.changes.addedClaimIds), withdrawn = new Set(source.changes.heldClaimIds);
  const ids = new Set([...added, ...source.changes.updatedClaimIds, ...withdrawn]);
  // Explicit IDs alone must not hide a real content edit omitted by a producer.
  for (const [id, claim] of current) if (!before.has(id) || eventHash(claim) !== eventHash(before.get(id))) ids.add(id);
  if (source.before) for (const id of before.keys()) if (!current.has(id)) ids.add(id);
  for (const id of [...ids].sort()) {
    const old = before.get(id) ?? held.get(id), next = current.get(id);
    let category: ChangeCategory = withdrawn.has(id) ? "held" : !source.before ? "historical_unclassified"
      : !old && next && added.has(id) ? "tracker_addition" : old && next ? "tracker_correction" : "historical_unclassified";
    if (!old && !next) event.gaps.push(`claim_text_unavailable:${id}`);
    if (!next && !withdrawn.has(id)) event.gaps.push(`removal_reason_unclassified:${id}`);
    if (old && next && eventHash(old) === eventHash(next) && !withdrawn.has(id) && !added.has(id)) continue;
    const exact = !!(old && next && old.id === next.id);
    event.items.push({ id:`claim:${id}`, category, theme: source.claimThemes?.[id]?.[0] ?? (next ?? old)?.claimType ?? "other", themes:source.claimThemes?.[id], claimId:id,
      matchMethod: exact ? "claim_id" : "none", oldText:old?.claimText, newText:next?.claimText,
      ...(exact && old!.claimText !== next!.claimText ? {comparison:"exact_claim_id" as const} : {}),
      sourceUrls:[...new Set([...(old?.evidence ?? []), ...(next?.evidence ?? [])].map(e => e.sourceUrl))].sort() });
  }
  const oldSources = new Map(source.before?.officialSources.map(s => [s.sourceUrl,s.snapshotHash]) ?? []);
  if (source.before) {
    const newSources = new Map(source.current.officialSources.map(s => [s.sourceUrl,s.snapshotHash]));
    for (const url of [...new Set([...oldSources.keys(),...newSources.keys()])].sort()) if (oldSources.get(url) !== newSources.get(url)) {
      event.items.push({id:`source:${url}`,category:"source_update",theme:"sources",matchMethod:"none",sourceUrls:[url]});
    }
  }
  if (source.pageUpdate) event.items.push({id:"page-presentation",category:"page_update",theme:"other",matchMethod:"explicit_page_update",newText:source.pageUpdate,sourceUrls:[]});
  if (source.metadataChanged && !event.items.length) event.items.push({id:"record-metadata",category:"record_maintenance",theme:"other",matchMethod:"none",sourceUrls:[]});
  event.provenance.push({kind:source.kind,sha256:eventHash(source)});
  return event.items.length ? normalize(event) : undefined;
}
function legacyEvent(source: LegacyEventSource, slug: string): ChangeEvent | undefined {
  const r = source.record;
  if (r.slug && r.slug !== slug) throw Error("Foreign legacy change input");
  if (!r.releaseId) throw Error("Missing historical revision");
  const event = makeEvent(slug,r.releaseId,r.previousReleaseId,r.lastChangedAt);
  const claims = new Map<string, ChangeItem>();
  for (const row of r.diffRows) {
    // Older scoped display repairs use a minimal row envelope. The enclosing
    // verified school/revision supplies scope, never missing old/new text.
    if (!row.changeType && row.entitySlug === undefined && row.releaseId === undefined && source.kind === "record_repair") {
      event.items.push({id:`historical:${row.claimId ?? eventHash(row)}`,category:"tracker_correction",theme:(row as unknown as {claimType?:string}).claimType??"other",claimId:row.claimId,matchMethod:"none",sourceUrls:[]});
      event.gaps.push("historical_comparison_fields_unavailable");continue;
    }
    if (row.entitySlug !== slug || row.releaseId !== r.releaseId) throw Error(`Foreign diff row scope: ${slug}/${r.releaseId} -> ${row.entitySlug}/${row.releaseId}`);
    if (row.oldClaim?.entitySlug !== undefined && row.oldClaim.entitySlug !== slug || row.newClaim?.entitySlug !== undefined && row.newClaim.entitySlug !== slug) throw Error("Foreign Claim scope");
    const exact = row.matchMethod === "claim_id" && !!row.oldClaim?.claimId && row.oldClaim.claimId === row.newClaim?.claimId;
    const approx = !!(row.oldClaim && row.newClaim && !exact);
    if (approx) event.gaps.push("approximate_match_not_identity");
    if (row.oldClaim || row.newClaim) {
      const sides = approx ? [{old:row.oldClaim,next:undefined},{old:undefined,next:row.newClaim}] : [{old:row.oldClaim,next:row.newClaim}];
      for (const side of sides) {
        const c = side.next ?? side.old!;
        const id = c.claimId;
        const key = `claim:${id ?? eventHash(c)}${approx ? side.next ? ":current" : ":previous" : ""}`;
        const category: ChangeCategory = approx ? "historical_unclassified" : row.changeType === "claim_added" ? "tracker_addition" : source.kind === "record_repair" || r.publicationKind === "scoped_record_correction" ? "tracker_correction" : row.changeType === "claim_modified" && exact && side.old?.claimText !== side.next?.claimText ? "tracker_text_change" : "historical_unclassified";
        const item: ChangeItem = {id:key,category,theme:c.claimType,claimId:id,matchMethod:row.matchMethod,
          ...(!id && ["ai_tool_treatment","institutional_ai_service"].includes(c.claimType) ? {recordKind:"tool" as const} : {}),
          oldText:side.old?.claimText,newText:side.next?.claimText,
          ...(exact && side.old?.claimText !== side.next?.claimText ? {comparison:"exact_claim_id" as const} : {}),
          sourceUrls:[...new Set([...(side.old?.evidence ?? []),...(side.next?.evidence ?? [])].map(e=>e.sourceUrl))].sort()};
        const prev = claims.get(key);
        // Claim/evidence rows repeat a single Claim. Conflicting text is never resolved by order.
        if (prev && (prev.oldText !== item.oldText || prev.newText !== item.newText)) throw Error(`Conflicting historical Claim text: ${key}`);
        if (!prev || category !== "historical_unclassified") claims.set(key,item);
      }
    } else {
      const category: ChangeCategory = row.changeType.startsWith("source_") ? "source_update" : "historical_unclassified";
      const key=`${row.changeType}:${row.sourceUrl ?? eventHash(row)}`;
      event.items.push({id:key,category,theme:category === "source_update" ? "sources" : "other",matchMethod:row.matchMethod,sourceUrls:row.sourceUrl?[row.sourceUrl]:[]});
    }
  }
  event.items.push(...claims.values());
  // Opaque scoped counts are not converted into reconstructed policy text or guessed reasons.
  if (!event.items.length && (r.added || r.modified || r.removed || r.sourceAdded || r.sourceRemoved || r.sourceSnapshotChanged)) {
    event.items.push({id:"historical-record",category:"historical_unclassified",theme:"other",matchMethod:"none",sourceUrls:[]});
    event.gaps.push("historical_items_unavailable");
  }
  event.provenance.push({kind:source.kind,sha256:eventHash(source)});
  return event.items.length ? normalize(event) : undefined;
}
export function buildEventHistories(input: ChangeProjectionInput): Record<string, EventHistory> {
  if (input.schemaVersion !== "uapt-change-history-input-v2" || input.rulesVersion !== CHANGE_RULES_VERSION || !/^[a-f0-9]{64}$/.test(input.basisSha256)) throw Error("Unknown event rules or invalid projection basis");
  assertChangeIdentity(input.revision);
  const histories: Record<string, EventHistory> = {};
  for (const [slug, school] of Object.entries(input.schools).sort(([a],[b])=>a.localeCompare(b))) {
    assertChangeIdentity(slug);
    if (new Set(school.currentClaimIds).size !== school.currentClaimIds.length) throw Error("Duplicate current Claim IDs");
    const events = new Map<string,ChangeEvent>();
    for (const source of school.sources) {
      const event = source.kind === "scoped" ? scopedEvent(source) : legacyEvent(source,slug);
      if (!event) continue;
      const prior = events.get(event.id);
      if (prior) {
        // Frozen V6 Chain is authoritative for its own revision; legacy rows remain provenance.
        const scoped = event.provenance[0].kind === "scoped", priorScoped = prior.provenance.some(p=>p.kind === "scoped");
        if (scoped !== priorScoped) {
          const selected = scoped ? event : prior;
          for(const a of prior.items)for(const b of event.items)if(a.claimId&&a.claimId===b.claimId){
            if(a.oldText!==undefined&&b.oldText!==undefined&&a.oldText!==b.oldText||a.newText!==undefined&&b.newText!==undefined&&a.newText!==b.newText)throw Error(`Conflicting event Claim text: ${event.id}/${a.claimId}`);
          }
          selected.provenance = [...prior.provenance,...event.provenance];
          events.set(event.id,selected);continue;
        }
        const core = (e:ChangeEvent)=>({...e,provenance:[]});
        if (eventHash(core(prior)) !== eventHash(core(event))) throw Error(`Conflicting event inputs: ${event.id}`);
        prior.provenance.push(...event.provenance);
      } else events.set(event.id,event);
    }
    const ordered = [...events.values()].sort((a,b)=>(Date.parse(b.publishedAt??"")||0)-(Date.parse(a.publishedAt??"")||0)||a.id.localeCompare(b.id));
    const dates = ordered.flatMap(e=>e.publishedAt?[e.publishedAt]:[]).sort((a,b)=>Date.parse(a)-Date.parse(b));
    histories[slug]={schemaVersion:"uapt-school-change-events-v2",revision:input.revision,slug,basisSha256:input.basisSha256,rulesVersion:CHANGE_RULES_VERSION,
      currentRecordSha256:school.currentRecordSha256,currentClaimIds:[...school.currentClaimIds].sort(),themeOrder:school.themeOrder??[],events:ordered,
      coverage:{recordedFrom:dates[0]??null,gaps:[...new Set([...school.gaps,...ordered.flatMap(e=>e.gaps)])].sort()}};
  }
  return histories;
}
export function eventPreview(event: ChangeEvent): EventPreview {
  return {id:event.id,revision:event.revision,publishedAt:event.publishedAt,url:event.url,counts:event.counts,
    categories:[...new Set(event.items.map(i=>i.category))].sort(),themes:[...new Set(event.items.flatMap(i=>i.themes??[i.theme]))].sort()};
}
export function buildChangeOverview(history: EventHistory, projectionSha256: string): ChangeOverview {
  if (!history.currentRecordSha256) throw Error("V6 overview requires exact current record basis");
  const overview:ChangeOverview={schemaVersion:"uapt-v6-change-overview-v1",revision:history.revision,slug:history.slug,projectionSha256,basisSha256:history.basisSha256,rulesVersion:history.rulesVersion,
    recordSha256:history.currentRecordSha256,recordedFrom:history.coverage.recordedFrom,themeOrder:history.themeOrder,gaps:history.coverage.gaps,timeline:history.events.map(eventPreview)};
  if (Buffer.byteLength(JSON.stringify(overview),"utf8") + 1 > OVERVIEW_MAX_BYTES) throw Error(`Change overview exceeds ${OVERVIEW_MAX_BYTES} bytes: ${history.slug}`);
  return overview;
}
export function overviewWindow(overview: ChangeOverview, start: string, end: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || start>end || !Number.isFinite(Date.parse(start)) || !Number.isFinite(Date.parse(end)) || new Date(start).toISOString().slice(0,10)!==start || new Date(end).toISOString().slice(0,10)!==end) throw Error("Invalid UTC date interval");
  const matches=overview.timeline.filter(e=>e.publishedAt && new Date(e.publishedAt).toISOString().slice(0,10)>=start && new Date(e.publishedAt).toISOString().slice(0,10)<=end);
  return {count:matches.length,previews:matches.slice(0,3),earlierUnrecorded:!overview.recordedFrom||start<new Date(overview.recordedFrom).toISOString().slice(0,10)};
}
