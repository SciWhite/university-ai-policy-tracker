"use client";
import { useEffect, useState } from "react";
import { analyticsOptedOut, setAnalyticsOptOut } from "@/lib/analytics-preference";
export function AnalyticsPreferenceControl({ labels }: { labels: readonly string[] }) {
  const [disabled, setDisabled] = useState<boolean | null>(null);
  useEffect(() => {
    const update = () => setDisabled(analyticsOptedOut());
    update(); window.addEventListener("uapt-analytics-preference", update); window.addEventListener("storage",update);
    return () => { window.removeEventListener("uapt-analytics-preference",update); window.removeEventListener("storage",update); };
  },[]);
  return <div>
    <button type="button" className="button button--secondary" disabled={disabled === null}
      onClick={() => { setAnalyticsOptOut(!disabled); setDisabled(!disabled); }}>
      {disabled ? labels[7] : labels[6]}
    </button>
    <p role="status" aria-live="polite">{disabled === null ? "" : disabled ? labels[8] : labels[9]}</p>
  </div>;
}
