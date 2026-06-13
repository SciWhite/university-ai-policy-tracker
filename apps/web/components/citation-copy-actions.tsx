"use client";

import { useEffect, useRef, useState } from "react";

type CopyTarget = "citation" | "canonicalUrl" | "publicJsonUrl";

interface CitationCopyActionsProps {
  citationText: string;
  canonicalUrl: string;
  entitySlug?: string;
  publicJsonUrl: string;
}

const copyLabels: Record<CopyTarget, string> = {
  citation: "citation",
  canonicalUrl: "canonical URL",
  publicJsonUrl: "public JSON URL"
};

export function CitationCopyActions({
  citationText,
  canonicalUrl,
  entitySlug,
  publicJsonUrl
}: CitationCopyActionsProps) {
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
    <div aria-label="Citation copy actions" className="copy-actions">
      {items.map((item) => {
        const copied = copiedTarget === item.target;
        const label = copyLabels[item.target];

        return (
          <button
            aria-label={`Copy ${label}`}
            className="copy-button"
            data-analytics-copy-target={item.target}
            data-analytics-entity-slug={entitySlug}
            data-analytics-event="citation_copy"
            data-copy-state={copied ? "copied" : "idle"}
            key={item.target}
            onClick={() => void handleCopy(item.target, item.value)}
            type="button"
          >
            {copied ? "Copied" : `Copy ${label}`}
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
