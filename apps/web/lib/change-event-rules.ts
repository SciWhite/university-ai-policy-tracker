import type {ChangeEvent,ChangeItem} from "./change-events";

/** Browser-safe rules shared by projection, filters and count labels. */
export const CHANGE_RULES_VERSION = "tracker-events-1.2.0";
export const primaryChangeCategory=(category:string)=>!["source_update","page_update","record_maintenance"].includes(category);

/** Count explicit Claims once. Legacy tool objects retain their own identity, never a guessed Claim ID. */
export function countChangeItems(items:ChangeItem[]):ChangeEvent["counts"]{
  const claims=items.filter(item=>Boolean(item.claimId));
  const ids=(category:string)=>new Set(claims.filter(item=>item.category===category).map(item=>item.claimId!));
  const held=ids("held"),added=ids("tracker_addition");
  const modified=new Set(claims.filter(item=>["tracker_correction","tracker_text_change"].includes(item.category)).map(item=>item.claimId!));
  const standalone=items.filter(item=>!item.claimId&&primaryChangeCategory(item.category));
  const tools=new Set(standalone.filter(item=>item.recordKind==="tool").map(item=>item.id));
  const unnumbered=new Set(standalone.filter(item=>item.recordKind!=="tool").map(item=>item.id));
  return {affected:new Set(claims.map(item=>item.claimId!)).size+tools.size+unnumbered.size,held:held.size,
    added:[...added].filter(id=>!held.has(id)).length,
    modified:[...modified].filter(id=>!held.has(id)&&!added.has(id)).length,
    ...(tools.size?{toolRecords:tools.size}:{}),
    ...(unnumbered.size?{unnumberedRecords:unnumbered.size}:{})};
}
