'use client';
import React from 'react';
import type {V6StudentActions} from '@/lib/policy-v6-student-actions';
import type {SupportedLocale} from '@/lib/i18n';
import {PolicyV6CompactGuide} from './policy-v6-compact-guide';

/** A stale or absent school projection never falls back to another university's rules. */
export function PolicyV6StudentGuide({guide,locale}:{guide:V6StudentActions|undefined;locale:SupportedLocale}) {
 if(guide)return <PolicyV6CompactGuide guide={guide} locale={locale}/>;
 return <section className="v6-student-guide" id="v6-submission-guide">
  <span id="submission-checklist"/>
  <h2>{locale==='zh'?'提交前快速检查':'Before you submit'}</h2>
  <p>{locale==='zh'?'指引依据需要更新，请查看当前主题证据。':'The guidance basis needs updating. Consult the current topic evidence.'}</p>
  <a href="#snapshot-coursework">{locale==='zh'?'查看课程依据':'View coursework evidence'}</a>
 </section>;
}
