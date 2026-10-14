import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

type Claim = { id?: string; claimType: string };
type Dimension = { key: string; status: string; evidenceClaimIds: string[] };
type Profile = { dimensions: Dimension[] };

/** A structural gate, not semantic policy approval. Tool access is not assessment authority. */
export function validateAssessmentEvidence(claims: Claim[], profile: Profile): void {
  const byId = new Map<string, Claim>();
  for (const claim of claims) {
    if (!claim.id || byId.has(claim.id)) throw new Error("Missing or duplicate public Claim ID");
    byId.set(claim.id, claim);
  }
  for (const key of ["coursework", "exams"]) {
    const dimensions = profile.dimensions.filter(d => d.key === key);
    if (dimensions.length !== 1) throw new Error(`Missing or duplicate assessment dimension: ${key}`);
    const dimension = dimensions[0];
    const ids = dimension.evidenceClaimIds;
    if (!Array.isArray(ids) || new Set(ids).size !== ids.length) throw new Error(`Invalid basis IDs: ${key}`);
    const basis = ids.map(id => {
      const claim = byId.get(id);
      if (!claim) throw new Error(`Unknown assessment basis ID: ${id}`);
      return claim;
    });
    if (basis.length && basis.every(c => c.claimType === "ai_tool_treatment")) {
      throw new Error(`Tool-only assessment basis: ${key}`);
    }
    if (!basis.length && !["unclear", "not_mentioned"].includes(dimension.status)) {
      throw new Error(`Assessment conclusion without evidence: ${key}`);
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 2) throw new Error("Usage: validate-assessment-evidence.ts <university.json> <analysis.json>");
  const [university, analysis] = await Promise.all(args.map(async file => {
    const value = JSON.parse(await readFile(file, "utf8"));
    return value.data ?? value;
  }));
  if (!Array.isArray(university.claims) || !Array.isArray(analysis.dimensions)) {
    throw new Error("Expected a public university summary and analysis profile");
  }
  validateAssessmentEvidence(university.claims, analysis);
  process.stdout.write(JSON.stringify({ status: "STRUCTURAL_BASIS_VALIDATED", semanticApproval: false }) + "\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { process.stderr.write(String(error) + "\n"); process.exitCode = 1; });
}
