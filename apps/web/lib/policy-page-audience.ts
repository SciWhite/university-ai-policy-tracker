// Student presentation is complete; alternate audience presentations are not.
// Preserve audience coverage in the reviewed record and public API.
const studentPages = new Set([
  "harvard-university", "national-university-of-singapore", "university-of-queensland",
  "utrecht-university", "de-la-salle-university", "university-of-bristol",
  "imperial-college-london", "adelaide-university", "durham-university",
  "university-of-auckland", "stanford-university", "unsw-sydney", "university-of-sydney", "university-of-oxford", "manchester", "edinburgh",
  "ubc", "university-of-johannesburg", "anu",
  "deakin-university", "university-of-surrey",
  "university-of-cambridge", "massachusetts-institute-of-technology",
  "university-of-exeter", "keele-university", "university-of-glasgow",
  "tilburg-university", "university-of-aberdeen", "flinders-university",
  "kingston-university-london", "university-of-victoria-uvic",
  "chalmers-university-of-technology", "cardiff-university"
]);
export function isStudentOnlyPolicyPage(slug: string): boolean {
  return studentPages.has(slug);
}
