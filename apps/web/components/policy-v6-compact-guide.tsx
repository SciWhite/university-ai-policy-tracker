'use client';
import React,{useEffect,useRef,useState}from'react';
import type{V6StudentActions,StudentGuideClaim}from'@/lib/policy-v6-student-actions';
import type{SupportedLocale}from'@/lib/i18n';
import{PolicyV6Popover}from'./policy-v6-popover';

/** Shared compact composition. Content and procedures are bound to the current school's evidence. */
export function PolicyV6CompactGuide({guide,locale}:{guide:V6StudentActions;locale:SupportedLocale}){
 const zh=locale==='zh',language=zh?'zh':'en',prefix=locale==='en'?'':'/'+locale;
 const slug=guide.slug!;
 const detailId=slug==='imperial-college-london'?'imperial':'v6';
 const[open,setOpen]=useState(false),[shareUrl,setShareUrl]=useState('');const dialog=useRef<HTMLDialogElement>(null),trigger=useRef<HTMLAnchorElement>(null);
 const t=zh?{title:'提交前快速检查',do:'建议做',dont:'应避免',source:'依据 ↗',close:'关闭并返回',concern:'收到 AI 使用疑虑？',hint:'调查、可能后果与申诉',groups:['调查与回应','可能的处理结果','复核与申诉'],gap:'当前证据未涵盖可核实的具体程序或期限，请查适用的校方规定。',advice:'本站建议',guidance:'来源建议',requirement:'本范围要求',print:'打印或保存 PDF',share:'复制详情链接',copied:'链接已复制',report:'发现过期或错误？报告问题',scope:'适用范围',independent:'独立整理 · 免费开放 · 非学校官方页面',search:'搜索大学',enFallback:'以下导读暂以英文提供，官方原文保持原语言。'}:{title:'Before you submit',do:'Do',dont:'Don’t',source:'Evidence ↗',close:'Close and return',concern:'AI use questioned?',hint:'Investigation, possible outcomes and appeal',groups:['Investigation & response','Possible outcomes','Review & appeal'],gap:'The current evidence does not include a verified specific procedure or deadline. Check the applicable university rules.',advice:'Site advice',guidance:'Source guidance',requirement:'Requirement in this scope',print:'Print or save PDF',share:'Copy detail link',copied:'Link copied',report:'Outdated or incorrect? Report an issue',scope:'Scope',independent:'Independent · Open access · Not an official university page',search:'Search universities',enFallback:'Guidance is currently in English; original evidence retains its source language.'};
 const[copied,setCopied]=useState(false);
 const copyLink=async()=>{try{await navigator.clipboard.writeText(shareUrl);setCopied(true);}catch{const input=dialog.current?.querySelector<HTMLInputElement>('.v6-compact-share-url');input?.focus();input?.select();}};
 useEffect(()=>{
  const sync=()=>{const url=new URL(location.href);setOpen(url.searchParams.get('guide')==='concerns');url.searchParams.set('guide','concerns');setShareUrl(url.href);};sync();addEventListener('popstate',sync);return()=>removeEventListener('popstate',sync);
 },[]);
 useEffect(()=>{
  const node=dialog.current;if(!node)return;
  if(open){if(!node.open)node.showModal();const previous=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.body.style.overflow=previous;if(node.open)node.close();};}
  if(node.open)node.close();
 },[open]);
 const show=(event:React.MouseEvent<HTMLAnchorElement>)=>{if(event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;event.preventDefault();const url=new URL(location.href);url.searchParams.set('guide','concerns');history.pushState(null,'',url);setShareUrl(url.href);setOpen(true);};
 const close=()=>{const url=new URL(location.href);url.searchParams.delete('guide');history.replaceState(null,'',url);setOpen(false);requestAnimationFrame(()=>trigger.current?.focus());};
 const print=()=>{const items=Array.from(dialog.current?.querySelectorAll('details')??[]),values=items.map(item=>item.open);items.forEach(item=>item.open=true);const restore=()=>items.forEach((item,i)=>item.open=values[i]);addEventListener('afterprint',restore,{once:true});window.print();};
 return <section className="v6-student-guide v6-compact-guide" id="v6-submission-guide" data-student-guide-basis={guide.recordSha256}>
  <span id="submission-checklist" className="v6-compact-anchor"/>
  <header className="v6-student-guide__header"><div><h2>{t.title}</h2></div></header>
  {locale!=='zh'&&locale!=='en'?<p className="policy-v6-muted">{t.enFallback}</p>:null}
  <div className="v6-student-guide__actions" id="v6-ai-use-guidance">{(['do','dont']as const).map((kind,index)=><article key={kind} className={`v6-student-guide__column v6-student-guide__column--${kind}`}><h3 data-policy-tone={kind==='do'?'allowed':'prohibited'}>{index===0?t.do:t.dont}</h3><ul>{guide[kind].map((action,i)=><li key={action.en}><div><span className="v6-compact-action-text" lang={language} data-i18n="preserve">{action[language]}</span><div className="v6-compact-action-meta"><small data-action-kind={action.kind}>{action.kind==='requirement'?t.requirement:action.kind==='source_guidance'?t.guidance:t.advice}</small><PolicyV6Popover id={`${detailId}-action-${kind}-${i}`} label={t.source} accessibleLabel={`${action[language]} — ${zh?'查看官方依据':'View official evidence'}`} title={action[language]} mobileReading className="v6-compact-action-evidence" closeLabel={zh?'关闭':'Close'} width={560}><details className="v6-compact-action-scope"><summary>{t.scope}</summary><p lang={language}>{guide.scope[language]}</p></details>{action.claimIds.map(id=><CompactEvidence key={id} row={guide.claims[id]} zh={zh} defaultOpen/>)}</PolicyV6Popover></div></div></li>)}</ul></article>)}</div>
  <div className="v6-student-guide__concern" id="v6-ai-concerns"><a className="v6-student-guide__concern-button" href="?guide=concerns" onClick={show} ref={trigger}><strong>{t.concern}</strong><span>{t.hint}</span><span aria-hidden="true">↗</span></a></div>
  <dialog ref={dialog} className="v6-compact-concern" id={`${detailId}-concern-details`} aria-labelledby={`${detailId}-concern-title`} onCancel={event=>{event.preventDefault();close();}}>
   <header><div><h2 id={`${detailId}-concern-title`}>{t.concern}</h2><p lang={language}>{guide.name}</p></div><div className="v6-compact-concern__header-actions"><button type="button" className="v6-compact-share-top" onClick={copyLink} aria-label={copied?t.copied:t.share} title={copied?t.copied:t.share}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M15 8V4H4v11h4"/></svg></button><button type="button" onClick={close}>{t.close} ×</button></div></header>
   <span className="v6-compact-live-status" role="status">{copied?t.copied:''}</span><div className="v6-compact-concern__body"><p lang={language} data-i18n="preserve">{guide.scope[language]}</p>
    <nav aria-label={zh?'处理程序':'Procedures'}>{t.groups.map((label,i)=><a key={label} href={'#'+detailId+'-procedure-'+i} onClick={event=>{event.preventDefault();document.getElementById(detailId+'-procedure-'+i)?.scrollIntoView({block:'start',behavior:'instant'});}}>{label}</a>)}</nav>
    {(['investigation','outcomes','appeal']as const).map((key,index)=><section key={key} id={detailId+'-procedure-'+index} data-procedure-group={key}><h3>{t.groups[index]}</h3>{guide.procedures[key].length?guide.procedures[key].map(id=><CompactEvidence row={guide.claims[id]} key={id} zh={zh}/>):<p data-evidence-gap="true">{t.gap}</p>}</section>)}
    <footer><button type="button" onClick={copyLink}>{copied?t.copied:t.share}</button><button type="button" onClick={print}>{t.print}</button><input className="v6-compact-share-url" aria-label={zh?'详情独立链接':'Detail link'} value={shareUrl} readOnly onFocus={e=>e.target.select()}/><a href={`${prefix}/changes/${slug}`}>{zh?'政策变更记录':'Policy change history'}</a></footer>
   </div>
  </dialog>
 </section>;
}
function CompactEvidence({row,zh,defaultOpen=false}:{row:StudentGuideClaim;zh:boolean;defaultOpen?:boolean}){
 return <article className="v6-compact-evidence" data-guide-evidence-id={row.id} data-basis-object-type={row.basisObjectType??'public_claim'}><p lang={zh?'zh':'en'} data-i18n="preserve">{zh&&row.summaryZh?row.summaryZh:row.text}</p><details open={defaultOpen}><summary>{zh?'官方原文与适用范围':'Original evidence and scope'}</summary><p lang="en" data-i18n="preserve">{row.text}</p><small>{row.id}</small>{row.scope?<p lang="en" data-i18n="preserve">{row.scope}</p>:null}{row.deadline?<><p lang={zh?'zh':'en'}>{row.deadline[zh?'zh':'en']}</p><blockquote lang="en" data-i18n="preserve">{row.deadline.quote}</blockquote><a href={row.deadline.url} target="_blank" rel="noopener noreferrer">{zh?'大学官方来源':'Official university source'} ↗</a></>:null}{row.evidence.map((e,i)=><div key={`${e.url}:${i}`}><blockquote lang={e.language} data-i18n="preserve">{e.quote}</blockquote><p lang="en" data-i18n="preserve">{e.location}</p><a href={e.url} target="_blank" rel="noopener noreferrer">{zh?'大学官方来源':'Official university source'} ↗</a></div>)}</details></article>;
}
