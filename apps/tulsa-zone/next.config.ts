import createNextIntlPlugin from 'next-intl/plugin';
import path from 'node:path';
const config={assetPrefix:'/policy-imperial-ux-20261015',experimental:{cpus:2,globalNotFound:true},transpilePackages:['@uapt/db','@uapt/shared'],outputFileTracingRoot:path.resolve('../..'),turbopack:{root:path.resolve('../..')},async rewrites(){return [{source:'/policy-imperial-ux-20261015/_next/:path*',destination:'/_next/:path*'}]}};
export default createNextIntlPlugin('../web/i18n/request.ts')(config);
