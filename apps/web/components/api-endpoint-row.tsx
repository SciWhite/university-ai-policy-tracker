interface ApiEndpointRowProps {
  description: string;
  label: string;
  method?: string;
  path: string;
  status?: string;
  url?: string;
}

export function ApiEndpointRow({
  description,
  label,
  method = "GET",
  path,
  status = "Available",
  url
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
        <span className="meta-label">{status}</span>
      </div>
    </article>
  );
}
