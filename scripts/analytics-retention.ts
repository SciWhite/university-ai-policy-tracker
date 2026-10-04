// Dry-run by default. The daily systemd timer explicitly passes --apply.
async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  const secret = process.env.SUPABASE_ANALYTICS_SECRET;
  if (!url || !key || !secret) throw new Error("Analytics retention is not configured");
  const res = await fetch(`${url}/rest/v1/rpc/uapt_analytics_retention`, {
    method: "POST", headers: { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ p_secret: secret, p_dry_run: !process.argv.includes("--apply") }), signal: AbortSignal.timeout(30000)
  });
  if (!res.ok) throw new Error(`Retention RPC failed: ${res.status}`);
  const result = await res.json();
  console.log(JSON.stringify({ dryRun: result.dryRun, cutoff: result.cutoff, rows: result.rows }));
}
main().catch(() => { console.error("Analytics retention failed; check migration and protected configuration"); process.exitCode=1; });
