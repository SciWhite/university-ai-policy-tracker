import pointer from '../../../data/public-v6-pages/current.json';
/** Client-safe identity gate; filesystem verification stays in the server loader. */
export const publishedV6Slugs=pointer.slugs;
/** Separate bounded V5 cohort; never grants V6 presentation approval. */
export const publishedV5Slugs=pointer.v5Slugs??[];
export const publishedV6Enabled=()=>process.env.UAPT_V6_PUBLISHED_PAGES==='1'||process.env.NEXT_PUBLIC_UAPT_V6_PUBLISHED_PAGES==='1';
