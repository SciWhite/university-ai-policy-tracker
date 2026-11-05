"use client";

import { useEffect } from "react";
import type { ReadingLocale } from "@/lib/language-catalog";
import { declarePageReadingLocales } from "@/lib/page-reading-locales";

/** Declares the languages this page has content in for the language switcher. */
export function PageReadingLocales({ path, locales }: { path: string; locales: readonly ReadingLocale[] }) {
  const key = locales.join(" ");
  useEffect(() => {
    declarePageReadingLocales({ path, locales: key.split(" ") as ReadingLocale[] });
    return () => declarePageReadingLocales(undefined);
  }, [path, key]);
  return null;
}
