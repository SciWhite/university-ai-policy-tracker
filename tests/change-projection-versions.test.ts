import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {changeEventsResponse} from '../apps/web/lib/change-events-api';
import {eventIndexResponse} from '../apps/web/lib/change-index-events-api';
import {ChangeEventStore} from '../apps/web/lib/public-change-history';
import projections from '../data/public-change-history/revisions.json';
import {resolve} from 'node:path';
process.env.UAPT_V6_PUBLISHED_PAGES='1';process.env.UAPT_DISABLE_INTERNAL_FETCH='1';
const current=JSON.parse(readFileSync('data/public-change-history/current.json','utf8'));
test('explicit historical projection URLs retain their frozen histories, overview and index after selection changes',async()=>{
 for(const [revision,ref] of Object.entries(projections)){
  const store=new ChangeEventStore(resolve('data/public-change-history'),ref),slug='ucl';
  const history=await changeEventsResponse(new Request('https://eduaipolicy.org/'),{revision,slug});assert.equal(history.status,200);
  const observed=await history.json();assert.equal(observed.revision,revision);assert.deepEqual(observed.events.map((e:any)=>e.id),store.history(revision,slug)!.events.map(e=>e.id));
  const overview=await changeEventsResponse(new Request('https://eduaipolicy.org/'),{revision,slug,kind:'overview'});assert.equal(overview.status,200);assert.equal((await overview.json()).projectionSha256,ref.sha256);
  const index=await eventIndexResponse(new Request('https://eduaipolicy.org/?kind=all'),revision,'latest');assert.equal(index.status,200);const rows=await index.json();assert.equal(rows.revision,revision);assert.equal(rows.projectionSha256,ref.sha256);
 }
 assert(Object.values(projections).some(ref=>ref.sha256!==current.sha256));
});
test('an unregistered projection never silently returns current history',async()=>{
 const response=await changeEventsResponse(new Request('https://eduaipolicy.org/'),{revision:'unregistered-history',slug:'ucl'});assert.equal(response.status,409);
});
