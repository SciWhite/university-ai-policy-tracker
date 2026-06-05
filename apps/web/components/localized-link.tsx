"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentProps } from "react";
import {
  getLocaleFromPathname,
  localizeHref,
  type SupportedLocale
} from "@/lib/i18n";

type LocalizedLinkProps = ComponentProps<typeof Link> & {
  href: string;
  localeOverride?: SupportedLocale;
};

export function LocalizedLink({
  href,
  localeOverride,
  prefetch = false,
  ...props
}: LocalizedLinkProps) {
  const pathname = usePathname();
  const locale = localeOverride ?? getLocaleFromPathname(pathname);

  return (
    <Link href={localizeHref(href, locale)} prefetch={prefetch} {...props} />
  );
}
