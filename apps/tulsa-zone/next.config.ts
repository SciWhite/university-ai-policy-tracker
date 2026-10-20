import createNextIntlPlugin from 'next-intl/plugin';
import path from 'node:path';
const config={assetPrefix:'/discovery-v6-20261020',experimental:{cpus:2,globalNotFound:true},transpilePackages:['@uapt/db','@uapt/shared'],outputFileTracingRoot:path.resolve('../..'),outputFileTracingIncludes:{'/*':['../../data/public-change-history/**/*.json','../../data/public-v6-pages/sharded/**/*.json','../../data/public-v6-records/sharded/**/*.json','../../data/public-v6-history/sharded/**/*.json']},turbopack:{root:path.resolve('../..')},async rewrites(){return [{source:'/discovery-v6-20261020/_next/:path*',destination:'/_next/:path*'}]}};
export default createNextIntlPlugin('../web/i18n/request.ts')(config);
