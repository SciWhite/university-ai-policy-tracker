import React from 'react';
import {UniversityMark} from './university-mark';
import homepages from '@/lib/university-homepages.json';
import type {SupportedLocale} from '@/lib/i18n';
/** Header-only link: comparison chips remain noninteractive inside their existing controls. */
export function UniversityHomepageMark({slug,name,locale='en'}:{slug:string;name:string;locale?:SupportedLocale}) {
 const href=homepages[slug as keyof typeof homepages];
 const mark=<UniversityMark slug={slug} size="hero"/>;
 if(!href)return mark;
 return <a className="university-homepage-mark" data-university-homepage={slug} href={href} aria-label={locale==='zh'?`${name} 官方首页`:`${name} official homepage`} title={locale==='zh'?'大学官方首页':'Official university homepage'}>{mark}</a>;
}
