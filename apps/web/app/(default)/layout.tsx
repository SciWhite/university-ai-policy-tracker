import "../globals.css";
import type { ReactNode } from "react";
import { RootDocument } from "../root-document";
import { DEFAULT_LOCALE } from "@/lib/i18n";
import { getSiteBaseUrl } from "@/lib/site-url";

export const metadata = {
  metadataBase: new URL(getSiteBaseUrl()),
  title: "University AI Policy Tracker",
  description:
    "Open, evidence-backed database of university AI policies, source snapshots, and citation-ready public JSON."
};

export default function DefaultRootLayout({ children }: { children: ReactNode }) {
  return <RootDocument locale={DEFAULT_LOCALE}>{children}</RootDocument>;
}
