export function xmlEscape(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function toRfc822Date(value: string | undefined): string {
  return new Date(value ?? Date.now()).toUTCString();
}

export function toAtomDate(value: string | undefined): string {
  return new Date(value ?? Date.now()).toISOString();
}

export function xmlResponse(xml: string): Response {
  return new Response(xml, {
    headers: {
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
      "Content-Type": "application/xml; charset=utf-8"
    }
  });
}
