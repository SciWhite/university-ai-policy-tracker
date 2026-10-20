import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { isLocalMarkFile } from "@/lib/local-university-marks";
import { findRepoRoot } from "@/lib/repo-root";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ filename: string }> }) {
  const { filename } = await context.params;
  const hostname = new URL(request.url).hostname;
  if (!["localhost", "127.0.0.1", "[::1]"].includes(hostname) || !isLocalMarkFile(filename)) {
    return new Response(null, { status: 404 });
  }
  try {
    const root = await findRepoRoot();
    const bytes = await readFile(path.join(root,
      ".local/v6-marks-unified-integration-20261019/assets", filename));
    if (createHash("sha256").update(bytes).digest("hex") !== filename.slice(0, -5)) {
      return new Response(null, { status: 404 });
    }
    return new Response(new Uint8Array(bytes), { headers: {
      "Content-Type": "image/webp", "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, max-age=3600, immutable",
    } });
  } catch {
    return new Response(null, { status: 404 });
  }
}
