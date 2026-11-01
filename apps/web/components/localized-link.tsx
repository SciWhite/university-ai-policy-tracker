"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentProps } from "react";
import {
  localizeHref,
  readingLocaleForLink
} from "@/lib/i18n";
import type { ReadingLocale } from "@/lib/language-catalog";

type LocalizedLinkProps = ComponentProps<typeof Link> & {
  href: string;
  localeOverride?: ReadingLocale;
};

export function LocalizedLink({
  href,
  localeOverride,
  locale: _legacyLocale,
  prefetch = false,
  ...props
}: LocalizedLinkProps) {
  const pathname = usePathname();
  const locale = readingLocaleForLink(pathname, localeOverride);

  return (
    <Link href={localizeHref(href, locale)} prefetch={prefetch} {...props} />
  );
}
