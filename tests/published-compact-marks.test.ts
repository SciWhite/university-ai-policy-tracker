import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import registry from '../apps/web/lib/university-marks-published.json';
import {getPublishedCompactMark,getLocalCompactMark} from '../apps/web/lib/local-university-marks';
test('published compact export retains role restrictions and verified compressed bytes',async()=>{
 for(const [slug,m] of Object.entries(registry.entries)){
  assert.equal(m.role,'compact');assert.equal(m.publicationApproved,false);
  const b=await readFile(`apps/tulsa-zone/public${registry.assetPrefix}/${m.file}`);
  assert.equal(createHash('sha256').update(b).digest('hex'),m.file.slice(0,-5),slug);
  const view=getPublishedCompactMark(slug,'directory');assert.ok(view,slug);
  assert.ok(view.displayWidth<=m.width&&view.displayHeight<=m.height,slug);
  assert.equal(getPublishedCompactMark(slug,'hero'),undefined);
 }
 assert.equal(getPublishedCompactMark('sabanci-university','small'),undefined);
 assert.equal(getPublishedCompactMark('university-of-wollongong','small'),undefined);
 assert.ok(getPublishedCompactMark('university-of-minnesota','directory')!.displayWidth>=45);
 assert.match(getPublishedCompactMark('bilkent-university','directory')!.source,/^\/assets\//);
});
