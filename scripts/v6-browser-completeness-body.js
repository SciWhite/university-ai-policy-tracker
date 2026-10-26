// playwright-cli run-code --filename adapter; expected data is frozen by the caller.
async (page) => {
  const expected = EXPECTED_V6_INPUT;
  const base = BASE_V6_URL;
  const rows = [], errors = [];
  const norm = value => value.replace(/\s+/g,' ').trim();
  page.on('pageerror',error=>errors.push(String(error)));
  for (const school of expected) for (const locale of ['en','zh']) {
    const value=school.locales[locale];
    for (const width of [390,720,1440]) {
      await page.setViewportSize({width,height:900});
      await page.emulateMedia({colorScheme:width===1440?'dark':'light'});
      const url=base+(locale==='en'?'':'/zh')+'/universities/'+school.slug;
      const response=await page.goto(url,{waitUntil:'networkidle',timeout:60000});
      if(response.status()!==200)throw Error('HTTP '+response.status()+' '+url);
      const cards=page.locator('[data-snapshot-dimension]');
      const actual=await cards.evaluateAll(cards=>cards.map(card=>({key:card.getAttribute('data-snapshot-dimension'),title:card.querySelector('h3')?.textContent.trim(),status:card.querySelector('.student-snapshot-card__status')?.textContent.trim(),summary:card.querySelector('.student-snapshot-card__sentence')?.textContent.trim()})));
      if(JSON.stringify(actual)!==JSON.stringify(value.topics))throw Error('Rendered topic text differs '+school.slug+'/'+locale+'/'+width);
      const quickStatuses=await page.locator('#v6-questions a[href^="#snapshot-"]').evaluateAll(links=>links.map(link=>({key:link.getAttribute('href').slice('#snapshot-'.length),status:link.querySelector('small')?.textContent.trim()})));
      if(quickStatuses.length!==4 || quickStatuses.some(q=>q.status!==value.topics.find(t=>t.key===q.key)?.status))throw Error('Quick-link locale/status drift '+school.slug);
      const actionTexts=await page.locator('.v6-compact-action-text').allTextContents();
      const wantActions=value.actions.map(a=>a.text);
      if(JSON.stringify(actionTexts.map(norm))!==JSON.stringify(wantActions.map(norm)))throw Error('Action texts differ '+school.slug+'/'+locale);
      const faq=page.locator('#student-faq .policy-v6-faqGrid > details');
      if(await faq.count()!==12)throw Error('FAQ12 missing '+school.slug);
      const faqAnswers=await faq.locator('p[data-i18n="preserve"]').allTextContents();
      for(const topic of value.topics)if(!faqAnswers.some(a=>norm(a)===norm(topic.summary)))throw Error('FAQ projection differs '+topic.key);
      const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
      if(overflow)throw Error('Overflow '+school.slug+'/'+locale+'/'+width);
      if(await page.locator('#record-changes [data-event-id]').count()<1)throw Error('Verified Changes timeline missing or unavailable '+school.slug);
      const opened=[];
      // Every action on both languages, plus narrow/wide popover interaction.
      if(width!==720)for(const action of value.actions){
        const label=action.text+' — '+(locale==='zh'?'查看官方依据':'View official evidence');
        await page.getByRole('button',{name:label,exact:true}).click();
        const panel=page.locator(':popover-open');await panel.waitFor({state:'visible'});
        const ids=await panel.locator('[data-guide-evidence-id]').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('data-guide-evidence-id')));
        for(const id of action.claimIds)if(!ids.includes(id))throw Error('Action evidence ID missing '+id);
        const quotes=await panel.locator('blockquote').allTextContents();
        for(const quote of action.quotes)if(!quotes.some(q=>norm(q)===norm(quote)))throw Error('Action original quote missing '+school.slug);
        const height=await page.evaluate(()=>document.documentElement.scrollHeight);
        await page.keyboard.press('Escape');
        if(await page.locator(':popover-open').count())throw Error('Escape failed');
        if(await page.evaluate(()=>document.documentElement.scrollHeight)!==height)throw Error('Popover reflow');
        opened.push({claimIds:ids,quotesMatched:action.quotes.length});
      }
      if(width===1440){
        const topic=cards.first();await topic.getByRole('button',{name:locale==='zh'?'状态与范围':'Status & scope',exact:true}).click();
        const scopeText=await page.locator(':popover-open').textContent();
        if(!norm(scopeText).includes(norm(value.scope)))throw Error('Scope projection missing '+school.slug);
        await page.keyboard.press('Escape');
        await page.locator('.v6-compact-faq > summary').click();
        await faq.first().locator('summary').click();
        if(!await faq.first().locator('p').isVisible())throw Error('FAQ expansion failed');
      }
      rows.push({slug:school.slug,locale,width,status:response.status(),topics:actual,actions:actionTexts,faq:12,quickStatuses,overflow,opened});
    }
  }
  if(errors.length)throw Error('Page errors: '+errors.join(';'));
  return {status:'PASS',base,rows,pageErrors:errors};
}
