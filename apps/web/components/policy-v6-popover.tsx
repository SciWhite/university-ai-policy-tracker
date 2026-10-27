"use client";

import React, {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";

export function PolicyV6ActionIcon({
  kind,
}: {
  kind: "document" | "copy" | "external" | "book" | "key";
}) {
  return (
    <svg
      className="policy-v6-actionIcon"
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {kind === "copy" ? (
        <>
          <rect x="8" y="8" width="12" height="12" rx="2" />
          <path d="M15 8V4H4v11h4" />
        </>
      ) : kind === "external" ? (
        <>
          <path d="M14 4h6v6m0-6L10 14" />
          <path d="M10 4H4v16h16v-6" />
        </>
      ) : kind === "book" ? (
        <>
          <path d="M12 5v16m0-16C8 3 4 3 2 5v15c3-2 7-1 10 1 3-2 7-3 10-1V5c-2-2-6-2-10 0Z" />
        </>
      ) : kind === "key" ? (
        <>
          <circle cx="8" cy="8" r="5" />
          <path d="m12 12 9 9m-5-5 3-3m0 6 3-3" />
        </>
      ) : (
        <>
          <path d="M5 3h9l5 5v13H5Zm9 0v6h5M8 13h8m-8 4h6" />
        </>
      )}
    </svg>
  );
}

/** Native top-layer popovers: light dismissal without reflow, a backdrop or a scroll lock.
 * Children remain in the server HTML, including complete original quotations. */
export function PolicyV6Popover({
  label,
  title = label,
  children,
  width = 440,
  id: suppliedId,
  className = "",
  open: controlledOpen,
  onOpenChange,
  triggerClassName = "",
  closeLabel = "Close",
  align = "trigger",
  accessibleLabel,
  mobileReading = false,
  reader = false,
}: {
  label: ReactNode;
  title?: ReactNode;
  children: ReactNode;
  width?: number;
  id?: string;
  className?: string;
  triggerClassName?: string;
  closeLabel?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  align?: "trigger" | "content" | "start";
  accessibleLabel?: string;
  /** Opt-in reading space for long evidence; other schools retain their placement. */
  mobileReading?: boolean;
  /** Local presentation pilot: fixed reading overlay without page reflow. */
  reader?: boolean;
}) {
  const generatedId = useId();
  const id = suppliedId ?? generatedId;
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const change = (value: boolean) => {
    setOpen(value);
    onOpenChange?.(value);
  };
  const place = () => {
    const node = panel.current,
      button = trigger.current;
    if (!node || !button) return;
    // Reader dimensions come from CSS, including before hydration and in print.
    if (reader) return;
    const box = button.getBoundingClientRect();
    const gutter = 12,
      gap = 8;
    const available = Math.max(160, window.innerHeight - gutter * 2);
    if (mobileReading) {
      const body = node.querySelector<HTMLElement>(".policy-v6-popoverBody");
      const header = node.querySelector<HTMLElement>(".policy-v6-popoverHeader");
      const readingHeight = (body?.scrollHeight ?? 0) + (header?.offsetHeight ?? 0);
      const expanded = window.innerWidth <= 600 &&
        (readingHeight > window.innerHeight * 0.55 || node.querySelectorAll("blockquote").length > 1);
      node.dataset.mobileReading = expanded ? "expanded" : "compact";
      node.style.height = expanded ? `${available}px` : "";
      if (expanded) {
        node.style.width = `${window.innerWidth - gutter * 2}px`;
        node.style.maxHeight = `${available}px`;
        node.style.left = `${gutter}px`;
        node.style.top = `${gutter}px`;
        return;
      }
    }
    const content =
      align === "content"
        ? button.closest(".policy-reference-content")?.getBoundingClientRect()
        : undefined;
    node.style.width = `${Math.min(width, window.innerWidth - gutter * 2, content?.width ?? Infinity)}px`;
    node.style.maxHeight = `${available}px`;
    const height = Math.min(node.scrollHeight, available);
    const below = window.innerHeight - box.bottom - gap - gutter;
    const above = box.top - gap - gutter;
    const flip = below < height && above > below;
    node.style.maxHeight = `${Math.min(available, Math.max(160, flip ? above : below))}px`;
    const measuredHeight = Math.min(height, parseFloat(node.style.maxHeight));
    const top = flip ? box.top - gap - measuredHeight : box.bottom + gap;
    node.style.left = `${Math.max(gutter, Math.min(content?.left ?? (align === "start" ? box.left : box.right - node.offsetWidth), window.innerWidth - node.offsetWidth - gutter))}px`;
    node.style.top = `${Math.max(gutter, Math.min(top, window.innerHeight - measuredHeight - gutter))}px`;
  };
  useEffect(() => {
    const node = panel.current;
    if (!node) return;
    // React 19 serializes hidden as a boolean, so set its enumerated value
    // after hydration. CSS keeps closed SSR readers collapsed in the meantime.
    if (reader && !node.matches(":popover-open")) readerBody(node)?.setAttribute("hidden", "until-found");
    // A native trigger can be used before hydration; adopt and position that state.
    if (controlledOpen === undefined) {
      if (node.matches(":popover-open")) {
        change(true);
        place();
      }
      return;
    }
    if (controlledOpen && !node.matches(":popover-open")) {
      node.showPopover();
      place();
    }
    if (!controlledOpen && node.matches(":popover-open")) node.hidePopover();
  }, [controlledOpen]);
  useEffect(() => {
    if (!open) return;
    place();
    const observer = new ResizeObserver(place);
    if (panel.current) observer.observe(panel.current);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, width, align, mobileReading, reader]);
  useEffect(() => {
    if (!reader || !open) return;
    // Fragment navigation can move focus to the document body. Escape must still
    // return to this reader's trigger, rather than relying on native focus return.
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !panel.current?.matches(":popover-open")) return;
      event.preventDefault();
      panel.current.hidePopover();
      trigger.current?.focus({ preventScroll: true });
    };
    document.addEventListener("keydown", closeOnEscape, true);
    return () => document.removeEventListener("keydown", closeOnEscape, true);
  }, [reader, open]);
  return (
    <span className="policy-v6-popoverAnchor">
      <button
        ref={trigger}
        type="button"
        className={triggerClassName}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={id}
        aria-label={accessibleLabel}
        popoverTarget={id}
        onClick={(event) => {
          event.preventDefault();
          const node = panel.current;
          if (node?.matches(":popover-open")) node.hidePopover();
          else {
            node?.showPopover();
            place();
          }
        }}
      >
        {label}
      </button>
      <div
        ref={panel}
        id={id}
        popover="auto"
        role="dialog"
        aria-modal="false"
        aria-labelledby={`${id}-title`}
        className={`policy-v6-popover ${className}`}
        data-reader={reader || undefined}
        style={reader ? undefined : { width }}
        onKeyDown={mobileReading || reader ? (event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            panel.current?.hidePopover();
            trigger.current?.focus(reader ? { preventScroll: true } : undefined);
          }
        } : undefined}
        onToggle={(event) => {
          const isOpen = (event.nativeEvent as ToggleEvent).newState === "open";
          change(isOpen);
          if (isOpen) {
            if (reader) {
              readerBody(panel.current)?.removeAttribute("hidden");
              panel.current?.removeAttribute("data-reader-search-prepared");
            }
            place();
            if ((mobileReading || reader) && !panel.current?.hasAttribute("data-reader-find-reveal")) {
              nodeHeading(panel.current)?.focus({ preventScroll: true });
            }
            document.dispatchEvent(
              new CustomEvent("policy-v6-popover-open", { detail: id }),
            );
          } else if (reader) {
            // A user may start page-find before this queued close toggle runs.
            // Keep the body searchable if the keyboard fallback already prepared it.
            if (!panel.current?.hasAttribute("data-reader-search-prepared")) readerBody(panel.current)?.setAttribute("hidden", "until-found");
            panel.current?.removeAttribute("data-reader-find-reveal");
            if (nodeHeading(panel.current) === document.activeElement) trigger.current?.focus({ preventScroll: true });
          }
        }}
      >
        <header className="policy-v6-popoverHeader">
          <h3 id={`${id}-title`} tabIndex={mobileReading || reader ? -1 : undefined}>{title}</h3>
          <button
            type="button"
            aria-label={closeLabel}
            className="policy-v6-popoverClose"
            onClick={() => {
              panel.current?.hidePopover();
              trigger.current?.focus(reader ? { preventScroll: true } : undefined);
            }}
          >
            ×
          </button>
        </header>
        <div className="policy-v6-popoverBody" hidden={reader || undefined}>{children}</div>
      </div>
    </span>
  );
}

function nodeHeading(panel: HTMLDivElement | null) {
  return panel?.querySelector<HTMLElement>(".policy-v6-popoverHeader h3");
}

function readerBody(panel: HTMLDivElement | null) {
  return panel?.querySelector<HTMLElement>(".policy-v6-popoverBody");
}
