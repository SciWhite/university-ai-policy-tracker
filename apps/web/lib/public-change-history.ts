import {existsSync,readFileSync} from "node:fs";
import {resolve} from "node:path";
import pointer from "../../../data/public-change-history/current.json";
import { findRepoRoot } from "./repo-root";
import { publicHistoryBasis, publicHistoryBasisV2 } from "./public-history-basis";
import { readVerifiedArtifact } from "./v6-artifact-store";
import type { ChangeRecord } from "./change-records";
import { CHANGE_RULES_VERSION, assertChangeIdentity, type EventHistory, type EventPreview, type ChangeProjectionInput } from "./change-events";
import type { ReleaseDiff } from "./release-diffs";

export interface HistoryFile { file: string; sha256: string; bytes: number }

export interface HistoryManifest {
  schemaVersion: "uapt-public-change-history-v1" | "uapt-public-change-history-v2";
  revision?: string;
  rulesVersion?: string;
  projectionInput?: HistoryFile;
  eventHistories?: Record<string, HistoryFile>;
  eventIndex?: HistoryFile;
  basisSha256: string;
  entries: Record<string, HistoryFile>;
  releases: Record<string, HistoryFile>;
}

// The published inputs are immutable for a running artifact, as are the existing
// staged dataset and release caches. New releases ship a regenerated projection.
let verifiedBasis: Promise<string> | undefined;
let verifiedEventBasis: Promise<string> | undefined;

export async function historyManifest() {
  const repoRoot = await findRepoRoot();
  verifiedBasis ??= publicHistoryBasis(repoRoot);
  const legacyBasis = await verifiedBasis;
  const root = `${repoRoot}/data/public-change-history`;
  const manifest = readVerifiedArtifact<HistoryManifest>(root, pointer.path, pointer.sha256, 2 * 1024 * 1024);
  const basis = manifest.schemaVersion === "uapt-public-change-history-v2" ? await (verifiedEventBasis ??= publicHistoryBasisV2(repoRoot)) : legacyBasis;
  if (!["uapt-public-change-history-v1", "uapt-public-change-history-v2"].includes(manifest.schemaVersion) || manifest.basisSha256 !== basis) {
    throw new Error("Public change history is out of date; regenerate with scripts/export-public-change-history.ts");
  }
  return { root, manifest };
}

export async function readPublicChangeHistory(slug: string): Promise<ChangeRecord[]> {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return [];
  const { root, manifest } = await historyManifest();
  const entry = Object.hasOwn(manifest.entries, slug) ? manifest.entries[slug] : undefined;
  if (!entry) return [];
  const records = readVerifiedArtifact<ChangeRecord[]>(root, entry.file, entry.sha256, 4 * 1024 * 1024, entry.bytes);
  if (!Array.isArray(records) || records.some(record => record.slug !== slug || !Array.isArray(record.diffRows))) {
    throw new Error("Invalid public change history scope");
  }
  return structuredClone(records);
}

export async function readPublicReleaseDiff(releaseId: string): Promise<ReleaseDiff | undefined> {
  const { root, manifest } = await historyManifest();
  const entry = manifest.releases && Object.hasOwn(manifest.releases, releaseId) ? manifest.releases[releaseId] : undefined;
  if (!entry) return undefined;
  const diff = readVerifiedArtifact<ReleaseDiff>(root, entry.file, entry.sha256, 32 * 1024 * 1024, entry.bytes);
  if (diff.releaseId !== releaseId || !Array.isArray(diff.entities)) throw new Error("Invalid public release diff scope");
  return structuredClone(diff);
}


/** Explicit package identity; never falls back from a missing revision to latest. */
export class ChangeEventStore {
  readonly manifest: HistoryManifest;
  constructor(readonly root: string, readonly ref: {path:string;sha256:string}, expectedBasis?: string) {
    this.manifest = readVerifiedArtifact<HistoryManifest>(root,ref.path,ref.sha256,2*1024*1024);
    if (this.manifest.schemaVersion !== "uapt-public-change-history-v2" || this.manifest.rulesVersion !== CHANGE_RULES_VERSION || !this.manifest.revision || !this.manifest.eventHistories || !this.manifest.projectionInput || !this.manifest.eventIndex || expectedBasis && this.manifest.basisSha256 !== expectedBasis) throw Error("Verified v2 change history unavailable or basis mismatch");
    assertChangeIdentity(this.manifest.revision);
  }
  input(): ChangeProjectionInput {
    const ref=this.manifest.projectionInput!;
    const input=readVerifiedArtifact<ChangeProjectionInput>(this.root,ref.file,ref.sha256,128*1024*1024,ref.bytes);
    if(input.revision!==this.manifest.revision||input.basisSha256!==this.manifest.basisSha256||input.rulesVersion!==CHANGE_RULES_VERSION)throw Error("Projection input identity mismatch");
    return input;
  }
  history(revision:string,slug:string): EventHistory | undefined {
    assertChangeIdentity(revision);assertChangeIdentity(slug);
    if(revision!==this.manifest.revision)throw Error("Change history revision mismatch");
    const ref=Object.hasOwn(this.manifest.eventHistories!,slug)?this.manifest.eventHistories![slug]:undefined;
    if(!ref)return undefined;
    const value=readVerifiedArtifact<EventHistory>(this.root,ref.file,ref.sha256,4*1024*1024,ref.bytes);
    if(value.schemaVersion!=="uapt-school-change-events-v2"||value.revision!==revision||value.slug!==slug||value.rulesVersion!==CHANGE_RULES_VERSION||value.basisSha256!==this.manifest.basisSha256||new Set(value.events.map(e=>e.id)).size!==value.events.length||value.events.some(e=>e.slug!==slug||e.id!==`${slug}:${e.revision}`))throw Error("Change event history identity mismatch");
    return structuredClone(value);
  }
  index(): Array<EventPreview & {slug:string}> {
    const ref=this.manifest.eventIndex!;
    return structuredClone(readVerifiedArtifact<Array<EventPreview & {slug:string}>>(this.root,ref.file,ref.sha256,32*1024*1024,ref.bytes));
  }
}
export async function readChangeEventHistory(revision:string,slug:string) {
  const {root,manifest}=await historyManifest();
  if(manifest.schemaVersion!=="uapt-public-change-history-v2")throw Error("Verified v2 change history unavailable");
  return new ChangeEventStore(root,pointer,manifest.basisSha256).history(revision,slug);
}

/** Explicit projection URLs select only their registered frozen manifest. */
export function selectChangeEventStore(root:string,revision?:string,fallbackRegistry:Record<string,{path:string;sha256:string}>={}) {
  const current=JSON.parse(readFileSync(resolve(root,"current.json"),'utf8'));
  const currentStore=new ChangeEventStore(root,current);
  const file=resolve(root,"revisions.json");
  const registry=existsSync(file)?JSON.parse(readFileSync(file,'utf8')):fallbackRegistry;
  const ref=!revision||revision===currentStore.manifest.revision?current:
    Object.hasOwn(registry,revision)?registry[revision]:undefined;
  if(!ref)return undefined;
  const store=ref===current?currentStore:new ChangeEventStore(root,ref);
  if(revision&&store.manifest.revision!==revision)throw Error("Registered projection revision mismatch");
  return store;
}
