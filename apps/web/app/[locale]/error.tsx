"use client";

import { ErrorPage } from "@/components/error-page";

export default function RouteError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorPage error={error} onRetry={reset} />;
}
