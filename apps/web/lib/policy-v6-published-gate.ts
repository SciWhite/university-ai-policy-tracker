import pointer from '../../../data/public-v6-pages/current.json';
/** Client-safe identity gate; filesystem verification stays in the server loader. */
export const publishedV6Slugs=pointer.slugs;
export const publishedV6Enabled=()=>process.env.UAPT_V6_PUBLISHED_PAGES==='1'||process.env.NEXT_PUBLIC_UAPT_V6_PUBLISHED_PAGES==='1';
