/** Exact accepted source-string overlay shared by server and client renderers. */
export function applyAcceptedReadingUiText<T>(value: T, translations: Readonly<Record<string, string>>): T {
  const visit = (current: unknown): unknown => {
    if (typeof current === "string") return translations[current] ?? current;
    if (Array.isArray(current)) return current.map(visit);
    if (current && typeof current === "object") return Object.fromEntries(Object.entries(current).map(([key, item]) => [key, visit(item)]));
    return current;
  };
  return visit(value) as T;
}

export function interpolate(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce(
    (output, [key, value]) => output.replaceAll(`{${key}}`, value),
    template
  );
}
