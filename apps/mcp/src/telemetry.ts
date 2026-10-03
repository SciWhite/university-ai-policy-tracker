import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

export function retentionCutoff(now = new Date()): Date {
  const year = now.getUTCFullYear(), month = now.getUTCMonth() - 13;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(now.getUTCDate(), lastDay)));
}
type Bucket = { calls: number; latencyMsTotal: number; latencyMsMax: number };
export type DailyTotals = { schemaVersion: "uapt-mcp-daily-v1"; days: { [day: string]: { [boundedKey: string]: Bucket } } };

export class DailyTelemetry {
  private data: DailyTotals = { schemaVersion: "uapt-mcp-daily-v1", days: {} };
  private pending: Promise<void> = Promise.resolve();
  constructor(private file?: string) {}
  async initialize() {
    if (!this.file) return;
    try { this.data = JSON.parse(await readFile(this.file, "utf8")); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw new Error("Cannot load aggregated telemetry"); }
    if (this.data.schemaVersion !== "uapt-mcp-daily-v1" || !this.data.days) throw new Error("Invalid telemetry store");
    await this.flush();
  }
  record(tool: string, university: string, topic: string, result: "ok" | "insufficient" | "error", ms: number) {
    const day = new Date().toISOString().slice(0,10);
    const key = [tool, university, topic, result].join("|");
    const daily = this.data.days[day] ??= {};
    const bucket = daily[key] ??= { calls: 0, latencyMsTotal: 0, latencyMsMax: 0 };
    bucket.calls++; bucket.latencyMsTotal += Math.round(ms); bucket.latencyMsMax = Math.max(bucket.latencyMsMax, Math.round(ms));
    // Serialize writes; no per-call events, prompt strings, IDs, IPs or timestamps are stored.
    return this.flush();
  }
  snapshot() { return structuredClone(this.data); }
  flush(now = new Date()) {
    const cutoff = retentionCutoff(now).toISOString().slice(0,10);
    for (const day of Object.keys(this.data.days)) if (day < cutoff) delete this.data.days[day];
    if (!this.file) return Promise.resolve();
    const file = this.file;
    const json = JSON.stringify(this.data);
    const task = this.pending.then(async () => {
      await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
      await writeFile(`${file}.tmp`, json, { mode: 0o600 });
      await rename(`${file}.tmp`, file);
    });
    this.pending = task.catch(() => {});
    return task;
  }
}
