import { readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

const localeNames = {
  zh: "Simplified Chinese",
  fr: "French",
  pl: "Polish",
  es: "Spanish",
  nl: "Dutch",
  ms: "Malay"
} as const;
const protectedTerms = [
  "University AI Policy Tracker",
  "GenAI",
  "ChatGPT",
  "Microsoft Copilot",
  "Copilot",
  "Academic AI",
  "JSON",
  "API",
  "MCP",
  "QS 2026",
  "THE 2026",
  "ARWU 2025",
  "U.S. News 2025-2026",
  "CWTS Leiden 2025"
];
const chunkSize = 24;

interface Leaf {
  path: Array<string | number>;
  value: string;
}

async function main() {
  const sourcePath = path.resolve("apps/web/messages/pages/en.json");
  const source = JSON.parse(await readFile(sourcePath, "utf8")) as Record<string, unknown>;
  const leaves = collectLeaves(source);
  const requested = process.argv.slice(2) as Array<keyof typeof localeNames>;
  const locales = requested.length
    ? requested
    : (Object.keys(localeNames) as Array<keyof typeof localeNames>);

  for (const locale of locales) {
    if (!localeNames[locale]) throw new Error(`Unsupported locale: ${locale}`);
    const outputPath = path.resolve(`apps/web/messages/pages/${locale}.json`);
    const partialPath = `${outputPath}.partial`;
    const translatedLeaves = await readPartial(partialPath);

    for (let offset = translatedLeaves.length; offset < leaves.length; offset += chunkSize) {
      const chunk = leaves.slice(offset, offset + chunkSize);
      const result = await translateChunk(locale, chunk);
      translatedLeaves.push(...result);
      await writeFile(partialPath, `${JSON.stringify(translatedLeaves, null, 2)}\n`, "utf8");
      console.log(`${locale}:${translatedLeaves.length}/${leaves.length}`);
    }

    if (translatedLeaves.length !== leaves.length) {
      throw new Error(`Translation length mismatch for ${locale}`);
    }
    const translated = structuredClone(source);
    leaves.forEach((leaf, index) => setAtPath(translated, leaf.path, translatedLeaves[index]));
    assertSameShape(source, translated);
    await writeFile(outputPath, `${JSON.stringify(translated, null, 2)}\n`, "utf8");
    await unlink(partialPath).catch(() => undefined);
    console.log(outputPath);
  }
}

function collectLeaves(value: unknown, currentPath: Array<string | number> = []): Leaf[] {
  if (typeof value === "string") return [{ path: currentPath, value }];
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => collectLeaves(item, [...currentPath, index]));
  }
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, child]) =>
      collectLeaves(child, [...currentPath, key])
    );
  }
  return [];
}

async function translateChunk(
  locale: keyof typeof localeNames,
  chunk: Leaf[]
): Promise<string[]> {
  const protectedIndexes = chunk
    .map((leaf, index) => (isProtected(leaf) ? index : -1))
    .filter((index) => index >= 0);
  const prompt = [
    `Translate this JSON array into ${localeNames[locale]} for a public university AI-policy research website.`,
    "Return only a JSON array with exactly the same length and order.",
    "Translate every natural-language heading, label and sentence. Use correct native spelling and diacritics.",
    "In this project, 'public university record(s)' means publicly accessible record(s) about universities, not records limited to publicly funded universities.",
    `Never translate these terms: ${protectedTerms.join(", ")}.`,
    "Preserve URLs, paths, schema versions, snake_case codes and every {placeholder} token.",
    `Items at these zero-based indexes must be copied byte-for-byte: ${protectedIndexes.join(", ") || "none"}.`,
    JSON.stringify(chunk.map((leaf) => leaf.value))
  ].join("\n\n");

  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const response = await fetch("http://127.0.0.1:1234/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: "uapt-translator",
        messages: [
          { role: "system", content: "<|think_off|>Translate precisely and output JSON only." },
          { role: "user", content: prompt }
        ],
        temperature: 0.1,
        reasoning_effort: "none",
        chat_template_kwargs: { enable_thinking: false },
        max_tokens: 5000,
        response_format: { type: "text" }
      })
    });
    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      error?: unknown;
    };
    if (!response.ok) throw new Error(JSON.stringify(payload.error ?? payload));
    try {
      const content = payload.choices?.[0]?.message?.content;
      if (!content) throw new Error("Empty response");
      const rawParsed = JSON.parse(
        content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")
      ) as unknown;
      const parsed = normalizeArrayResponse(rawParsed, chunk.length);
      if (!Array.isArray(parsed) || parsed.length !== chunk.length || parsed.some((item) => typeof item !== "string")) {
        throw new Error("Translated chunk shape mismatch");
      }
      validateChunk(chunk, parsed as string[]);
      return parsed as string[];
    } catch (error) {
      lastError = error;
      if (attempt === 3) break;
      console.warn(`${locale} retry ${attempt}: ${String(error)}`);
    }
  }
  if (chunk.length > 1) {
    const midpoint = Math.ceil(chunk.length / 2);
    console.warn(`${locale}: splitting failed chunk of ${chunk.length}`);
    return [
      ...(await translateChunk(locale, chunk.slice(0, midpoint))),
      ...(await translateChunk(locale, chunk.slice(midpoint)))
    ];
  }
  throw lastError ?? new Error(`Translation failed for ${locale}`);
}

function normalizeArrayResponse(value: unknown, expectedLength: number): unknown {
  if (Array.isArray(value)) return value;
  if (expectedLength === 1 && typeof value === "string") return [value];
  if (value && typeof value === "object") {
    const translations = (value as { translations?: unknown }).translations;
    if (Array.isArray(translations)) return translations;
  }
  return value;
}

function validateChunk(chunk: Leaf[], translated: string[]) {
  chunk.forEach((leaf, index) => {
    if (!translated[index].trim()) throw new Error(`Empty translation at ${index}`);
    if (isProtected(leaf) && leaf.value !== translated[index]) {
      throw new Error(`Protected value changed at ${index}`);
    }
    const before = leaf.value.match(/\{[^}]+\}/g) ?? [];
    const after = translated[index].match(/\{[^}]+\}/g) ?? [];
    if (JSON.stringify(before.sort()) !== JSON.stringify(after.sort())) {
      throw new Error(`Placeholder mismatch at ${index}`);
    }
    for (const term of protectedTerms) {
      if (countOccurrences(leaf.value, term) !== countOccurrences(translated[index], term)) {
        throw new Error(`Protected term changed at ${index}: ${term}`);
      }
    }
  });
}

function countOccurrences(value: string, term: string) {
  return value.split(term).length - 1;
}

function isProtected(leaf: Leaf) {
  const key = String(leaf.path.at(-1) ?? "");
  return (
    key === "href" ||
    leaf.value.startsWith("/") ||
    leaf.value.startsWith("http") ||
    /^[a-z0-9]+(?:_[a-z0-9]+)+$/.test(leaf.value)
  );
}

function setAtPath(root: Record<string, unknown>, parts: Array<string | number>, value: string) {
  let current: unknown = root;
  for (let index = 0; index < parts.length - 1; index += 1) {
    current = (current as Record<string | number, unknown>)[parts[index]];
  }
  (current as Record<string | number, unknown>)[parts.at(-1) as string | number] = value;
}

function assertSameShape(source: unknown, translated: unknown, currentPath = "") {
  if (Array.isArray(source)) {
    if (!Array.isArray(translated) || translated.length !== source.length) {
      throw new Error(`Array mismatch at ${currentPath}`);
    }
    source.forEach((item, index) => assertSameShape(item, translated[index], `${currentPath}[${index}]`));
    return;
  }
  if (source && typeof source === "object") {
    if (!translated || typeof translated !== "object" || Array.isArray(translated)) {
      throw new Error(`Object mismatch at ${currentPath}`);
    }
    const before = Object.keys(source as Record<string, unknown>).sort();
    const after = Object.keys(translated as Record<string, unknown>).sort();
    if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error(`Key mismatch at ${currentPath}`);
    for (const key of before) {
      assertSameShape(
        (source as Record<string, unknown>)[key],
        (translated as Record<string, unknown>)[key],
        currentPath ? `${currentPath}.${key}` : key
      );
    }
  }
}

async function readPartial(partialPath: string): Promise<string[]> {
  try {
    const value = JSON.parse(await readFile(partialPath, "utf8"));
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

void main();
