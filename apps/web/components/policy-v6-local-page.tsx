import React from "react";
import type { SupportedLocale } from "@/lib/i18n";
import type { PolicyV6Data } from "@/lib/policy-v6";
import type { LocalV6Evidence } from "@/lib/policy-v6-local-evidence";
import { policyV6AgentReviewLabel } from "@/lib/policy-v6-review";
import { getPolicyV6IllustratedScene } from "@/lib/policy-v6-illustrated-scene";
import { translatePolicyReferenceUi as translate } from "@/lib/policy-reference-ui";
import { groupReviewedClaimsByClaimType } from "@/lib/university-claims-organization";
import { EntityHeader } from "./entity-header";
import { getPolicyV6UniversityTitle } from "@/lib/policy-v6-university-title";
import { UniversityMark } from "./university-mark";
import { PolicyV6HeaderLocation } from "./policy-v6-header-location";
import { RelatedUniversities } from "./related-universities";
import type { RelatedUniversityRef } from "@/lib/related-universities";
import {
  PolicyReferenceLayout,
  PolicyReferenceHero,
} from "./policy-reference-layout";
import { PolicyReferenceInteractions } from "./policy-reference-interactions";
import {
  PolicyV6Provider,
  PolicyV6Intro,
  PolicyV6Actions,
  PolicyV6ChecklistFaq,
  PolicyV6Faq,
} from "./policy-v6";
import { PolicyV6RecordTopics } from "./policy-v6-record-topics";
import { PolicyV6Artwork } from "./policy-v6-artwork";
import { PolicyV6Popover } from "./policy-v6-popover";
import { UniversityAiTools } from "./university-ai-tools";
import { PolicyV6ClaimGroups } from "./policy-v6-claim-groups";
import { PolicyV6Sources } from "./policy-v6-sources";

/** Two newly captured schools reuse V6 UI while leaving the canonical/public route and loaders intact. */
export function PolicyV6LocalPage({
  university,
  data,
  evidence,
  locale,
  relatedUniversities = [],
}: {
  university: { slug: string; name: string; region: string; country: string };
  data: PolicyV6Data;
  evidence: LocalV6Evidence;
  locale: SupportedLocale;
  relatedUniversities?: RelatedUniversityRef[];
}) {
  const school = data.schools.find((s) => s.slug === university.slug)!;
  const scene = getPolicyV6IllustratedScene(school, locale);
  const zh = locale === "zh",
    harvard = university.slug === "harvard-university";
  const t = (s: string) => translate(s, locale);
  const insights = harvard
    ? [
        {
          key: "harvard-hls-exam",
          title: zh
            ? "HLS Graduate Program：考前与考试中，规则不同"
            : "HLS Graduate Program: study and exam rules differ",
          text: zh
            ? "考前可询问相关概念；考试中不可就考试主题向 AI 提问，也不可预写 AI 文本带入考试。教师另订规则须书面通知全体学生。"
            : "Concept questions while studying are permitted. Exam-subject queries during the exam and pre-written AI text for incorporation are prohibited. Different instructor rules must be written and communicated to all students.",
          href: "#claim-clm-harvard-university-hls-gp-exams",
        },
        {
          key: "harvard-social-studies-attestation",
          title: zh
            ? "Social Studies：两次 Attestation，例外单独申请"
            : "Social Studies: two attestations and separate exceptions",
          text: zh
            ? "在 Prospectus 提交及 senior year 各完成一次声明。论文例外须导师及 DUS 批准；不能因另一课程允许 AI，就把相关作业直接用于论文。DUS 批准最迟须于 senior year 11 月 1 日取得；秋季毕业的 off-cycle seniors 为 4 月 1 日。"
            : "Complete the attestation at Prospectus submission and again in senior year. Thesis exceptions require supervisor and DUS approval; another course’s permission does not transfer AI-assisted work into the thesis. DUS approval is due by November 1 of senior year, or April 1 for off-cycle seniors graduating in the fall.",
          href: "#claim-clm-harvard-university-social-studies-default-prohibition",
        },
      ]
    : [
        {
          key: "cambridge-engineering",
          title: zh
            ? "Engineering Triposes：自己的初稿与使用声明"
            : "Engineering Triposes: your own base and a declaration",
          text: zh
            ? "适用于 Engineering 与 Manufacturing Engineering Triposes；具体 assessment brief 优先。准备 summative work 的 GenAI 使用须声明，除非任务说明另有规定；不要无自己的初始文本就生成提交内容，也不要从内容自动生成参考文献；管理学生自行确定的参考文献的工具仍可使用。"
            : "For Engineering and Manufacturing Engineering Triposes, the assessment brief takes precedence. Declare GenAI used to prepare summative work unless the brief says otherwise. Do not generate raw submission content without an initial self-written base or automatically generate references from content; tools managing student-identified references remain allowed.",
          href: "#claim-claim-cam-engineering-genai-assessment-2026",
        },
        {
          key: "cambridge-research-data",
          title: zh
            ? "科研：先查 RDM、资助方与出版要求"
            : "Research: check RDM, funder and publisher conditions",
          text: zh
            ? "RDM v4 覆盖科研人员及参与研究的学生。研究、传播、资助申请和评估都须核对适用要求；没有独立 GenAI 科研政策，不代表没有规则。"
            : "RDM v4 covers the research community, including students involved in research. Check applicable requirements for research, dissemination, funding applications and assessment; no distinct GenAI research policy does not mean unrestricted use.",
          href: "#claim-claim-cam-research-data-genai-framework-2026",
        },
      ];
  const scopedTools = evidence.hmsTools.length ? (
    <section className="policy-v6-hms-tools" id="hms-scoped-tools">
      <h2>
        {zh
          ? "HMS 院内工具：资格、培训与数据等级"
          : "HMS tools: eligibility, training and data levels"}
      </h2>
      <p>
        {zh
          ? "与 HUIT 通用服务分别阅读。HMS 为符合资格者提供 Claude、ChatGPT Edu、Copilot Premium 三者之一；Level 4 服务须单独申请，数据批准不替代 DUA 或学业规则。"
          : "Read separately from HUIT general services. HMS provides one of Claude, ChatGPT Edu or Copilot Premium per eligible person. Level 4 services require separate requests; data approval does not replace DUA or academic conditions."}
      </p>
      <div
        className="policy-v6-table-scroll"
        tabIndex={0}
        role="region"
        aria-label={
          zh
            ? "HMS 工具条件表，可左右滚动"
            : "HMS tool conditions, horizontally scrollable"
        }
      >
        <table>
          <caption>
            {zh ? "HMS 官方工具条件" : "HMS official tool conditions"}
          </caption>
          <thead>
            <tr>
              {(zh
                ? ["工具", "数据等级", "人员资格", "培训", "费用"]
                : ["Tool", "Data level", "Eligibility", "Training", "Cost"]
              ).map((h) => (
                <th key={h} scope="col">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {evidence.hmsTools.map((row) => (
              <tr key={row.name}>
                <th scope="row" data-i18n="preserve">
                  {row.name}
                </th>
                {[
                  row.dataLevel,
                  row.eligibility,
                  row.trainingRequired,
                  row.cost,
                ].map((v, i) => (
                  <td key={i} data-i18n="preserve" lang="en">
                    {v}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <PolicyV6Popover
        label={zh ? "官方原文" : "Official evidence"}
        title={zh ? "HMS 工具 · 官方原文" : "HMS tools · Official evidence"}
        closeLabel={zh ? "关闭" : "Close"}
        triggerClassName="policy-v6-textAction"
      >
        {evidence.hmsTools.map((row) => (
          <blockquote key={row.name} data-i18n="preserve" lang="en">
            {row.originalTableRow}
          </blockquote>
        ))}
        <a
          href={evidence.hmsTools[0].sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          {t("Official source")} ↗
        </a>
      </PolicyV6Popover>
    </section>
  ) : null;
  return (
    <main
      className="page-shell page-shell--wide policy-reference"
      data-policy-layout="v6"
      data-v6-basis={evidence.fingerprint}
      data-v6-review-state="agent_reviewed"
    >
      <PolicyV6Provider data={data}>
        <PolicyReferenceLayout enabled uiLab locale={locale} tools>
          <EntityHeader
            actions={
              <div id="v6-header-actions">
                <PolicyV6Actions />
              </div>
            }
            leading={<UniversityMark slug={university.slug} size="hero" />}
            title={<span data-i18n="preserve">{getPolicyV6UniversityTitle(university.slug, university.name)}</span>}
            eyebrow={<PolicyV6HeaderLocation region={university.region} country={university.country} checkedAt={evidence.record.lastCheckedAt} locale={locale} />}
          />
          <PolicyV6Intro />
          {scene ? (
            <PolicyReferenceHero
              uiLab
              scene={scene}
              locale={locale}
              localizedActions={zh}
              tools
            />
          ) : null}
          <section
            className="policy-v6-school-insights"
            aria-labelledby="v6-school-insights-title"
          >
            <h2 id="v6-school-insights-title">
              {zh ? "先找与你相关的规则" : "Find the rule that applies to you"}
            </h2>
            <div>
              {insights.map((i) => (
                <article key={i.key}>
                  <PolicyV6Artwork section={i.key} />
                  <h3>{i.title}</h3>
                  <p lang={zh ? "zh" : "en"} data-i18n="preserve">
                    {i.text}
                  </p>
                  <a href={i.href}>{t("View evidence")} →</a>
                </article>
              ))}
            </div>
          </section>
          <PolicyV6RecordTopics data={data} />
          <UniversityAiTools
            records={evidence.tools}
            scopedTools={scopedTools}
            locale={locale}
            uiLab
            currentEvidenceCheckedAt={evidence.record.lastCheckedAt}
          />
          <PolicyV6ChecklistFaq includeFaq={false} />
          <PolicyReferenceInteractions />
          <section
            className="student-record-section student-record-section--compact"
            id="claims"
          >
            <div className="section-heading">
              <h2>{t("Reviewed claims")}</h2>
              <p>
                {evidence.record.claims.length} ·{" "}
                {policyV6AgentReviewLabel(locale)}
              </p>
            </div>
            <PolicyV6ClaimGroups
              entitySlug={university.slug}
              groups={groupReviewedClaimsByClaimType(evidence.record.claims)}
              locale={locale}
            />
          </section>
          <section
            className="student-record-section student-record-section--compact"
            id="sources"
          >
            <h2>{t("Official sources")}</h2>
            <PolicyV6Sources
              sources={evidence.record.officialSources}
              slug={university.slug}
              locale={locale}
            />
          </section>
          <RelatedUniversities
            universities={relatedUniversities}
            locale={locale}
            localizeUi
            uiLab
          />
          <section className="student-record-info" id="record-info">
            <details>
              <summary>{t("Record information, JSON & citation")}</summary>
              <p>
                {zh
                  ? "V6 使用已审核的新采集补充资料；canonical JSON 保留数据发布基线，页面补充变更已单独登记。"
                  : "V6 presents reviewed source-based supplementary material; canonical JSON retains the dataset baseline and page supplement changes are recorded separately."}
              </p>
              <p>{school.revision}</p>
              <p className="hash-value" data-i18n="preserve">
                {evidence.fingerprint}
              </p>
              <a href={evidence.originalRecord.apiUrl}>
                {zh ? "查看原公开基线 JSON" : "View published baseline JSON"}
              </a>
              <p>
                {zh
                  ? "补充、历史及纪律程序对象的审计范围另列于验收记录，不把本页审核当作全对象 QS 审计完成。"
                  : "Supplementary, historical and disciplinary-object audit coverage is recorded separately; this page review does not assert a complete all-object QS audit."}
              </p>
            </details>
          </section>
          <PolicyV6Faq />
        </PolicyReferenceLayout>
      </PolicyV6Provider>
    </main>
  );
}
