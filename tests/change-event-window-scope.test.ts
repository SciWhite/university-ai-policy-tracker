import test from 'node:test';import assert from 'node:assert/strict';
import {scopedEventWindow} from '../scripts/validate-change-event-projection';
test('scoped acceptance reproduces the global recent/RSS limit before selecting affected schools',()=>{
 const rows=[{id:'a1',slug:'affected',publishedAt:'2026-10-25T03:00:00Z'},{id:'b1',slug:'unchanged',publishedAt:'2026-10-25T02:00:00Z'},{id:'a2',slug:'affected',publishedAt:'2026-10-25T01:00:00Z'}];
 const w={start:'2026-10-25T00:00:00Z',end:'2026-10-25T04:00:00Z',limit:2};
 assert.deepEqual(scopedEventWindow(rows,new Set(['affected']),w).map(r=>r.id),['a1']);
 assert.deepEqual(scopedEventWindow(rows,new Set(['affected','unchanged']),w).map(r=>r.id),['a1','b1']);
 assert.deepEqual(scopedEventWindow(rows,new Set(['affected']),{...w,limit:3}).map(r=>r.id),['a1','a2']);
});
