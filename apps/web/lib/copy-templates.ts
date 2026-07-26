// Client-safe template interpolation for copy passed from server components.
// Keeps locale JSON trees out of client bundles: server code resolves the
// localized template string, clients only interpolate values into it.
export function formatCopyTemplate(
  template: string,
  values: Record<string, unknown>
): string {
  return template.replace(/\{([^}]+)\}/g, (_match, key: string) =>
    String(values[key] ?? "")
  );
}
