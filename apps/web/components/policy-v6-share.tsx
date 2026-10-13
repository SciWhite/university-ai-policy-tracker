"use client";
import React, { useEffect, useId, useRef, useState } from "react";
import type { policyV6Copy } from "@/lib/policy-v6-copy";

// A light-dismiss popover keeps the page scrollable and the trigger in context.
export function PolicyV6Share({
  ui,
  name,
  getUrl,
  copy,
}: {
  ui: ReturnType<typeof policyV6Copy>;
  name: string;
  getUrl: () => string;
  copy: (url: string) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [fallback, setFallback] = useState(false);
  const [above, setAbove] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target))
        setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    const position = () => {
      const box = trigger.current?.getBoundingClientRect();
      if (box) setAbove(window.innerHeight - box.bottom < 230 && box.top > 230);
    };
    position();
    const otherPopover = () => setOpen(false);
    document.addEventListener("policy-v6-popover-open", otherPopover);
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    window.addEventListener("resize", position);
    return () => {
      document.removeEventListener("policy-v6-popover-open", otherPopover);
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
      window.removeEventListener("resize", position);
    };
  }, [open]);
  async function copyLink(close = true) {
    const success = await copy(url);
    if (success && close) setOpen(false);
    else if (!success) setFallback(true);
  }
  return (
    <div
      className="policy-v6-share"
      ref={root}
      onBlur={(event) => {
        if (
          event.relatedTarget instanceof Node &&
          !event.currentTarget.contains(event.relatedTarget)
        )
          setOpen(false);
      }}
    >
      <button
        ref={trigger}
        aria-expanded={open}
        aria-controls={id}
        aria-haspopup="dialog"
        onClick={() => {
          setUrl(getUrl());
          setFallback(false);
          setOpen((value) => !value);
        }}
      >
        {ui.share} ↗
      </button>
      {open ? (
        <div
          id={id}
          className="policy-v6-sharePopover"
          data-above={above}
          role="dialog"
          aria-modal="false"
          aria-label={ui.share}
        >
          <strong>{ui.share}</strong>
          <div className="policy-v6-shareIcons">
            {[
              {
                key: "whatsapp",
                name: "WhatsApp",
                href: `https://wa.me/?text=${encodeURIComponent(`${name}\n${url}`)}`,
              },
              {
                key: "x",
                name: "X",
                href: `https://x.com/intent/tweet?${new URLSearchParams({ text: name, url })}`,
              },
              {
                key: "discord",
                name: "Discord",
                href: "https://discord.com/channels/@me",
                copy: true,
              },
              {
                key: "openai",
                name: "ChatGPT",
                href: "https://chatgpt.com/",
                copy: true,
              },
            ].map((platform) => (
              <a
                key={platform.key}
                href={platform.href}
                target="_blank"
                rel="noopener noreferrer"
                title={
                  platform.copy
                    ? `${platform.name} · ${ui.copyAndOpen}`
                    : platform.name
                }
                aria-label={
                  platform.copy
                    ? `${platform.name} · ${ui.copyAndOpen}`
                    : platform.name
                }
                onClick={() => {
                  if (platform.copy) void copyLink(false);
                  else setOpen(false);
                }}
              >
                <span className="policy-v6-brandIcon" data-brand={platform.key}>
                  <img
                    src={`/assets/share/${platform.key}.svg`}
                    width={24}
                    height={24}
                    alt=""
                  />
                </span>
                <span>{platform.name}</span>
              </a>
            ))}
          </div>
          <button
            className="policy-v6-copyLink"
            onClick={() => void copyLink()}
          >
            <span aria-hidden="true">↗</span>
            {ui.copy}
          </button>
          {fallback ? (
            <input
              readOnly
              aria-label={ui.shareLink}
              value={url}
              onFocus={(event) => event.currentTarget.select()}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
