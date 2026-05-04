export interface WorkerRuntimeConfig {
  redisUrl: string;
  ingestionApiBaseUrl?: string;
}

export function loadWorkerConfig(env: NodeJS.ProcessEnv): WorkerRuntimeConfig {
  if (!env.REDIS_URL) {
    throw new Error("REDIS_URL is required for the worker");
  }

  return {
    redisUrl: env.REDIS_URL,
    ingestionApiBaseUrl: env.INGESTION_API_BASE_URL
  };
}
