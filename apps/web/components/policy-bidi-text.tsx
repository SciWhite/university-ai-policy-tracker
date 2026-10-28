import React from "react";

const identifiers = /https?:\/\/[^\s<>]+|\{[^{}]+\}|\b(?:cc|claim)-[A-Za-z0-9_-]+|\b[a-f0-9]{64}\b|\b\d{4}-\d{2}-\d{2}\b|\b(?:ChatGPT(?: Edu)?|UTOL|UTokyo|HGSE|PARTIAL|T[0-5])\b/g;

/** Isolate identifiers visually without adding, deleting or translating bytes. */
export function PolicyBidiText({ text }: { text: string }) {
  const children: React.ReactNode[] = [];
  let cursor = 0;
  for (const match of text.matchAll(identifiers)) {
    const start = match.index!;
    children.push(text.slice(cursor, start));
    const raw = match[0];
    const suffix = raw.startsWith("http") ? raw.match(/[.,;:!?…、。，،؛؟)\]]+$/u)?.[0] ?? "" : "";
    const token = suffix ? raw.slice(0, -suffix.length) : raw;
    children.push(<bdi dir="ltr" key={start} translate="no">{token}</bdi>, suffix);
    cursor = start + raw.length;
  }
  children.push(text.slice(cursor));
  return <span className="policy-bidi-text" dir="auto">{children}</span>;
}
