import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { V6ArtifactStore, v6PublicDataRoot, type ShardIndex } from "./v6-artifact-store";
import { CHANGE_RULES_VERSION, OVERVIEW_MAX_BYTES, assertChangeIdentity, type ChangeOverview, type ChangeOverviewPackage } from "./change-events";

/** Optional until a tested paired package selects this family. Missing never means zero updates. */
export function readV6ChangeOverview(revision:string,slug:string,expected:{recordSha256:string;projectionSha256:string;basisSha256:string},root=v6PublicDataRoot("public-v6-change-overviews")):ChangeOverview|undefined {
  assertChangeIdentity(revision);assertChangeIdentity(slug);
  const file=resolve(root,"sharded/index.json");
  if(!existsSync(file))return undefined;
  const index=JSON.parse(readFileSync(file,"utf8")) as ShardIndex;
  if(index.family!=="public-v6-change-overviews")throw Error("Change overview family mismatch");
  const store=new V6ArtifactStore(root,index);
  const pkg=store.view<ChangeOverviewPackage>(revision);
  if(!pkg)return undefined;
  if(pkg.schemaVersion!=="uapt-v6-change-overviews-v1"||pkg.revision!==revision||pkg.rulesVersion!==CHANGE_RULES_VERSION||pkg.projectionSha256!==expected.projectionSha256||pkg.basisSha256!==expected.basisSha256)throw Error("Change overview package identity mismatch");
  const manifest=store.manifest(revision)!;
  const schools=manifest.root.kind==="object"?manifest.root.entries.find(([key])=>key==="schools")?.[1]:undefined;
  const leaf=schools?.kind==="object"?schools.entries.find(([key])=>key===slug)?.[1]:undefined;
  if(leaf&&(leaf.kind!=="blob"||leaf.bytes>OVERVIEW_MAX_BYTES))throw Error("Oversized or unbounded change overview shard");
  const value=store.field<ChangeOverview>(revision,["schools",slug]);
  if(!value)return undefined;
  if(value.schemaVersion!=="uapt-v6-change-overview-v1"||value.revision!==revision||value.slug!==slug||value.recordSha256!==expected.recordSha256||value.rulesVersion!==CHANGE_RULES_VERSION||value.projectionSha256!==expected.projectionSha256||value.basisSha256!==expected.basisSha256||Buffer.byteLength(JSON.stringify(value),"utf8")>OVERVIEW_MAX_BYTES)throw Error("Stale, foreign or oversized change overview");
  return value;
}
