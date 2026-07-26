// Shared date formatters for public-record dates. Tracker dates are calendar
// dates, so the medium style pins UTC to avoid off-by-one rendering across
// server and client timezones. The short style preserves the historical
// local-timezone behavior of the coverage/source-health surfaces.
export function formatDateMedium(value: string, locale = "en"): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeZone: "UTC"
  }).format(new Date(value));
}

export function formatDateShort(value: string, locale = "en"): string {
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}
