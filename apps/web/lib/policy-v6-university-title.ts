/** Formal page headings only. Catalog identities and compact search labels stay unchanged. */
const formalTitles: Record<string, string> = {
  ucl: "University College London (UCL)",
  "california-institute-of-technology": "California Institute of Technology (Caltech)",
  "eth-zurich": "ETH Zurich (Swiss Federal Institute of Technology Zurich)",
  "national-university-of-singapore": "National University of Singapore (NUS)",
  "massachusetts-institute-of-technology":
    "Massachusetts Institute of Technology (MIT)",
  "university-of-california-irvine": "University of California, Irvine (UCI)",
  uci: "University of California, Irvine (UCI)",
};

export function getPolicyV6UniversityTitle(slug: string, catalogName: string): string {
  return formalTitles[slug] ?? catalogName;
}
