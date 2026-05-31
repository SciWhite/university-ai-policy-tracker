import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

export async function findRepoRoot(): Promise<string> {
  const runtimeDataRoot = path.join(process.cwd(), ".runtime-data");

  try {
    await readFile(
      path.join(runtimeDataRoot, "data", "public-releases", "current.json"),
      "utf8"
    );
    return runtimeDataRoot;
  } catch {
    // Fall back to the source checkout during local development and build.
  }

  let current = process.cwd();

  for (;;) {
    try {
      await readFile(path.join(current, "package.json"), "utf8");
      await readdir(path.join(current, "apps"));

      return current;
    } catch {
      const parent = path.dirname(current);
      if (parent === current) return process.cwd();
      current = parent;
    }
  }
}
