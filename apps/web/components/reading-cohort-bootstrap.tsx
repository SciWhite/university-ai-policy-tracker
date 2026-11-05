"use client";

import { setClientReadingCohort } from "@/lib/reading-cohort";

/** Rendered first in <body>: client links read the cohort of the content release that rendered the page. */
export function ReadingCohortBootstrap({ slugs }: { slugs: readonly string[] }) {
  setClientReadingCohort(slugs);
  return null;
}
