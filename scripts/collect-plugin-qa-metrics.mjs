// Read-only Bing API collection. Run with the protected production environment.
// Output never contains credentials, request URLs or raw user queries.
try {
  if (!process.env.BING_WEBMASTER_API_KEY) throw new Error("unavailable");
  const url = new URL("https://ssl.bing.com/webmaster/api.svc/json/GetPageStats");
  url.searchParams.set("apikey",process.env.BING_WEBMASTER_API_KEY);
  url.searchParams.set("siteUrl",process.env.BING_WEBMASTER_SITE_URL ?? "https://eduaipolicy.org");
  const response = await fetch(url, {signal:AbortSignal.timeout(30000)});
  if (!response.ok) throw new Error("unavailable");
  const body=await response.json();
  const grouped = new Map();
  for(const row of body.d ?? []) {
    const date = row.Date?.match(/\/Date\((\d+)/)?.[1];
    if(!date) continue;
    const day=new Date(Number(date)).toISOString().slice(0,10);
    if(day < "2026-09-01" || day > "2026-09-30" || !row.Query) continue;
    const previous=grouped.get(row.Query) ?? {clicks:0,impressions:0};
    previous.clicks += row.Clicks ?? 0; previous.impressions += row.Impressions ?? 0;
    grouped.set(row.Query,previous);
  }
  console.log(JSON.stringify({available:true,coverageStart:"2026-09-01",coverageEnd:"2026-09-30",pageRows:[...grouped].map(([url,values])=>({url,...values}))}));
} catch { console.log(JSON.stringify({available:false,coverageStart:"2026-09-01",coverageEnd:"2026-09-30",pageRows:[]})); }
