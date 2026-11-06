/** Select the content release before the first request; SIGHUP re-reads the pointer. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { registerContentRuntime } = await import("./lib/content-runtime-instrumentation");
  registerContentRuntime();
  const { startRuntimeWarmup } = await import("./lib/runtime-warmup");
  startRuntimeWarmup();
}
