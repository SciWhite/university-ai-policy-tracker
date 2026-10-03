export const dynamic = "force-dynamic";
export function GET() {
  let url: string | undefined;
  try {
    const candidate = new URL(process.env.UAPT_PLUGIN_DIRECTORY_URL ?? "");
    if (candidate.protocol === "https:" && !candidate.username && !candidate.password &&
      ["chatgpt.com", "platform.openai.com"].includes(candidate.hostname) && process.env.UAPT_PLUGIN_DIRECTORY_STATUS === "published") url = candidate.toString();
  } catch { /* Only a verified, published official listing gets an install link. */ }
  const provider = process.env.UAPT_SUPPORT_EMAIL_PROVIDER?.trim().slice(0,120);
  const retention = process.env.UAPT_SUPPORT_EMAIL_RETENTION?.trim().slice(0,300);
  return Response.json({ status: url ? "published" : "pending", ...(url ? {url} : {}),
    supportMailbox: provider && retention ? {provider,retention} : null }, { headers: { "Cache-Control": "no-store" } });
}
