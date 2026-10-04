"use client";
import { useEffect, useState } from "react";
export function PluginInstallLink({ labels }: { labels: readonly string[] }) {
  const [url,setUrl] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/plugin/status", { cache: "no-store", signal: controller.signal }).then(r => r.json()).then(data => {
      if (data.status === "published" && typeof data.url === "string") {
        const candidate = new URL(data.url);
        if (candidate.protocol === "https:" && ["chatgpt.com", "platform.openai.com"].includes(candidate.hostname)) setUrl(candidate.toString());
      }
    }).catch(() => {});
    return () => controller.abort();
  },[]);
  return url ? <a href={url} className="button">{labels[10]}</a> : <p role="status">{labels[11]}</p>;
}
