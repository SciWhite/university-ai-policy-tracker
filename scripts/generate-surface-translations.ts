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
const chunkSize = 16;

async function main() {
  const source = JSON.parse(
    await readFile(path.resolve("apps/web/messages/surfaces/en.json"), "utf8")
  ) as string[];
  const requested = process.argv.slice(2) as Array<keyof typeof localeNames>;
  const locales = requested.length
    ? requested
    : (Object.keys(localeNames) as Array<keyof typeof localeNames>);

  for (const locale of locales) {
    const outputPath = path.resolve(`apps/web/messages/surfaces/${locale}.json`);
    const partialPath = `${outputPath}.partial`;
    const translated = await readPartial(partialPath);

    for (let offset = translated.length; offset < source.length; offset += chunkSize) {
      const chunk = source.slice(offset, offset + chunkSize);
      const result = await translateChunk(locale, chunk);
      translated.push(...result);
      await writeFile(partialPath, `${JSON.stringify(translated, null, 2)}\n`, "utf8");
      console.log(`${locale}:${translated.length}/${source.length}`);
    }

    if (translated.length !== source.length) throw new Error(`Length mismatch for ${locale}`);
    await writeFile(outputPath, `${JSON.stringify(translated, null, 2)}\n`, "utf8");
    await unlink(partialPath).catch(() => undefined);
  }
}

async function translateChunk(
  locale: keyof typeof localeNames,
  chunk: string[]
): Promise<string[]> {
  const protectedChunk = chunk.map((value) => maskProtectedTerms(maskPlaceholders(value)));
  const prompt = [
    `Translate this JSON array of website UI strings into ${localeNames[locale]}.`,
    "Return only a JSON array with exactly the same length and order.",
    "Translate all natural-language prose and labels with correct native spelling and diacritics.",
    "In this project, 'public university record(s)' means publicly accessible record(s) about universities, not records limited to publicly funded universities.",
    "Preserve every __UAPT_TERM_N__ and __UAPT_SLOT_N__ token exactly; they represent protected terms and runtime variables.",
    "Preserve URLs, paths, identifiers, snake_case codes and {placeholder} tokens.",
    JSON.stringify(protectedChunk)
  ].join("\n\n");

  let lastError: unknown;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const response = await fetch("http://127.0.0.1:1234/v1/chat/completions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: AbortSignal.timeout(45_000),
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
      const content = payload.choices?.[0]?.message?.content;
      if (!content) throw new Error("Empty response");
      const rawParsed = JSON.parse(
        content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")
      ) as unknown;
      const parsed = normalizeArrayResponse(rawParsed, chunk.length);
      if (!Array.isArray(parsed) || parsed.length !== chunk.length || parsed.some((value) => typeof value !== "string")) {
        throw new Error("Translated chunk shape mismatch");
      }
      const restored = (parsed as string[]).map((value, index) =>
        restorePlaceholders(chunk[index], restoreProtectedTerms(value))
      );
      assertTranslation(chunk, restored);
      return restored;
    } catch (error) {
      lastError = error;
      if (attempt === 2) break;
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

function maskProtectedTerms(value: string) {
  return protectedTerms.reduce(
    (result, term, index) => result.replaceAll(term, `__UAPT_TERM_${index}__`),
    value
  );
}

function restoreProtectedTerms(value: string) {
  return protectedTerms.reduce(
    (result, term, index) => result.replaceAll(`__UAPT_TERM_${index}__`, term),
    value
  );
}

function maskPlaceholders(value: string) {
  let index = 0;
  return value.replace(/\{[^}]+\}/g, () => `__UAPT_SLOT_${index++}__`);
}

function restorePlaceholders(source: string, value: string) {
  const placeholders = source.match(/\{[^}]+\}/g) ?? [];
  return placeholders.reduce(
    (result, placeholder, index) => result.replaceAll(`__UAPT_SLOT_${index}__`, placeholder),
    value
  );
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

function assertTranslation(source: string[], translated: string[]) {
  source.forEach((value, index) => {
    const before = value.match(/\{[^}]+\}/g) ?? [];
    const after = translated[index].match(/\{[^}]+\}/g) ?? [];
    if (JSON.stringify(before.sort()) !== JSON.stringify(after.sort())) {
      throw new Error(`Placeholder mismatch at ${index}`);
    }
    if (isProtectedValue(value) && value !== translated[index]) {
      throw new Error(`Protected value changed at ${index}`);
    }
    for (const term of protectedTerms) {
      if (countOccurrences(value, term) !== countOccurrences(translated[index], term)) {
        throw new Error(`Protected term changed at ${index}: ${term}`);
      }
    }
  });
}

function isProtectedValue(value: string) {
  return (
    value.startsWith("/") ||
    value.startsWith("http") ||
    /^[a-z0-9]+(?:_[a-z0-9]+)+$/.test(value)
  );
}

function countOccurrences(value: string, term: string) {
  return value.split(term).length - 1;
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
