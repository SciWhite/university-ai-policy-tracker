import { timingSafeEqual } from "node:crypto";
import { revalidatePath, revalidateTag } from "next/cache";
import { contentRuntimeStatus, refreshContentPointer } from "@/lib/content-runtime";
import { isContentTag } from "@/lib/content-cache-tags";
import { getSiteBaseUrl } from "@/lib/site-url";

/**
 * Content switch, step 2 (docs/content-release.md): after the operator moves
 * UAPT_CONTENT_ROOT/current.json, re-read it in this process and expire the
 * ISR entries of the changed pages by tag and exact path.
 *
 * Loopback only: the Host and every client address in X-Forwarded-For /
 * X-Real-IP / X-Forwarded-Host must be loopback (Next itself adds loopback
 * values), Cloudflare/RFC 7239 headers are refused, and the bearer token must
 * match UAPT_CONTENT_REFRESH_TOKEN. Without the token the endpoint does not
 * exist. nginx must also deny /api/internal/content/ (docs/content-release.md).
 * Cloudflare is never called here: the response lists the exact URLs for the
 * separate, authorized purge step.
 */
export const dynamic = "force-dynamic";

const MAX_ITEMS = 2000;
const PATH = /^\/[A-Za-z0-9._~\-/]*$/;
const LOOPBACK_HOST = /^(?:127\.0\.0\.1|localhost|\[::1\])(?::\d+)?$/;
const LOOPBACK_ADDRESS = /^(?:127\.0\.0\.1|::1|::ffff:127\.0\.0\.1)$/;
const EDGE_HEADERS = ["forwarded", "cf-connecting-ip", "cf-ray", "true-client-ip"];

function fromLoopback(headers: Headers): boolean {
  if (!LOOPBACK_HOST.test((headers.get("host") ?? "").toLowerCase())) return false;
  if (EDGE_HEADERS.some(name => headers.has(name))) return false;
  const forwardedHost = headers.get("x-forwarded-host");
  if (forwardedHost && !forwardedHost.split(",").every(item => LOOPBACK_HOST.test(item.trim().toLowerCase()))) return false;
  return ["x-forwarded-for", "x-real-ip"].every(name => {
    const value = headers.get(name);
    return !value || value.split(",").every(item => LOOPBACK_ADDRESS.test(item.trim()));
  });
}

function respond(status: number, body: unknown) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}

function authorize(request: Request): Response | undefined {
  const token = process.env.UAPT_CONTENT_REFRESH_TOKEN?.trim() ?? "";
  if (token.length < 32) return respond(404, { error: "not_found" });
  if (!fromLoopback(request.headers)) return respond(403, { error: "loopback_only" });
  const supplied = /^Bearer (.+)$/.exec(request.headers.get("authorization") ?? "")?.[1] ?? "";
  const a = Buffer.from(supplied), b = Buffer.from(token);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return respond(401, { error: "unauthorized" });
  return undefined;
}

export async function GET(request: Request) {
  const denied = authorize(request);
  if (denied) return denied;
  refreshContentPointer();
  return respond(200, contentRuntimeStatus());
}

export async function POST(request: Request) {
  const denied = authorize(request);
  if (denied) return denied;
  let body: { expectedContentId?: unknown; tags?: unknown; paths?: unknown };
  try { body = await request.json(); } catch { return respond(400, { error: "invalid_json" }); }
  const tags = Array.isArray(body.tags) ? body.tags : [];
  const paths = Array.isArray(body.paths) ? body.paths : [];
  if (typeof body.expectedContentId !== "string" || tags.length + paths.length === 0 || tags.length > MAX_ITEMS || paths.length > MAX_ITEMS ||
      !tags.every((tag): tag is string => typeof tag === "string" && isContentTag(tag)) ||
      !paths.every((item): item is string => typeof item === "string" && item.length <= 512 && PATH.test(item) && !item.includes(".."))) {
    return respond(400, { error: "invalid_request" });
  }
  // Fail closed: never expire pages unless this process now serves the expected release.
  const selected = refreshContentPointer();
  if (selected.error || selected.contentId !== body.expectedContentId) {
    return respond(409, { error: "content_not_selected", expectedContentId: body.expectedContentId, contentId: selected.contentId, pointerError: selected.error });
  }
  for (const tag of new Set(tags)) revalidateTag(tag, { expire: 0 });
  for (const item of new Set(paths)) revalidatePath(item);
  const base = getSiteBaseUrl();
  return respond(200, {
    ok: true,
    contentId: selected.contentId,
    revalidated: { tags: [...new Set(tags)], paths: [...new Set(paths)] },
    // Hook for the separate Cloudflare step: POST {"files": urls} to zone purge_cache. Not sent here.
    cloudflarePurge: { status: "not_sent", files: [...new Set(paths)].map(item => new URL(item, base).toString()) }
  });
}
