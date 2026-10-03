import { resolveMx, resolveTxt } from "node:dns/promises";
const domain="eduaipolicy.org";
const selector=process.argv.find(a=>a.startsWith("--dkim-selector="))?.split("=")[1];
if(selector && !/^[a-zA-Z0-9_-]{1,100}$/.test(selector))throw new Error("Invalid DKIM selector");
const txt = async name => { try { return (await resolveTxt(name)).map(parts=>parts.join("")); } catch { return []; } };
const hasDkimKey = record => {
  const key = record.match(/(?:^|;)\s*p=([^;]*)/)?.[1]?.trim();
  return !!key && /^[A-Za-z0-9+/]+={0,2}$/.test(key);
};
const [mx,spf,dmarc,dkim]=await Promise.all([
  resolveMx(domain).catch(()=>[]),txt(domain),txt(`_dmarc.${domain}`),selector?txt(`${selector}._domainkey.${domain}`):Promise.resolve([])
]);
console.log(JSON.stringify({address:`support@${domain}`,checkedAt:new Date().toISOString(),
  mx:{status:mx.length?"present":"missing",servers:mx.map(m=>({priority:m.priority,exchange:m.exchange}))},
  spf:{status:spf.filter(t=>t.startsWith("v=spf1")).length===1?"present":"missing_or_multiple"},
  dmarc:{status:dmarc.filter(t=>t.startsWith("v=DMARC1")).length===1 && dmarc.some(t=>/(?:^|;)\s*p=(none|quarantine|reject)(?:;|\s*$)/.test(t))?"present":"missing_or_multiple_or_invalid"},
  dkim:{selector:selector??null,status:selector?(dkim.filter(hasDkimKey).length===1?"present":"missing_or_multiple_or_alias_check_needed"):"needs_selector"},
  inboundTest:"pending",outboundTest:"pending",authenticationHeaders:"pending",note:"DNS checks alone do not verify mailbox existence, SMTP authentication or delivery."},null,2));
