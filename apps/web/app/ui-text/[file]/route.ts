import { activeContent } from "@/lib/content-runtime";
import { UI_ONLY_LOCALES } from "@/lib/content-locales";
import { uiTextManifest } from "@/lib/ui-text-dictionary";

/**
 * Browser UI dictionaries (lib/ui-text-dictionary.ts, components/ui-locale-overlay.tsx).
 * `manifest.json` names the current content-hashed file per UI locale; `<locale>.<hash>.json`
 * is immutable. Built once per content release in this process (memoized by contentId) and kept
 * by nginx and Cloudflare (200s only); pages never embed the hash, so a dictionary change touches
 * no page. Dynamic on purpose: an unknown name is a cheap 404 that is never stored as a page.
 */
export const dynamic = "force-dynamic";

const FILE = /^(?:manifest|([A-Za-z-]{2,8})\.[0-9a-f]{16})\.json$/;
let memo: { contentId: string; manifest: ReturnType<typeof uiTextManifest> } | undefined;

function currentManifest() {
  const contentId = activeContent().contentId;
  if (memo?.contentId !== contentId) {
    const manifest = uiTextManifest();
    memo = { contentId, manifest };
    manifest.catch(() => { if (memo?.manifest === manifest) memo = undefined; });
  }
  return memo.manifest;
}

export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const match = FILE.exec(file);
  if (!match || (match[1] && !UI_ONLY_LOCALES.includes(match[1] as never))) return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  const manifest = await currentManifest();
  if (file === "manifest.json") {
    return Response.json({ schemaVersion: manifest.schemaVersion, files: manifest.files }, {
      headers: { "Cache-Control": "public, max-age=300, s-maxage=31536000", "X-Content-Type-Options": "nosniff" }
    });
  }
  const body = manifest.bodies[file];
  if (!body) return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  return new Response(body, {
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" }
  });
}
