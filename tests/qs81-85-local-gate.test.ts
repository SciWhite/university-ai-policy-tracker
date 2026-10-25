import test from 'node:test';
import assert from 'node:assert/strict';
import {isPolicyV6Preview} from '../apps/web/lib/policy-v6-gate';

test('QS81–85 preview requires development and explicit V6 selection', () => {
  const saved = [process.env.UAPT_V6_PUBLISHED_PAGES,process.env.NEXT_PUBLIC_UAPT_V6_PUBLISHED_PAGES];
  delete process.env.UAPT_V6_PUBLISHED_PAGES;
  delete process.env.NEXT_PUBLIC_UAPT_V6_PUBLISHED_PAGES;
  try {
    for (const slug of ['university-of-washington','adelaide-university','pennsylvania-state-university','universidad-de-buenos-aires','tokyo-institute-of-technology']) {
      assert.equal(isPolicyV6Preview(slug,'v6','development'),true);
      assert.equal(isPolicyV6Preview(slug,undefined,'development'),false);
      assert.equal(isPolicyV6Preview(slug,'v6','production'),false);
    }
  } finally {
    for (const [i,key] of ['UAPT_V6_PUBLISHED_PAGES','NEXT_PUBLIC_UAPT_V6_PUBLISHED_PAGES'].entries()) {
      if(saved[i]===undefined) delete process.env[key]; else process.env[key]=saved[i];
    }
  }
});

import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {PolicyV6PublicToolContext} from '../apps/web/components/policy-v6-public-tool-context';
import type {LocalV6Bundle} from '../apps/web/lib/policy-v6-bundle';

test('tool evidence preserves the exact canonical source language', () => {
  for(const [language,quote] of [['ja','東京科学大学の原文'],['es','Texto original de la Facultad']] as const){
    const sourceUrl='https://example.edu/source';
    const view={claims:[{evidence:[{sourceUrl,evidenceSnippet:quote,sourceLanguage:language}]}],tools:[{rawToolName:'Existing tool',tool:'microsoft_copilot',evidence:[{sourceUrl,evidenceSnippet:quote,snapshotHash:'0'.repeat(64)}]}]} as unknown as LocalV6Bundle;
    const html=renderToStaticMarkup(React.createElement(PolicyV6PublicToolContext,{view,locale:'zh'}));
    assert(html.includes(`<p lang="${language}" data-i18n="preserve">${quote}</p>`));
  }
});
