import { isPolicyV6Preview } from "./policy-v6-gate";

export function v6PreviewLayout(layout: unknown, environment = process.env.NODE_ENV) {
  return environment === "development" && (layout === "v6" || layout === "harvard-ui-lab") ? "v6" : undefined;
}

export function v6RecordHref(href: string, slug: string, layout: unknown, environment = process.env.NODE_ENV) {
  const preview = v6PreviewLayout(layout, environment);
  return preview && isPolicyV6Preview(slug, preview, environment) ? `${href}?layout=${preview}` : href;
}

export function v6NavigationUrl(href: string, environment = process.env.NODE_ENV) {
  const url = new URL(href);
  const layout = url.searchParams.get("layout");
  if (layout !== null && !v6PreviewLayout(layout, environment)) url.searchParams.delete("layout");
  return url;
}

export function v6ShareUrl(href: string, selected: readonly string[], environment = process.env.NODE_ENV) {
  const url = v6NavigationUrl(href, environment);
  if (selected.length > 1) {
    url.searchParams.set("compare", selected.join(","));
    url.searchParams.set("view", "compare");
  } else {
    url.searchParams.delete("compare");
    url.searchParams.delete("view");
  }
  return url.href;
}

export function v6TopicUrl(href: string, key: string, environment = process.env.NODE_ENV) {
  const url = v6NavigationUrl(href, environment);
  url.hash = `snapshot-evidence-${key}`;
  url.searchParams.delete("compare");
  url.searchParams.delete("view");
  return url.href;
}

export function stripV6Layout(href: string, history: Pick<History, "replaceState" | "state">, environment = process.env.NODE_ENV) {
  if (environment !== "production") return;
  const url = new URL(href);
  if (!url.searchParams.has("layout")) return;
  url.searchParams.delete("layout");
  history.replaceState(history.state, "", url);
}
