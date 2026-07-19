"use client";

import { useEffect, useRef, useState } from "react";
import { DEFAULT_LOCALE, type SupportedLocale } from "@/lib/i18n";

type CopyTarget = "citation" | "canonicalUrl" | "publicJsonUrl";

interface CitationCopyActionsProps {
  citationText: string;
  canonicalUrl: string;
  entitySlug?: string;
  locale?: SupportedLocale;
  publicJsonUrl: string;
}

const copyTextByLocale: Record<SupportedLocale, {
  actions: string;
  copied: string;
  copy: string;
  labels: Record<CopyTarget, string>;
}> = {
  en: { actions: "Citation copy actions", copied: "Copied", copy: "Copy", labels: { citation: "citation", canonicalUrl: "canonical URL", publicJsonUrl: "public JSON URL" } },
  zh: { actions: "引用复制操作", copied: "已复制", copy: "复制", labels: { citation: "引用", canonicalUrl: "规范 URL", publicJsonUrl: "公共 JSON URL" } },
  fr: { actions: "Actions de copie de citation", copied: "Copié", copy: "Copier", labels: { citation: "la citation", canonicalUrl: "l’URL canonique", publicJsonUrl: "l’URL du JSON public" } },
  pl: { actions: "Kopiowanie cytowania", copied: "Skopiowano", copy: "Kopiuj", labels: { citation: "cytowanie", canonicalUrl: "kanoniczny URL", publicJsonUrl: "URL publicznego JSON" } },
  es: { actions: "Acciones para copiar citas", copied: "Copiado", copy: "Copiar", labels: { citation: "la cita", canonicalUrl: "la URL canónica", publicJsonUrl: "la URL del JSON público" } },
  nl: { actions: "Kopieeracties voor citaties", copied: "Gekopieerd", copy: "Kopieer", labels: { citation: "citaat", canonicalUrl: "canonieke URL", publicJsonUrl: "openbare JSON-URL" } },
  ms: { actions: "Tindakan salin petikan", copied: "Disalin", copy: "Salin", labels: { citation: "petikan", canonicalUrl: "URL kanonik", publicJsonUrl: "URL JSON awam" } }
};

export function CitationCopyActions({
  citationText,
  canonicalUrl,
  entitySlug,
  locale = DEFAULT_LOCALE,
  publicJsonUrl
}: CitationCopyActionsProps) {
  const copy = copyTextByLocale[locale];
  const [copiedTarget, setCopiedTarget] = useState<CopyTarget | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  async function handleCopy(target: CopyTarget, value: string) {
    await copyText(value);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    setCopiedTarget(target);
    timeoutRef.current = setTimeout(() => setCopiedTarget(null), 1600);
  }

  const items: Array<{ target: CopyTarget; value: string }> = [
    { target: "citation", value: citationText },
    { target: "canonicalUrl", value: canonicalUrl },
    { target: "publicJsonUrl", value: publicJsonUrl }
  ];

  return (
    <div aria-label={copy.actions} className="copy-actions">
      {items.map((item) => {
        const copied = copiedTarget === item.target;
        const label = copy.labels[item.target];

        return (
          <button
            aria-label={`${copy.copy} ${label}`}
            className="copy-button"
            data-analytics-copy-target={item.target}
            data-analytics-entity-slug={entitySlug}
            data-analytics-event="citation_copy"
            data-copy-state={copied ? "copied" : "idle"}
            key={item.target}
            onClick={() => void handleCopy(item.target, item.value)}
            type="button"
          >
            {copied ? copy.copied : `${copy.copy} ${label}`}
          </button>
        );
      })}
    </div>
  );
}

async function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch {
      // Fall back to the temporary textarea path below.
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}
