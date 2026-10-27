import {policyV6EvidenceLabel} from "@/lib/policy-v6-evidence-labels";
import React, { type ReactNode, type CSSProperties } from "react";
import type { UniversityToolRecord } from "@uapt/shared";
import type { SupportedLocale } from "@/lib/i18n";
import { universityToolsUi } from "@/lib/university-tools-ui";
import { policyV6StatusTone } from "@/lib/policy-v6-status";
import { PolicyV6Tools } from "./policy-v6";
import { PolicyV6Popover, PolicyV6ActionIcon } from "./policy-v6-popover";

export type PageToolRecord = Omit<UniversityToolRecord, "tool"> & {
  /** Private display-only proposed products do not extend the public taxonomy. */
  tool: UniversityToolRecord["tool"] | `proposed:${string}`;
  checkedAt?: string;
  sourceLanguage?: string;
  relationship?: "institutional_directory";
};
export type ToolDisplayCopy = Record<string, { basisSha256: string; description: string; howToObtain: string; costToUser: string }>;
const endorsementIndex = {
  institutionally_licensed_or_procured: 5,
  officially_endorsed: 6,
  self_hosted_system: 7,
  third_party_service: 8,
  explicitly_not_endorsed: 9,
  not_specified: 10,
} as const;
const availabilityIndex = {
  allowed: 11,
  conditionally_allowed: 12,
  restricted_or_blocked: 13,
  under_review: 14,
  not_recommended: 15,
  not_mentioned: 16,
} as const;
const toolLinks: Record<SupportedLocale, [string, string, string]> = {
  en: ["Access conditions", "Official evidence", "Close"],
  zh: ["获取条件", "官方原文", "关闭"],
  fr: ["Conditions d’accès", "Texte officiel", "Fermer"],
  pl: ["Warunki dostępu", "Oficjalny tekst", "Zamknij"],
  es: ["Condiciones de acceso", "Texto oficial", "Cerrar"],
  nl: ["Toegangsvoorwaarden", "Officiële tekst", "Sluiten"],
  ms: ["Syarat akses", "Teks rasmi", "Tutup"],
};

/** Access and assessment permission are separate; source text is never rewritten. */
export function UniversityAiTools({
  records,
  locale,
  currentEvidenceCheckedAt,
  draftPreview = false,
  uiLab = false,
  scopedTools,
  scopeNote,
  sectionId = "university-ai-tools",
  standalone = false,
  displayCopy,
}: {
  records: PageToolRecord[];
  locale: SupportedLocale;
  currentEvidenceCheckedAt?: string;
  draftPreview?: boolean;
  uiLab?: boolean;
  scopedTools?: ReactNode;
  scopeNote?: ReactNode;
  sectionId?: string;
  standalone?: boolean;
  displayCopy?: ToolDisplayCopy;
}) {
  const ui = universityToolsUi(locale);
  const draft = draftPreview && process.env.NODE_ENV !== "production";
  const supported = records.filter((record) =>
    record.evidence.some(
      (e) =>
        draft ||
        e.reviewState === "agent_reviewed" ||
        e.reviewState === "human_reviewed",
    ),
  );
  const links = toolLinks[locale];
  // Presentation order only. Preserve every record, original condition and evidence.
  if (uiLab) supported.sort((a, b) => v6ToolRank(a) - v6ToolRank(b));
  const content = (
    <section
      id={sectionId}
      className="university-ai-tools student-record-section"
      aria-labelledby={`${sectionId}-title`}
    >
      <h2 id={`${sectionId}-title`}>{sectionId==="university-ai-tools-scoped"?policyV6EvidenceLabel("scoped_tools",locale):ui[0]}</h2>
      {scopeNote ? <p className="university-ai-tools__boundary">{scopeNote}</p> : null}
      {!uiLab ? <p className="university-ai-tools__boundary">{ui[1]}</p> : null}
      {!supported.length ? (
        <p className="muted">{draft ? (locale === "zh" ? "工具对象及未决条件见下方候选与暂缓记录。" : "Tool objects and unresolved conditions are listed in the candidate and held records below.") : ui[3]}</p>
      ) : (
        <>
          {!uiLab ? (
            <p className="muted">
              {draft ? (
                <span>Local candidate tool evidence — pending review.</span>
              ) : currentEvidenceCheckedAt ? (
                <span lang={locale === "zh" ? "zh" : "en"} data-i18n="preserve">
                  {locale === "zh"
                    ? "工具官方证据核查日期："
                    : "Official tool evidence checked: "}
                  <time dateTime={currentEvidenceCheckedAt}>
                    {currentEvidenceCheckedAt.slice(0, 10)}
                  </time>
                  {locale === "zh"
                    ? "。访问条件可能更新，请核对官网。"
                    : ". Access conditions may change; consult the official source."}
                </span>
              ) : (
                ui[20]
              )}{" "}
              {locale !== "en" ? ui[4] : ""}
            </p>
          ) : null}
          <ul
            className="university-ai-tools__list"
            style={
              uiLab
                ? ({ "--v6-tool-count": supported.length } as CSSProperties)
                : undefined
            }
          >
            {supported.map((record, index) => {
              const prose = displayCopy?.[record.rawToolName] ?? record;
              const proseLanguage = displayCopy?.[record.rawToolName] ? locale : record.sourceLanguage || "en";
              const access = (
                <>
                  <div
                    data-i18n="preserve"
                    lang={proseLanguage}
                  >
                    {prose.description ? <p>{prose.description}</p> : null}
                    {prose.howToObtain ? <p>{prose.howToObtain}</p> : null}
                    {prose.costToUser ? <p>{prose.costToUser}</p> : null}
                  </div>
                  {record.checkedAt ? (
                    <p className="policy-v6-muted">
                      {ui[19]}:{" "}
                      <time dateTime={record.checkedAt}>
                        {record.checkedAt}
                      </time>
                    </p>
                  ) : null}
                </>
              );
              const evidence = record.evidence
                .filter(
                  (e) =>
                    draft ||
                    e.reviewState === "agent_reviewed" ||
                    e.reviewState === "human_reviewed",
                )
                .map((e, i) => (
                  <div
                    className="university-ai-tools__evidence"
                    key={`${e.sourceUrl}:${e.snapshotHash}:${i}`}
                  >
                    <a
                      href={e.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {ui[17]} {i + 1} ↗
                    </a>
                    <p className="muted">{ui[18]}</p>
                    <blockquote
                      data-i18n="preserve"
                      lang={record.sourceLanguage || "und"}
                    >
                      {e.evidenceSnippet}
                    </blockquote>
                  </div>
                ));
              return (
                <li key={`${record.rawToolName}:${record.tool}:${index}`} data-tool-review-state={record.reviewState}>
                  {draft && !["agent_reviewed","human_reviewed"].includes(record.reviewState) ? <small data-private-tool-candidate="true">{locale === "zh" ? "本地候选 · 待审核；不授予考核许可" : "Local candidate · pending review; no assessment permission"}</small> : null}
                  <div className="university-ai-tools__heading">
                    <strong
                      className="policy-summary-emphasis policy-summary-emphasis--tool"
                      data-i18n="preserve"
                    >
                      {record.rawToolName}
                    </strong>
                    <span>
                      {record.relationship === "institutional_directory"
                        ? ui[21]
                        : ui[endorsementIndex[record.endorsementType]]}
                    </span>
                    <span
                      data-policy-tone={
                        uiLab
                          ? policyV6StatusTone(
                              record.availability === "restricted_or_blocked"
                                ? "restricted"
                                : record.availability,
                            )
                          : undefined
                      }
                      className={
                        record.availability === "restricted_or_blocked"
                          ? "university-ai-tools__restricted"
                          : undefined
                      }
                    >
                      {ui[availabilityIndex[record.availability]]}
                    </span>
                  </div>
                  {uiLab && (prose.howToObtain || prose.description) ? (
                    <p
                      className="policy-v6-tool-summary"
                      data-i18n="preserve"
                      lang={proseLanguage}
                    >
                      {prose.howToObtain || prose.description}
                    </p>
                  ) : null}
                  {uiLab ? (
                    <div className="policy-v6-toolLinks">
                      <PolicyV6Popover
                        label={
                          <>
                            <PolicyV6ActionIcon kind="key" />
                            {links[0]}
                          </>
                        }
                        title={
                          <>
                            {record.rawToolName} · {links[0]}
                          </>
                        }
                        closeLabel={links[2]}
                        triggerClassName="policy-v6-textAction"
                        className="policy-v6-toolAccess"
                        width={420}
                      >
                        {access}
                      </PolicyV6Popover>
                      <PolicyV6Popover
                        label={
                          <>
                            <PolicyV6ActionIcon kind="document" />
                            {links[1]}
                          </>
                        }
                        title={
                          <>
                            {record.rawToolName} · {links[1]}
                          </>
                        }
                        closeLabel={links[2]}
                        triggerClassName="policy-v6-textAction"
                        className="policy-v6-toolOriginal"
                        width={460}
                      >
                        {evidence}
                      </PolicyV6Popover>
                    </div>
                  ) : (
                    <details>
                      <summary>{ui[2]}</summary>
                      {access}
                      {evidence}
                    </details>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
  return uiLab && !standalone ? (
    <PolicyV6Tools records={supported} scopedTools={scopedTools}>
      {content}
    </PolicyV6Tools>
  ) : (
    content
  );
}

function v6ToolRank(record: PageToolRecord): number {
  const name = record.rawToolName.toLowerCase();
  const institutional =
    record.relationship === "institutional_directory" ||
    [
      "institutionally_licensed_or_procured",
      "officially_endorsed",
      "self_hosted_system",
    ].includes(record.endorsementType);
  const base = institutional ? 0 : 100;
  if (
    ["restricted_or_blocked", "not_recommended"].includes(record.availability)
  )
    return base + 80;
  if (/api|developer|codex|bedrock|workspace studio/.test(name))
    return base + 40;
  if (/chatgpt/.test(name)) return base;
  if (/claude/.test(name)) return base + 1;
  if (/copilot chat/.test(name)) return base + 2;
  if (/copilot/.test(name)) return base + 3;
  if (/gemini/.test(name)) return base + 4;
  if (/notebook/.test(name)) return base + 5;
  if (/sandbox/.test(name)) return base + 6;
  return base + 20;
}
