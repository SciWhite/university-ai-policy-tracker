"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { getLocaleFromPathname } from "@/lib/i18n";
import { trackPageView, trackResearchEvent } from "@/lib/analytics-client";
import {
  getEndpointKind,
  getEntitySlugFromPathname,
  getPageType,
  getQueryAnalytics,
  getSourceDomain,
  getTargetKind,
  type AnalyticsEventName,
  type AnalyticsProperties
} from "@/lib/analytics-events";

export function AnalyticsEventBridge() {
  const pathname = usePathname();
  const locale = getLocaleFromPathname(pathname);
  const pageType = getPageType(pathname);
  const pageEntitySlug = getEntitySlugFromPathname(pathname);

  useEffect(() => {
    if (pathname.startsWith("/internal/analytics")) return;

    trackPageView({
      locale,
      page_type: pageType,
      entity_slug: pageEntitySlug
    });
  }, [locale, pageEntitySlug, pageType, pathname]);

  useEffect(() => {
    if (pathname.startsWith("/internal/analytics")) return;

    let remainingMs = 10_000;
    let visibleSince = 0;
    let timer: number | undefined;
    let sent = false;

    const sendEngaged = () => {
      if (sent) return;
      sent = true;
      trackResearchEvent("session_engaged", {
        active_time_bucket: "10s+",
        entity_slug: pageEntitySlug,
        locale,
        page_type: pageType
      });
    };

    const start = () => {
      if (sent || document.visibilityState !== "visible") return;
      visibleSince = Date.now();
      timer = window.setTimeout(sendEngaged, remainingMs);
    };

    const pause = () => {
      if (timer !== undefined) window.clearTimeout(timer);
      timer = undefined;
      if (visibleSince) {
        remainingMs = Math.max(0, remainingMs - (Date.now() - visibleSince));
        visibleSince = 0;
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") start();
      else pause();
    };

    document.addEventListener("visibilitychange", handleVisibility);
    start();

    return () => {
      pause();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [locale, pageEntitySlug, pageType, pathname]);

  useEffect(() => {
    if (pathname.startsWith("/internal/analytics")) return;

    function baseProperties(): AnalyticsProperties {
      return {
        locale,
        page_type: pageType,
        entity_slug: pageEntitySlug
      };
    }

    function handleClick(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const explicitElement = target.closest<HTMLElement>(
        "[data-analytics-event]"
      );

      if (explicitElement) {
        const eventName = explicitElement.dataset
          .analyticsEvent as AnalyticsEventName;
        if (!eventName) return;

        trackResearchEvent(eventName, {
          ...baseProperties(),
          ...propertiesFromDataset(explicitElement.dataset),
          ...linkProperties(explicitElement)
        });
        return;
      }

      const anchor = target.closest<HTMLAnchorElement>("a[href]");
      if (!anchor) return;

      const href = anchor.getAttribute("href") ?? "";
      const targetKind = getTargetKind(href);

      if (targetKind === "api" || targetKind === "public_json") {
        trackResearchEvent("api_link_click", {
          ...baseProperties(),
          ...linkProperties(anchor)
        });
      }
    }

    function handleSubmit(event: SubmitEvent) {
      const target = event.target;
      if (!(target instanceof HTMLFormElement)) return;
      const eventName = target.dataset.analyticsEvent as AnalyticsEventName;
      if (!eventName) return;

      const formData = new FormData(target);
      const query = String(formData.get("q") ?? "");

      trackResearchEvent(eventName, {
        ...baseProperties(),
        ...propertiesFromDataset(target.dataset),
        ...getQueryAnalytics(query)
      });
    }

    document.addEventListener("click", handleClick);
    document.addEventListener("submit", handleSubmit);

    return () => {
      document.removeEventListener("click", handleClick);
      document.removeEventListener("submit", handleSubmit);
    };
  }, [locale, pageEntitySlug, pageType, pathname]);

  return null;
}

function propertiesFromDataset(dataset: DOMStringMap): AnalyticsProperties {
  const properties: AnalyticsProperties = {};

  for (const [key, value] of Object.entries(dataset)) {
    if (!key.startsWith("analytics") || key === "analyticsEvent") continue;
    const propertyKey = key
      .replace(/^analytics/, "")
      .replace(/^[A-Z]/, (letter) => letter.toLowerCase());

    if (propertyKey) {
      properties[propertyKey] = value;
    }
  }

  return properties;
}

function linkProperties(element: HTMLElement): AnalyticsProperties {
  const anchor =
    element instanceof HTMLAnchorElement
      ? element
      : element.closest<HTMLAnchorElement>("a[href]");
  const href = anchor?.getAttribute("href") ?? "";

  if (!href) return {};

  return {
    endpoint_kind: getEndpointKind(href),
    source_domain: getSourceDomain(href),
    target_kind: getTargetKind(href)
  };
}
