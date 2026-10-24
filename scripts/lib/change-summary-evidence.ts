import {eventHash,type ChangeEvent,type ChangeProjectionInput} from '../../apps/web/lib/change-events';
import {primaryChangeCategory} from '../../apps/web/lib/change-event-rules';

export interface FrozenSummaryQuote {
  sourceUrl:string;sourceSnapshotHash?:string;evidenceSnippet:string;snippetLocation?:string;sourceLanguage?:string;retrievedAt?:string;
}
export interface SummaryEvidenceRow {
  itemId:string;claimId?:string;claimText:string;side:'old'|'new';quotes:FrozenSummaryQuote[];issues:string[];
}
/** Read ONLY the matching frozen revision. Text similarity never establishes object identity. */
export function collectSummaryEvidence(event:ChangeEvent,input:ChangeProjectionInput):SummaryEvidenceRow[]{
  const sources=input.schools[event.slug]?.sources.filter(source=>(source.kind==='scoped'?source.revision:source.record.releaseId)===event.revision)??[];
  return event.items.filter(item=>primaryChangeCategory(item.category)).map(item=>{
    const side=item.newText===undefined?'old':'new',claimText=item.newText??item.oldText??'';
    const candidates:Array<{id?:string;claimId?:string;claimText?:string;evidence?:FrozenSummaryQuote[]}> = [];
    for(const source of sources){
      if(source.kind==='scoped')candidates.push(...(side==='new'?source.current.claims:[...(source.before?.claims??[]),...source.held]));
      else for(const row of source.record.diffRows){const claim=side==='new'?row.newClaim:row.oldClaim;if(claim)candidates.push(claim);}
    }
    const quotes=new Map<string,FrozenSummaryQuote>();
    for(const candidate of candidates){
      const id=candidate.id??candidate.claimId;
      const matches=item.claimId?id===item.claimId:item.id===`claim:${eventHash(candidate)}`||item.id===`claim:${eventHash(candidate)}:current`||item.id===`claim:${eventHash(candidate)}:previous`;
      if(!matches||candidate.claimText!==claimText)continue;
      for(const q of candidate.evidence??[]){
        if(!q.evidenceSnippet?.trim()||!item.sourceUrls.includes(q.sourceUrl))continue;
        const value:FrozenSummaryQuote={sourceUrl:q.sourceUrl,evidenceSnippet:q.evidenceSnippet,
          ...(q.sourceSnapshotHash?{sourceSnapshotHash:q.sourceSnapshotHash}:{}),...(q.snippetLocation?{snippetLocation:q.snippetLocation}:{}),
          ...(q.sourceLanguage?{sourceLanguage:q.sourceLanguage}:{}),...(q.retrievedAt?{retrievedAt:q.retrievedAt}:{})};
        quotes.set(eventHash(value),value);
      }
    }
    return {itemId:item.id,...(item.claimId?{claimId:item.claimId}:{}),claimText,side,quotes:[...quotes.values()],issues:checkSummaryModality(claimText,[...quotes.values()])};
  });
}
/** Conservative screening, not semantic approval: context, scope, negation and translations still need review. */
export function checkSummaryModality(claimText:string,quotes:FrozenSummaryQuote[]):string[]{
  if(!quotes.length)return ['frozen_excerpt_unavailable'];
  const source=quotes.map(q=>q.evidenceSnippet).join('\n');
  const strong=/\b(?:must|required|requires|mandatory|shall|prohibit(?:s|ed|ion)?|forbid(?:s|den)?)\b/i;
  const ban=/\b(?:must not|prohibit(?:s|ed|ion)?|forbid(?:s|den)?)\b/i;
  const issues:string[]=[];
  if(ban.test(claimText)&&!ban.test(source))issues.push('possible_ban_strengthening_against_excerpt');
  if(strong.test(claimText)&&!strong.test(source))issues.push('possible_obligation_strengthening_against_excerpt');
  if(/students must not use AI during exams or assessments/i.test(claimText)&&/should not use AI during exams or assessments/i.test(source))issues.push('assessment_must_not_conflicts_with_should_not_excerpt');
  return issues;
}
