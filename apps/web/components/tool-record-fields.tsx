import { formatToolAvailability, type UniversityToolRecord } from "@uapt/shared";
import { StateLabel } from "@/components/state-label";
import { DEFAULT_LOCALE, type SupportedLocale } from "@/lib/i18n";
import { translateSurfaceText } from "@/lib/surface-localization";

interface ToolRecordFieldsProps {
  record: UniversityToolRecord;
  locale?: SupportedLocale;
}

export function ToolRecordFields({ locale = DEFAULT_LOCALE, record }: ToolRecordFieldsProps) {
  const evidenceLinks = record.evidence.slice(0, 3);

  return (
    <dl className="tool-record-fields">
      <div>
        <dt>{translateSurfaceText("Tool", locale)}</dt>
        <dd>{record.rawToolName}</dd>
      </div>
      <div>
        <dt>{translateSurfaceText("About", locale)}</dt>
        <dd>{formatOptional(record.description, locale)}</dd>
      </div>
      <div>
        <dt>{translateSurfaceText("Access", locale)}</dt>
        <dd>{formatOptional(record.howToObtain, locale)}</dd>
      </div>
      <div>
        <dt>{translateSurfaceText("Cost", locale)}</dt>
        <dd>{formatOptional(record.costToUser, locale)}</dd>
      </div>
      <div>
        <dt>{translateSurfaceText("Availability", locale)}</dt>
        <dd>{translateSurfaceText(formatToolAvailability(record.availability), locale)}</dd>
      </div>
      <div>
        <dt>{translateSurfaceText("Review", locale)}</dt>
        <dd>
          <StateLabel locale={locale} prefix="" reviewState={record.reviewState} />
        </dd>
      </div>
      <div className="tool-record-fields__evidence">
        <dt>{translateSurfaceText("Sources", locale)}</dt>
        <dd>
          {evidenceLinks.length ? (
            <div className="tool-record-fields__evidence-links">
              {evidenceLinks.map((evidence, index) => (
                <a
                  href={evidence.sourceUrl}
                  key={`${record.tool}:${evidence.sourceUrl}:${evidence.snapshotHash}`}
                >
                  {translateSurfaceText("Source", locale)} {index + 1}
                </a>
              ))}
            </div>
          ) : (
            <span>{translateSurfaceText("Not specified", locale)}</span>
          )}
        </dd>
      </div>
    </dl>
  );
}

function formatOptional(value: string | undefined, locale: SupportedLocale): string {
  const trimmed = value?.trim();

  return trimmed || translateSurfaceText("Not specified", locale);
}
