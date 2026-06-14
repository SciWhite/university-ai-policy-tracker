import {
  formatToolAvailability,
  formatToolEndorsementType,
  formatToolLabel,
  type UniversityToolRecord
} from "@uapt/shared";
import { StateLabel } from "@/components/state-label";

interface ToolRecordFieldsProps {
  record: UniversityToolRecord;
}

export function ToolRecordFields({ record }: ToolRecordFieldsProps) {
  const evidenceLinks = record.evidence.slice(0, 3);

  return (
    <dl className="tool-record-fields">
      <div>
        <dt>tool</dt>
        <dd>
          <span>{formatToolLabel(record.tool)}</span>
          <span className="tool-record-fields__slug">({record.tool})</span>
        </dd>
      </div>
      <div>
        <dt>description</dt>
        <dd>{formatOptional(record.description)}</dd>
      </div>
      <div>
        <dt>howToObtain</dt>
        <dd>{formatOptional(record.howToObtain)}</dd>
      </div>
      <div>
        <dt>costToUser</dt>
        <dd>{formatOptional(record.costToUser)}</dd>
      </div>
      <div>
        <dt>availability</dt>
        <dd>{formatToolAvailability(record.availability)}</dd>
      </div>
      <div>
        <dt>endorsementType</dt>
        <dd>{formatToolEndorsementType(record.endorsementType)}</dd>
      </div>
      <div>
        <dt>reviewState</dt>
        <dd>
          <StateLabel prefix="" reviewState={record.reviewState} />
        </dd>
      </div>
      <div className="tool-record-fields__evidence">
        <dt>evidence[]</dt>
        <dd>
          {evidenceLinks.length ? (
            <div className="tool-record-fields__evidence-links">
              {evidenceLinks.map((evidence, index) => (
                <a
                  href={evidence.sourceUrl}
                  key={`${record.tool}:${evidence.sourceUrl}:${evidence.snapshotHash}`}
                >
                  Source {index + 1}
                </a>
              ))}
            </div>
          ) : (
            <span>Not specified</span>
          )}
        </dd>
      </div>
    </dl>
  );
}

function formatOptional(value?: string): string {
  const trimmed = value?.trim();

  return trimmed || "Not specified";
}
