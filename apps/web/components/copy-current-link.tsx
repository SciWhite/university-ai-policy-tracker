"use client";
import { useState } from "react";
import { mockupCopy } from "@/lib/mockup-copy";
import type { SupportedLocale } from "@/lib/i18n";
export function CopyCurrentLink({ locale }: { locale: SupportedLocale }) {
  const [copied, setCopied] = useState(false);
  const copy = mockupCopy(locale);
  return (
    <button
      className="discovery-copy-link"
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(location.href);
          setCopied(true);
        } catch {
          setCopied(false);
        }
      }}
    >
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        aria-hidden="true"
      >
        <path d="M9 3h12v14H9Z" />
        <path d="M5 7H3v14h12v-2" />
      </svg>
      <span aria-live="polite">{copied ? copy.copied : copy.copyLink}</span>
    </button>
  );
}
