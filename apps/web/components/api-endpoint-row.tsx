import type { ReadingLocale } from "@/lib/language-catalog";
import { translateSurfaceText } from "@/lib/surface-localization";

interface ApiEndpointRowProps {
  description: string;
  label: string;
  method?: string;
  path: string;
  status?: string;
  url?: string;
  readingLocale?: ReadingLocale;
  sharedUiText?: Readonly<Record<string, string>>;
}

export function ApiEndpointRow({
  description,
  label,
  method = "GET",
  path,
  status = "Available",
  url,
  readingLocale = "en",
  sharedUiText = {}
}: ApiEndpointRowProps) {
  const content = (
    <>
      <span className="api-endpoint-row__method">{method}</span>
      <code>{path}</code>
    </>
  );

  return (
    <article className="api-endpoint-row">
      <div>
        <h3>{label}</h3>
        <p>{description}</p>
      </div>
      <div className="api-endpoint-row__target">
        {url ? <a href={url}>{content}</a> : content}
        <span className="meta-label">{translateSurfaceText(status, readingLocale, sharedUiText)}</span>
      </div>
    </article>
  );
}
