import test from 'node:test';
import assert from 'node:assert/strict';
import { clarityChoice, clarityAllowed, setClarityChoice, CLARITY_CONSENT_KEY, CLARITY_CONSENT_MAX_AGE_MS } from '../apps/web/lib/clarity-preference';
import { isClarityPageEligible, installClarity } from '../apps/web/lib/clarity-client';
import { clarityCopy } from '../apps/web/lib/clarity-copy';
import { SUPPORTED_LOCALES } from '../apps/web/lib/i18n';

function browserFixture() {
  const data = new Map<string,string>();
  const storage = {getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>data.set(key,value),removeItem:(key:string)=>data.delete(key)};
  const window = Object.assign(new EventTarget(), {localStorage:storage,sessionStorage:storage,location:{hostname:'eduaipolicy.org'},clarity:undefined as undefined | (((...args:unknown[])=>void)&{q?:unknown[][]})});
  const scripts: Array<Record<string,unknown>> = [];
  const cookies: string[] = [];
  const document = Object.assign(new EventTarget(), {referrer:'',createElement:()=>({}),head:{appendChild:(script:Record<string,unknown>)=>scripts.push(script)}});
  Object.defineProperty(document,'cookie',{get:()=>'',set:(value:string)=>cookies.push(value)});
  const location = {href:'https://eduaipolicy.org/zh/universities/imperial-college-london',origin:'https://eduaipolicy.org',protocol:'https:',reloads:0,assigned:'',reload(){this.reloads++;},assign(url:string){this.assigned=url;}};
  const navigator = {doNotTrack:'0',globalPrivacyControl:false};
  const history = {pushState(){},replaceState(){}};
  const keys = ['window','document','location','navigator','history','localStorage'] as const;
  const descriptors = keys.map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)] as const);
  for(const [key,value] of Object.entries({window,document,location,navigator,history,localStorage:storage})) Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});
  return {window,document,location,navigator,history,storage,scripts,cookies,restore(){for(const [key,descriptor] of descriptors) {if(descriptor) Object.defineProperty(globalThis,key,descriptor); else Reflect.deleteProperty(globalThis,key);}}};
}

test('consent fails closed for missing, malformed, expired, future or blocked storage',()=>{
 const f=browserFixture(); try {
  assert.equal(clarityChoice(),null); assert.equal(clarityAllowed(),false);
  for(const value of ['broken','{}',JSON.stringify({choice:'granted',at:Date.now()-CLARITY_CONSENT_MAX_AGE_MS}),JSON.stringify({choice:'granted',at:Date.now()+60000})]) {f.storage.setItem(CLARITY_CONSENT_KEY,value); assert.equal(clarityChoice(),null);}
  setClarityChoice('granted'); assert.equal(clarityAllowed(),true);
  f.navigator.globalPrivacyControl=true; assert.equal(clarityAllowed(),false);
  f.navigator.globalPrivacyControl=false; f.navigator.doNotTrack='1'; assert.equal(clarityAllowed(),false);
  f.navigator.doNotTrack='0'; f.storage.setItem('uapt.analytics.opt_out','1'); assert.equal(clarityAllowed(),false);
  f.storage.setItem('uapt.analytics.opt_out','0'); setClarityChoice('denied'); assert.equal(clarityAllowed(),false);
  // A direct visit to privacy has no SDK; withdrawal still expires both cookies.
  assert.equal(f.window.clarity,undefined);
  for (const name of ['_clck','_clsk']) assert(f.cookies.some(cookie=>cookie.startsWith(`${name}=; Max-Age=0`)&&cookie.includes('Domain=.eduaipolicy.org')));
  f.storage.getItem=()=>{throw new Error('blocked');}; assert.equal(clarityAllowed(),false);
 }finally{f.restore();}
});

test('all locale variants exclude internal, search, contribution, query and query-referrer pages',()=>{
 for(const locale of SUPPORTED_LOCALES) {
  const prefix=locale==='en'?'':`/${locale}`;
  assert.equal(isClarityPageEligible(`https://eduaipolicy.org${prefix}/universities/imperial-college-london`),true);
  for(const path of ['/internal/analytics','/%69nternal/analytics','/search','/review/queue','/contribute','/api/public/v1','/account','/universities?q=private']) assert.equal(isClarityPageEligible(`https://eduaipolicy.org${prefix}${path}`),false,`${locale}${path}`);
  assert.equal(isClarityPageEligible(`https://eduaipolicy.org${prefix}/privacy`,'https://example.org/?q=private'),false);
  for(const path of ['/','/privacy','/universities','/universities/unpublished-school','/universities/tsinghua-university/changes']) assert.equal(isClarityPageEligible(`https://eduaipolicy.org${prefix}${path}`),false);
  assert.equal(isClarityPageEligible(`https://eduaipolicy.org${prefix}/universities/tsinghua-university`),true);
  assert(clarityCopy[locale].description && clarityCopy[locale].disclosure && clarityCopy[locale].reject);
 }
 assert.equal(isClarityPageEligible('not a url'),false);
});

test('SDK waits for consent, loads once with advertising denied, forces excluded navigation and unloads on withdrawal',()=>{
 const f=browserFixture(); try {
  installClarity('ye6c4h9822'); assert.equal(f.scripts.length,0);
  setClarityChoice('denied'); assert.equal(f.scripts.length,0);
  setClarityChoice('granted'); assert.equal(f.scripts.length,1);
  assert.equal(f.scripts[0].src,'https://www.clarity.ms/tag/ye6c4h9822');
  assert.deepEqual(f.window.clarity?.q?.[0],['consentv2',{ad_Storage:'denied',analytics_Storage:'granted'}]);
  setClarityChoice('granted'); assert.equal(f.scripts.length,1);
  f.history.pushState(null,'','/zh/search?q=private');
  assert.equal(f.location.assigned,'https://eduaipolicy.org/zh/search?q=private');
  assert(f.cookies.some(cookie=>cookie.startsWith('_clck=; Max-Age=0')));
  setClarityChoice('denied'); assert.equal(f.location.reloads,1);
  assert(f.window.clarity?.q?.some(args=>args[0]==='stop'));
  f.storage.setItem(CLARITY_CONSENT_KEY,JSON.stringify({choice:'granted',at:Date.now()}));
  f.storage.setItem('uapt.analytics.opt_out','1'); f.window.dispatchEvent(new Event('uapt-analytics-preference'));
  assert.equal(f.storage.getItem(CLARITY_CONSENT_KEY),null);
 }finally{f.restore();}
});
