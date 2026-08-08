"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { DocumentLink } from "@/components/document-link";
import {
  getLocaleFromPathname,
  getPathnameWithoutLocale,
  localizeHref,
  type SupportedLocale
} from "@/lib/i18n";
import { getShellMessages } from "@/lib/i18n-messages";

interface SiteNavigationLink {
  href: string;
  labelKey: string;
}

interface SiteNavigationGroup {
  labelKey: string;
  links: readonly SiteNavigationLink[];
}

type SiteNavigationItem = SiteNavigationLink | SiteNavigationGroup;

interface SiteNavigationProps {
  items: readonly SiteNavigationItem[];
  mobileUtilities?: ReactNode;
}

export function SiteNavigation({
  items,
  mobileUtilities
}: SiteNavigationProps) {
  const pathname = usePathname();
  const locale = getLocaleFromPathname(pathname);
  const shell = getShellMessages(locale);
  const labels = {
    ...shell.navigation,
    ...shell.footer
  } as Record<string, string>;
  const unprefixedPathname = getPathnameWithoutLocale(pathname);

  return (
    <nav className="site-nav" aria-label={shell.navigation.label}>
      <div className="site-nav__desktop">
        <ul className="site-nav__list">
          {items.map((item) =>
            isNavigationGroup(item) ? (
              <li key={item.labelKey}>
                <SiteNavigationDisclosure
                  active={hasActiveChild(item, unprefixedPathname)}
                  className="site-nav__group"
                  closeLabel={labelFor(labels, "closeMenu")}
                  id={`desktop-${item.labelKey}`}
                  label={labelFor(labels, item.labelKey)}
                  openLabel={labelFor(labels, "openMenu")}
                  pathname={pathname}
                >
                  <ul className="site-nav__menu-list">
                    {item.links.map((link) => (
                      <li key={link.href}>
                        <NavigationLink
                          item={link}
                          label={labelFor(labels, link.labelKey)}
                          locale={locale}
                          navArea="primary"
                          pathname={unprefixedPathname}
                          className="site-nav__menu-link"
                        />
                      </li>
                    ))}
                  </ul>
                </SiteNavigationDisclosure>
              </li>
            ) : (
              <li key={item.href}>
                <NavigationLink
                  item={item}
                  label={labelFor(labels, item.labelKey)}
                  locale={locale}
                  navArea="primary"
                  pathname={unprefixedPathname}
                  className="site-nav__link"
                />
              </li>
            )
          )}
        </ul>
      </div>

      <div className="site-nav__mobile">
        <SiteNavigationDisclosure
          className="site-nav__mobile-menu"
          closeLabel={labelFor(labels, "closeMenu")}
          id="mobile-site-menu"
          label={labelFor(labels, "menu")}
          openLabel={labelFor(labels, "openMenu")}
          pathname={pathname}
        >
          <div className="site-nav__mobile-links">
            {items.map((item) =>
              isNavigationGroup(item) ? (
                <SiteNavigationDisclosure
                  active={hasActiveChild(item, unprefixedPathname)}
                  className="site-nav__mobile-group"
                  closeLabel={labelFor(labels, "closeMenu")}
                  id={`mobile-${item.labelKey}`}
                  key={item.labelKey}
                  label={labelFor(labels, item.labelKey)}
                  openLabel={labelFor(labels, "openMenu")}
                  pathname={pathname}
                >
                  <ul className="site-nav__mobile-sub-list">
                    {item.links.map((link) => (
                      <li key={link.href}>
                        <NavigationLink
                          item={link}
                          label={labelFor(labels, link.labelKey)}
                          locale={locale}
                          navArea="mobile_menu"
                          pathname={unprefixedPathname}
                          className="site-nav__mobile-sub-link"
                        />
                      </li>
                    ))}
                  </ul>
                </SiteNavigationDisclosure>
              ) : (
                <NavigationLink
                  item={item}
                  key={item.href}
                  label={labelFor(labels, item.labelKey)}
                  locale={locale}
                  navArea="mobile_menu"
                  pathname={unprefixedPathname}
                  className="site-nav__mobile-link"
                />
              )
            )}
          </div>
          {mobileUtilities ? (
            <div
              aria-label={shell.actions.label}
              className="site-nav__mobile-utilities"
            >
              {mobileUtilities}
            </div>
          ) : null}
        </SiteNavigationDisclosure>
      </div>
    </nav>
  );
}

interface NavigationLinkProps {
  className: string;
  item: SiteNavigationLink;
  label: string;
  locale: SupportedLocale;
  navArea: "primary" | "mobile_menu";
  pathname: string;
}

function NavigationLink({
  className,
  item,
  label,
  locale,
  navArea,
  pathname
}: NavigationLinkProps) {
  const isActive = matchesPath(pathname, item.href);

  return (
    <DocumentLink
      aria-current={isActive ? "page" : undefined}
      className={className}
      data-analytics-event="nav_click"
      data-analytics-nav-area={navArea}
      data-analytics-target-kind={item.labelKey}
      href={localizeHref(item.href, locale)}
    >
      {label}
    </DocumentLink>
  );
}

interface SiteNavigationDisclosureProps {
  active?: boolean;
  children: ReactNode;
  className: string;
  closeLabel: string;
  id: string;
  label: string;
  openLabel: string;
  pathname: string;
}

function SiteNavigationDisclosure({
  active = false,
  children,
  className,
  closeLabel,
  id,
  label,
  openLabel,
  pathname
}: SiteNavigationDisclosureProps) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const summaryRef = useRef<HTMLElement>(null);
  const lastPathnameRef = useRef(pathname);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

    const frame = window.requestAnimationFrame(() => {
      const details = detailsRef.current;
      const firstFocusable = details?.querySelector<HTMLElement>(
        "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])"
      );

      if (firstFocusable && details?.contains(document.activeElement)) {
        firstFocusable.focus({ preventScroll: true });
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    if (lastPathnameRef.current === pathname) return;
    lastPathnameRef.current = pathname;

    const details = detailsRef.current;
    if (!details?.open) return;

    details.open = false;
    setOpen(false);
  }, [pathname]);

  function handleToggle() {
    setOpen(detailsRef.current?.open ?? false);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDetailsElement>) {
    if (event.key !== "Escape" || !detailsRef.current?.open) return;

    event.preventDefault();
    event.stopPropagation();
    detailsRef.current.open = false;
    setOpen(false);
    window.requestAnimationFrame(() => summaryRef.current?.focus());
  }

  return (
    <details
      className={className}
      data-active={active ? "true" : undefined}
      onKeyDown={handleKeyDown}
      onToggle={handleToggle}
      open={open}
      ref={detailsRef}
    >
      <summary
        aria-controls={id}
        aria-expanded={open}
        aria-label={
          id === "mobile-site-menu"
            ? open
              ? closeLabel
              : openLabel
            : undefined
        }
        ref={summaryRef}
      >
        <span>{label}</span>
        <span aria-hidden="true" className="site-nav__disclosure-icon" />
      </summary>
      <div className="site-nav__disclosure-panel" id={id}>
        {children}
      </div>
    </details>
  );
}

function isNavigationGroup(
  item: SiteNavigationItem
): item is SiteNavigationGroup {
  return "links" in item;
}

function hasActiveChild(
  item: SiteNavigationGroup,
  pathname: string
): boolean {
  return item.links.some((link) => matchesPath(pathname, link.href));
}

function labelFor(labels: Record<string, string>, key: string): string {
  return labels[key] ?? key;
}

function matchesPath(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
