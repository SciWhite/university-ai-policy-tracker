import {isReadingCohortSchool, readingCohortSlugs} from './reading-cohort';
/** Client-safe identity gate; the active content release supplies the slugs, filesystem verification stays in the server loader. */
export const publishedV6Slugs=():readonly string[]=>readingCohortSlugs();
export const isPublishedV6Slug=(slug:string)=>isReadingCohortSchool(slug);
export const publishedV6Enabled=()=>process.env.UAPT_V6_PUBLISHED_PAGES==='1'||process.env.NEXT_PUBLIC_UAPT_V6_PUBLISHED_PAGES==='1';
