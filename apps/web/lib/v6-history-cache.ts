import {readFileSync} from 'node:fs';import {resolve} from 'node:path';import {createHash} from 'node:crypto';
import pointer from '../../../data/public-v6-history/current.json';
import {readV6RecordCorrections} from './v6-effective-records';import type {ChangeRecord} from './change-records';
let cached:Record<string,ChangeRecord[]>|undefined;
/** Frozen, complete per-school public histories; no first-visitor global diff calculation. */
export function v6FrozenHistory(slug:string){
 const correction=readV6RecordCorrections();if(!correction||correction.revision!==pointer.basisRevision)return undefined;
 if(!correction.recordRevisions[slug])return undefined;
 if(!cached){const root=resolve(process.cwd(),process.cwd().endsWith('/apps/tulsa-zone')||process.cwd().endsWith('/apps/web')?'../../data/public-v6-history':'data/public-v6-history');const file=resolve(root,pointer.path);if(!file.startsWith(root+'/'))throw Error('Invalid public history path');const raw=readFileSync(file);if(createHash('sha256').update(raw).digest('hex')!==pointer.sha256)throw Error('Frozen public history changed');const value=JSON.parse(raw.toString());if(value.schemaVersion!=='uapt-bounded-public-history-v1'||value.basisRevision!==pointer.basisRevision||Object.keys(value.records).sort().join(',')!==correction.summaries.map(s=>s.entity.slug).sort().join(','))throw Error('Invalid public history identity or scope');cached=value.records;}
 return cached![slug];
}
