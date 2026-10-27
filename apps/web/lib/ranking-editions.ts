import type { RankingSystemId } from "@uapt/shared";

/** Discovery editions are separate from the legacy crawl/API ranking defaults. */
export const rankingEditions = [
  { slug: "qs-2027", systemId: "qs", label: "QS 2027", yearLabel: "2027" },
  { slug: "qs-2026", systemId: "qs", label: "QS 2026", yearLabel: "2026" },
  { slug: "the-2027", systemId: "the", label: "THE 2027", yearLabel: "2027" },
  { slug: "the-2026", systemId: "the", label: "THE 2026", yearLabel: "2026" },
  {
    slug: "arwu-2026",
    systemId: "arwu",
    label: "ARWU 2026",
    yearLabel: "2026",
  },
  {
    slug: "arwu-2025",
    systemId: "arwu",
    label: "ARWU 2025",
    yearLabel: "2025",
  },
  {
    slug: "usnews-2026-2027",
    systemId: "usnews",
    label: "U.S. News 2026–2027",
    yearLabel: "2026–2027",
  },
  {
    slug: "usnews-2025-2026",
    systemId: "usnews",
    label: "U.S. News 2025–2026",
    yearLabel: "2025–2026",
  },
  {
    slug: "cwts-leiden-2025",
    systemId: "cwts",
    label: "CWTS Leiden 2025",
    yearLabel: "2025",
  },
] satisfies Array<{
  slug: string;
  systemId: RankingSystemId;
  label: string;
  yearLabel: string;
}>;
export const rankingSystems = [
  { id: "qs", label: "QS" },
  { id: "the", label: "THE" },
  { id: "arwu", label: "ARWU" },
  { id: "usnews", label: "U.S. News" },
  { id: "cwts", label: "CWTS Leiden" },
];
export function getRankingEdition(slug: string) {
  return rankingEditions.find((e) => e.slug === slug);
}
