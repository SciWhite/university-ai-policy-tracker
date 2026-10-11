import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type SourceEvidence = { path: string; sha256: string; representation: string; truncated: boolean };

export async function readLimitedBytes(response: Response, maxBytes: number): Promise<{ bytes: Buffer; truncated: boolean }> {
  if (!response.body) return { bytes: Buffer.alloc(0), truncated: false };
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return { bytes: Buffer.concat(chunks), truncated: false };
    if (!value) continue;
    const remaining = maxBytes - total;
    chunks.push(value.subarray(0, remaining));
    total += Math.min(value.byteLength, remaining);
    if (value.byteLength > remaining || total >= maxBytes) {
      await reader.cancel();
      return { bytes: Buffer.concat(chunks), truncated: true };
    }
  }
}

export async function saveSourceEvidence(runDir: string, url: string, representation: string, bytes: Buffer, truncated: boolean): Promise<SourceEvidence> {
  const hash = createHash("sha256").update(bytes).digest("hex");
  const relative = path.join("source-evidence", `${createHash("sha256").update(url).digest("hex").slice(0, 20)}-${representation}-${hash}`);
  await mkdir(path.join(runDir, "source-evidence"), { recursive: true, mode: 0o700 });
  try { await writeFile(path.join(runDir, relative), bytes, { flag: "wx", mode: 0o600 }); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST" ||
      createHash("sha256").update(await readFile(path.join(runDir, relative))).digest("hex") !== hash) throw error;
  }
  return { path: relative, sha256: hash, representation, truncated };
}
