import { formatToolAvailability, type UniversityToolRecord } from "@uapt/shared";
import { StateLabel, getReviewStateLabel } from "@/components/state-label";
import { DEFAULT_LOCALE, type SupportedLocale } from "@/lib/i18n";
import { translateSurfaceText } from "@/lib/surface-localization";
import type { ReadingLocale } from "@/lib/language-catalog";

interface ToolRecordFieldsProps {
  record: UniversityToolRecord;
  locale?: SupportedLocale;
  readingLocale?: ReadingLocale;
  sharedUiText?: Readonly<Record<string, string>>;
}

export function ToolRecordFields({ locale = DEFAULT_LOCALE, readingLocale = locale, sharedUiText = {}, record }: ToolRecordFieldsProps) {
  const t = (source: string) => translateSurfaceText(source, readingLocale, sharedUiText);
  const evidenceLinks = record.evidence.slice(0, 3);

  return (
    <dl className="tool-record-fields">
      <div>
        <dt>{t("Tool")}</dt>
        <dd>{record.rawToolName}</dd>
      </div>
      <div>
        <dt>{t("About")}</dt>
        <dd>{record.description?.trim() || t("Not specified")}</dd>
      </div>
      <div>
        <dt>{t("Access")}</dt>
        <dd>{record.howToObtain?.trim() || t("Not specified")}</dd>
      </div>
      <div>
        <dt>{t("Cost")}</dt>
        <dd>{record.costToUser?.trim() || t("Not specified")}</dd>
      </div>
      <div>
        <dt>{t("Availability")}</dt>
        <dd>{t(formatToolAvailability(record.availability))}</dd>
      </div>
      <div>
        <dt>{t("Review")}</dt>
        <dd>
          <StateLabel locale={locale} prefix="" reviewState={record.reviewState} displayLabel={t(getReviewStateLabel(record.reviewState, locale))} />
        </dd>
      </div>
      <div className="tool-record-fields__evidence">
        <dt>{t("Sources")}</dt>
        <dd>
          {evidenceLinks.length ? (
            <div className="tool-record-fields__evidence-links">
              {evidenceLinks.map((evidence, index) => (
                <a
                  href={evidence.sourceUrl}
                  key={JSON.stringify([record.tool, evidence.sourceUrl, evidence.snapshotHash, evidence.evidenceSnippet])}
                >
                  {t("Source")} {index + 1}
                </a>
              ))}
            </div>
          ) : (
            <span>{t("Not specified")}</span>
          )}
        </dd>
      </div>
    </dl>
  );
}
