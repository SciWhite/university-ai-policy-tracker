import { contentRuntimeStatus, refreshContentPointer } from "./content-runtime";

/** Node runtime only (see instrumentation.ts): select content at startup, re-read on SIGHUP. */
export function registerContentRuntime() {
  refreshContentPointer();
  const { jsonCache: _cache, ...status } = contentRuntimeStatus();
  console.log(JSON.stringify({ message: "Content selected", ...status }));
  process.on("SIGHUP", () => {
    const selected = refreshContentPointer();
    console.log(JSON.stringify({ message: "Content pointer re-read", contentId: selected.contentId, error: selected.error }));
  });
}
