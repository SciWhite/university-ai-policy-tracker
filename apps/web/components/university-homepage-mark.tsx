import React from 'react';
import {UniversityMark} from './university-mark';
import {universityHomepageHref, type OfficialHomepage} from '@/lib/university-homepage';
import type {SupportedLocale} from '@/lib/i18n';
/** Header-only link: comparison chips remain noninteractive inside their existing controls. */
export function UniversityHomepageMark({slug,name,locale='en',officialHomepage}:{slug:string;name:string;locale?:SupportedLocale;officialHomepage?:OfficialHomepage}) {
 const href=universityHomepageHref(slug, officialHomepage);
 const mark=<UniversityMark slug={slug} size="hero"/>;
 if(!href)return mark;
 return <a className="university-homepage-mark" data-university-homepage={slug} href={href} aria-label={locale==='zh'?`${name} 官方首页`:`${name} official homepage`} title={locale==='zh'?'大学官方首页':'Official university homepage'}>{mark}</a>;
}
